import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { Store, StoreSchema } from './schemas/store.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { Clothes, ClothesSchema } from 'src/clothes/schemas/clothes.schema';
import { User, UserSchema } from 'src/user/schemas/user.schema';

@Module({
  imports: [
      MongooseModule.forFeature([
        {
          name: Store.name,
          schema: StoreSchema,
        },
        { name: User.name, schema: UserSchema },
      { name: Clothes.name, schema: ClothesSchema },
      ]),

    ],
  controllers: [StoreController],
  providers: [StoreService],
})
export class StoreModule {}
