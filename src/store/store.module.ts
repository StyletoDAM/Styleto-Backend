import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { Store, StoreSchema } from './schemas/store.schema';
import { Clothes, ClothesSchema } from '../clothes/schemas/clothes.schema';
import { UserModule } from '../user/user.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module'; // ✨ NOUVEAU

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Store.name, schema: StoreSchema },
      { name: Clothes.name, schema: ClothesSchema },
    ]),
    forwardRef(() => UserModule),
    SubscriptionsModule, // ✨ NOUVEAU
  ],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}