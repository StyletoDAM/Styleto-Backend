import { Injectable } from "@nestjs/common";
import { MailerService } from '@nestjs-modules/mailer'; 

@Injectable()
export class EmailService {
  userService: any;
  constructor(private mailerService: MailerService) {}

  async sendVerificationCode(email: string, code: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Votre code de vérification',
      template: './verification',
      context: { code },
    });
  }

  // Login with Google
async validateGoogleUser(googleData: {
  email: string;
  fullName: string;
  profilePicture?: string;
  googleId: string;
}) {
  let user = await this.userService.findByGoogleId(googleData.googleId);

  if (!user) {
    // Crée le compte si n'existe pas
    user = await this.userService.create({
      fullName: googleData.fullName,
      email: googleData.email,
      gender: 'other', // ou demander plus tard
      authProvider: 'google',
      googleId: googleData.googleId,
      profilePicture: googleData.profilePicture,
      isVerified: true,
    });
  }

  return this.login(user);
}
  login(user: any) {
    throw new Error("Method not implemented.");
  }
}