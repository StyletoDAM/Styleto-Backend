import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutfitsService } from './outfits.service';
import { OutfitsController } from './outfits.controller';
import { Outfit, OutfitSchema } from './schemas/outfits.schema';
import { Clothes, ClothesSchema } from '../clothes/schemas/clothes.schema';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module'; // ✨ NOUVEAU

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Outfit.name, schema: OutfitSchema },
      { name: Clothes.name, schema: ClothesSchema },
    ]),
    SubscriptionsModule, // ✨ NOUVEAU
  ],
  controllers: [OutfitsController],
  providers: [OutfitsService],
  exports: [OutfitsService],
})
export class OutfitsModule {}
