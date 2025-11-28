import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClothesService } from './clothes.service';
import { ClothController } from './clothes.controller';
import { DetectController } from './detect.controller'; // ✨ AJOUTER CETTE LIGNE
import { Clothes, ClothesSchema } from './schemas/clothes.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { UserPreferencesService } from './services/user-preferences.service';
import { UserPreferences, UserPreferencesSchema } from './schemas/user-preferences.schema';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Clothes.name, schema: ClothesSchema },
      { name: User.name, schema: UserSchema },
      { name: UserPreferences.name, schema: UserPreferencesSchema },
    ]),
    SubscriptionsModule,
  ],
  controllers: [ClothController, DetectController], // ✨ AJOUTER DetectController ICI
  providers: [ClothesService, UserPreferencesService],
  exports: [
    ClothesService,
    MongooseModule.forFeature([{ name: Clothes.name, schema: ClothesSchema }]),
  ],
})
export class ClothesModule {}