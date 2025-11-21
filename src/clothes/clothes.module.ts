import { Module } from '@nestjs/common';
import { ClothesService } from './clothes.service';
import { ClothController } from './clothes.controller';
import { Clothes, ClothesSchema } from './schemas/clothes.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from 'src/user/user.module';
import { User, UserSchema } from 'src/user/schemas/user.schema';
import { DetectController } from './detect.controller';
// ✨ NOUVEAUX IMPORTS
import { UserPreferences, UserPreferencesSchema } from './schemas/user-preferences.schema';
import { UserPreferencesService } from './services/user-preferences.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Clothes.name, schema: ClothesSchema },
      { name: User.name, schema: UserSchema },
      { name: UserPreferences.name, schema: UserPreferencesSchema }, // ✨ NOUVEAU
    ]),
    UserModule,
  ],
  controllers: [ClothController, DetectController],
  providers: [
    ClothesService,
    UserPreferencesService, // ✨ NOUVEAU
  ],
  exports: [
    MongooseModule,
    ClothesService, // ✨ AJOUTÉ pour le cron job
  ],
})
export class ClothesModule {}