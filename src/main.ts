// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, raw } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // ✅ Active le raw body
  });

  // ✅ CRITICAL: Raw body parser pour Stripe AVANT tout autre middleware
  // Ceci est ESSENTIEL pour Render et autres plateformes cloud
  app.use('/webhooks/stripe', raw({ type: 'application/json' }));

  // ✅ JSON parser pour tous les autres endpoints
  // Le webhook Stripe est déjà géré par le middleware ci-dessus
  app.use(
    json({
      verify: (req: any, res, buf) => {
        // Stocker le raw body pour tous les endpoints (backup)
        if (req.originalUrl && req.originalUrl.includes('/webhooks/stripe')) {
          req.rawBody = buf;
        }
      },
    }),
  );

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });

  // Swagger documentation
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