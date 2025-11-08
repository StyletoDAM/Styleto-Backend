import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { join } from 'path';

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (!value && !fallback) {
    throw new Error(`Environment variable ${key} is missing!`);
  }
  return value || fallback!;
}

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: getEnv('EMAIL_HOST', 'smtp.gmail.com'),
        port: parseInt(getEnv('EMAIL_PORT', '587'), 10),
        secure: false,
        auth: {
          user: getEnv('EMAIL_USER'),
          pass: getEnv('EMAIL_PASS'),
        },
      },
      defaults: {
        from: getEnv('EMAIL_FROM', '"Labasni" <no-reply@labasni.com>'),
      },
      template: {
        dir: join(process.cwd(), 'dist', 'mailer', 'templates'),
        options: { strict: true },
      },
    }),
  ],
  exports: [MailerModule],
})
export class MailerCustomModule {}