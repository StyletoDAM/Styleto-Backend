import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios'; 
import { firstValueFrom } from 'rxjs'; 
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken'; 
import * as jwkToPem from 'jwk-to-pem'; 
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
  private appleJwksCache: { keys: any[]; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24h

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly httpService: HttpService, // AJOUTÉ
  ) {}

  // --- SIGNUP ---
  async signup(signupDto: SignupDto) {
    const emailTaken = await this.userService.existsByEmail(signupDto.email);
    if (emailTaken) throw new ConflictException('Email déjà utilisé');

    const hashedPassword = await bcrypt.hash(signupDto.password, this.saltRounds);
    const verificationCode = randomInt(100000, 999999).toString();

    const tempPayload = {
      email: signupDto.email,
      fullName: signupDto.fullName,
      password: hashedPassword,
      gender: signupDto.gender,
      code: verificationCode,
    };

    const tempToken = await this.jwtService.signAsync(tempPayload, { expiresIn: '10m' });

    try {
      await this.mailerService.sendMail({
        to: signupDto.email,
        subject: 'Votre code Labasni',
        html: `... (ton HTML complet) ...`,
      });
    } catch (error) {
      console.error('Échec envoi email:', error);
      throw new InternalServerErrorException('Échec envoi email');
    }

    return { message: 'Code envoyé. Vérifiez votre email.', tempToken };
  }

  // --- LOGIN ---
  async login(user: SafeUser): Promise<AuthResponse> {
    if (!user?.id) throw new UnauthorizedException('Invalid user payload');
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      user,
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  // --- VALIDATE USER ---
  async validateUser(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) return null;
    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) return null;
    return user;
  }

  // --- UPDATE PROFILE ---
  async updateProfile(userId: string, updateDto: UpdateProfileDto): Promise<SafeUser> {
    if (updateDto.email) {
      const emailTaken = await this.userService.existsByEmail(updateDto.email, userId);
      if (emailTaken) throw new ConflictException('Email already in use');
    }

    const updates: UpdateUserInput = { ...updateDto };
    if (updateDto.password) {
      updates.password = await bcrypt.hash(updateDto.password, this.saltRounds);
    }

    const updatedUser = await this.userService.updateById(userId, updates);
    if (!updatedUser) throw new NotFoundException('User not found');
    return updatedUser;
  }

  // --- DELETE PROFILE ---
  async deleteProfile(userId: string): Promise<void> {
    const existingUser = await this.userService.findById(userId);
    if (!existingUser) throw new NotFoundException('User not found');
    await this.userService.removeById(userId);
  }

  // --- GOOGLE AUTH ---
  async googleAuth(googleAuthDto: GoogleAuthDto): Promise<AuthResponse> {
    let user = await this.userService.findByGoogleId(googleAuthDto.googleId);

    if (!user) {
      const existingUser = await this.userService.findByEmail(googleAuthDto.email);
      if (existingUser) {
        // LIEN COMPTE EXISTANT
        const updates: UpdateUserInput = {
          googleId: googleAuthDto.googleId,
          authProvider: 'google',
        };

        // UNIQUEMENT si PAS d'image existante
        if (!existingUser.profilePicture && googleAuthDto.profilePicture) {
          updates.profilePicture = googleAuthDto.profilePicture;
        }

        await this.userService.updateById(existingUser.id, updates);
        user = await this.userService.findByGoogleId(googleAuthDto.googleId);
      } else {
        // NOUVEAU COMPTE
        user = await this.userService.create({
          fullName: googleAuthDto.fullName,
          email: googleAuthDto.email,
          gender: googleAuthDto.gender || 'male',
          authProvider: 'google',
          googleId: googleAuthDto.googleId,
          // UNIQUEMENT si fourni
          profilePicture: googleAuthDto.profilePicture || undefined,
          isVerified: true,
        });
      }
    }

    if (!user) throw new UnauthorizedException('Failed to authenticate with Google');
    return this.login(user);
  }

  // --- APPLE PUBLIC KEYS ---
  private async getApplePublicKeys() {
    const now = Date.now();
    if (this.appleJwksCache && now - this.appleJwksCache.timestamp < this.CACHE_DURATION) {
      return this.appleJwksCache;
    }

    const response = await firstValueFrom(
      this.httpService.get('https://appleid.apple.com/auth/keys')
    );
    this.appleJwksCache = { keys: response.data.keys, timestamp: now };
    return this.appleJwksCache;
  }

  // --- APPLE AUTH ---
async appleAuth(dto: AppleAuthDto): Promise<AuthResponse> {
  const { identityToken, fullName, email } = dto;

  // 1. Décodage
  const decoded = jwt.decode(identityToken) as any;
  if (!decoded || decoded.iss !== 'https://appleid.apple.com') {
    throw new UnauthorizedException('Token Apple invalide');
  }

  // 2. Récupération clé publique
  const jwks = await this.getApplePublicKeys();
  const key = jwks.keys.find((k: any) => k.kid === decoded.kid);
  if (!key) throw new UnauthorizedException('Clé Apple introuvable');

  // 3. Vérification signature
  const pem = jwkToPem(key);
  jwt.verify(identityToken, pem, { algorithms: ['RS256'] });

  const appleId = decoded.sub;

  // 4. Recherche ou création
  let user = await this.userService.findByAppleId(appleId);
  if (!user) {
    user = await this.userService.create({
      appleId,
      email: email || `${appleId}@privaterelay.appleid.com`,
      fullName: fullName || 'Apple User',
      authProvider: 'apple',
      isVerified: true,
    });
  }

  // UTILISE login() → IDENTIQUE À GOOGLE
  return this.login(user);
}

  

  // --- VALIDATE GOOGLE USER (optionnel) ---
  async validateGoogleUser(googleData: {
    googleId: string;
    email: string;
    fullName: string;
    profilePicture?: string;
  }) {
    let user = await this.userService.findByGoogleId(googleData.googleId);

    if (!user) {
      const existingUser = await this.userService.findByEmail(googleData.email);
      if (existingUser) {
        await this.userService.updateById(existingUser.id, {
          googleId: googleData.googleId,
          authProvider: 'google',
          profilePicture: googleData.profilePicture,
        });
        user = await this.userService.findByGoogleId(googleData.googleId);
      } else {
        user = await this.userService.create({
          fullName: googleData.fullName,
          email: googleData.email,
          gender: null as any,
          authProvider: 'google',
          googleId: googleData.googleId,
          profilePicture: googleData.profilePicture,
          isVerified: true,
        });
      }
    }

    if (!user) throw new UnauthorizedException('Échec de l’authentification Google');
    return user;
  }
}