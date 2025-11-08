import { Injectable } from "@nestjs/common";
import { MailerService } from '@nestjs-modules/mailer'; 

@Injectable()
export class EmailService {
  constructor(private mailerService: MailerService) {}

  async sendVerificationCode(email: string, code: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Votre code de vérification',
      template: './verification',
      context: { code },
    });
  }
}