// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // ✅ Active le raw body pour tout l'app
  });

  // ✅ Configuration du JSON parser avec exclusion du webhook Stripe
  app.use(
    json({
      verify: (req: any, res, buf) => {
        // Stocker le raw body pour le webhook Stripe
        if (req.originalUrl === '/webhooks/stripe') {
          req.rawBody = buf;
        }
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Labasni API')
    .setDescription('API pour Labasni - Auth, IA, Style, Subscriptions')
    .setVersion('1.0')
    .addTag('Auth')
    .addTag('Recommendations')
    .addTag('Subscriptions')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
  console.log(`📚 Swagger documentation: ${await app.getUrl()}/docs`);
}
bootstrap();