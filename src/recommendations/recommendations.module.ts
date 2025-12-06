import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { Clothes, ClothesSchema } from '../clothes/schemas/clothes.schema';
import { SubscriptionsModule } from 'src/subscriptions/subscriptions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Clothes.name, schema: ClothesSchema },
    ]),
    SubscriptionsModule
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}

