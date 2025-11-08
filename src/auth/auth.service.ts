import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  CreateUserInput,
  SafeUser,
  UpdateUserInput,
  UserService,
} from '../user/user.service';
import { SignupDto } from './dto/signup.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';
import { randomInt } from 'crypto';
import { MailerService } from '@nestjs-modules/mailer';


interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthResponse {
  user: SafeUser;
  access_token: string;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService, // 🔹 Ajouté

  ) {}

  // src/auth/auth.service.ts
async signup(signupDto: SignupDto) {
  // 1. Vérifie si email déjà pris
  const emailTaken = await this.userService.existsByEmail(signupDto.email);
  if (emailTaken) {
    throw new ConflictException('Email déjà utilisé');
  }

  // 2. Hash mot de passe
  const hashedPassword = await bcrypt.hash(signupDto.password, this.saltRounds);

  // 3. Génère code
  const verificationCode = randomInt(100000, 999999).toString();

  // 4. JWT temporaire (10 min)
  const tempPayload = {
    email: signupDto.email,
    fullName: signupDto.fullName,
    password: hashedPassword,
    gender: signupDto.gender,
    code: verificationCode,
  };

  const tempToken = await this.jwtService.signAsync(tempPayload, {
    expiresIn: '10m',
  });

  // 5. Envoie email
  try {
    await this.mailerService.sendMail({
  to: signupDto.email,
  subject: 'Votre code Labasni',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Votre code de vérification</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          background-color: #f4f6f9;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 500px;
          margin: 40px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          border: 1px solid #e0e6ed;
        }
        .header {
          background: linear-gradient(135deg, #4a90e2, #357abd);
          padding: 30px 20px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .body {
          padding: 30px 40px;
          text-align: center;
          color: #333;
        }
        .code {
          font-size: 48px;
          font-weight: bold;
          letter-spacing: 12px;
          color: #4a90e2;
          margin: 20px 0;
          padding: 15px;
          background: #f0f7ff;
          border: 2px dashed #4a90e2;
          border-radius: 12px;
          display: inline-block;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          font-size: 13px;
          color: #777;
          border-top: 1px solid #eee;
        }
        .highlight {
          color: #4a90e2;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LABASNI</h1>
        </div>
        <div class="body">
          <h2 style="margin-top: 0; color: #333;">Vérification de votre compte</h2>
          <p>Voici votre code de confirmation :</p>
          <div class="code">${verificationCode}</div>
          <p style="color: #666; margin: 20px 0;">
            Ce code expire dans <span class="highlight">10 minutes</span>.
          </p>
          <p style="font-size: 14px; color: #888;">
            Si vous n'avez pas demandé ce code, ignorez cet email.
          </p>
        </div>
        <div class="footer">
          © 2025 Labasni. Tous droits réservés.<br>
          <span style="color: #aaa;">support@labasni.com</span>
        </div>
      </div>
    </body>
    </html>
  `,

    });
  } catch (error) {
    console.error('Échec envoi email:', error);
    throw new InternalServerErrorException('Échec envoi email');
  }

  return {
    message: 'Code envoyé. Vérifiez votre email.',
    tempToken,
  };
}
  async login(user: SafeUser): Promise<AuthResponse> {
    if (!user?.id) {
      throw new UnauthorizedException('Invalid user payload');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      user,
      access_token: await this.jwtService.signAsync(payload),
    };
  }
  async validateUser(email: string, password: string) {
  const user = await this.userService.findByEmail(email);
  if (!user) return null;

  const isMatch = await bcrypt.compare(password, user.password || '');
  if (!isMatch) return null;

  return user; // retourne le SafeUser ou UserDocument selon ta stratégie
}


  async updateProfile(
    userId: string,
    updateDto: UpdateProfileDto,
  ): Promise<SafeUser> {
    if (updateDto.email) {
      const emailTaken = await this.userService.existsByEmail(
        updateDto.email,
        userId,
      );
      if (emailTaken) {
        throw new ConflictException('Email already in use');
      }
    }

    const updates: UpdateUserInput = { ...updateDto };
    if (updateDto.password) {
      updates.password = await bcrypt.hash(updateDto.password, this.saltRounds);
    }

    const updatedUser = await this.userService.updateById(userId, updates);
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  async deleteProfile(userId: string): Promise<void> {
    const existingUser = await this.userService.findById(userId);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }
    await this.userService.removeById(userId);
  }

  async googleAuth(googleAuthDto: GoogleAuthDto): Promise<AuthResponse> {
    // Chercher si l'utilisateur existe déjà avec Google ID
    let user = await this.userService.findByGoogleId(googleAuthDto.googleId);

    if (!user) {
      // Si l'utilisateur n'existe pas avec Google ID, chercher par email
      const existingUser = await this.userService.findByEmail(googleAuthDto.email);
      if (existingUser) {
        // Si l'utilisateur existe avec cet email, lier le compte Google
        await this.userService.updateById(existingUser.id, {
          googleId: googleAuthDto.googleId,
          authProvider: 'google',
          profilePicture: googleAuthDto.profilePicture,
        } as UpdateUserInput);
        user = await this.userService.findByGoogleId(googleAuthDto.googleId);
      } else {
        // Créer un nouvel utilisateur
        user = await this.userService.create({
          fullName: googleAuthDto.fullName,
          email: googleAuthDto.email,
          gender: googleAuthDto.gender || 'male', // Par défaut 'male' si non fourni
          authProvider: 'google',
          googleId: googleAuthDto.googleId,
          profilePicture: googleAuthDto.profilePicture,
        } satisfies CreateUserInput);
      }
    }

    if (!user) {
      throw new UnauthorizedException('Failed to authenticate with Google');
    }

    return this.login(user);
  }

  async appleAuth(appleAuthDto: AppleAuthDto): Promise<AuthResponse> {
    // Chercher si l'utilisateur existe déjà avec Apple ID
    let user = await this.userService.findByAppleId(appleAuthDto.appleId);

    if (!user) {
      // Si l'utilisateur n'existe pas avec Apple ID, chercher par email
      const existingUser = await this.userService.findByEmail(appleAuthDto.email);
      if (existingUser) {
        // Si l'utilisateur existe avec cet email, lier le compte Apple
        await this.userService.updateById(existingUser.id, {
          appleId: appleAuthDto.appleId,
          authProvider: 'apple',
          profilePicture: appleAuthDto.profilePicture,
        } as UpdateUserInput);
        user = await this.userService.findByAppleId(appleAuthDto.appleId);
      } else {
        // Créer un nouvel utilisateur
        user = await this.userService.create({
          fullName: appleAuthDto.fullName,
          email: appleAuthDto.email,
          gender: appleAuthDto.gender || 'male', // Par défaut 'male' si non fourni
          authProvider: 'apple',
          appleId: appleAuthDto.appleId,
          profilePicture: appleAuthDto.profilePicture,
        } satisfies CreateUserInput);
      }
    }

    if (!user) {
      throw new UnauthorizedException('Failed to authenticate with Apple');
    }

    return this.login(user);
  }
}
