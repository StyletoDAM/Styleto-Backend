import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly client: Twilio | null;
  private readonly logger = new Logger(TwilioService.name);
  private readonly fromNumber: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER', '');

    if (!accountSid || !authToken || !this.fromNumber) {
      this.logger.warn(
        'Les identifiants Twilio ne sont pas entièrement configurés. Les SMS ne seront pas envoyés.',
      );
      this.client = null;
      return;
    }

    this.client = new Twilio(accountSid, authToken);
  }

  async sendOtpSms(recipient: string, code: string): Promise<void> {
    if (!this.client) {
      throw new InternalServerErrorException('Service SMS indisponible.');
    }

    const to = recipient.replace(/\s+/g, '');

    try {
      await this.client.messages.create({
        from: this.fromNumber,
        to,
        body: `Labasni : votre code de vérification est ${code}. Il expire dans 10 minutes.`,
      });
    } catch (error) {
      this.logger.error('Échec envoi SMS Twilio', error as any);
      throw new InternalServerErrorException('Échec envoi SMS');
    }
  }
}

