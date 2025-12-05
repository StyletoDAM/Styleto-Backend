import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { Store, StoreSchema } from '../store/schemas/store.schema';
import { Clothes, ClothesSchema } from '../clothes/schemas/clothes.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Store.name, schema: StoreSchema },
      { name: Clothes.name, schema: ClothesSchema },
    ]),
    forwardRef(() => UserModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

