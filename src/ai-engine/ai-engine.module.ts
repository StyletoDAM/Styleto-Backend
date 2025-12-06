// src/ai-engine/ai-engine.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AIEngineService } from './ai-engine.service';
import { LiveGateway } from './live.gateway';
import { ClothesModule } from '../clothes/clothes.module';
import { Clothes, ClothesSchema } from '../clothes/schemas/clothes.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Clothes.name, schema: ClothesSchema },
    ]),
    // Import ClothesModule pour accéder à ClothesService
    ClothesModule,
    // JWT pour authentification WebSocket
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'super_secure_jwt_secret_2025_change_me_in_production',
        signOptions: {
          expiresIn: '7d', // Valeur fixe au lieu de string variable
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AIEngineService, LiveGateway],
  exports: [AIEngineService, LiveGateway],
})
export class AIEngineModule {}