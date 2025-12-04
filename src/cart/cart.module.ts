import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { Cart, CartSchema } from './schemas/cart.schema';
import { Store, StoreSchema } from '../store/schemas/store.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Store.name, schema: StoreSchema },
    ]),
    forwardRef(() => UserModule),
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService], // ✨ Export pour que StoreModule puisse l'utiliser
})
export class CartModule {}

