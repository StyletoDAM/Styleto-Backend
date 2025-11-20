import { Module } from '@nestjs/common';
import { ClothesService } from './clothes.service';
import { ClothController } from './clothes.controller';
import { Clothes, ClothesSchema } from './schemas/clothes.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from 'src/user/user.module';
import { User, UserSchema } from 'src/user/schemas/user.schema';
import { DetectController } from './detect.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Clothes.name, schema: ClothesSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UserModule,
  ],
  controllers: [ClothController,DetectController],
  providers: [ClothesService],
  exports: [
    MongooseModule, 
  ],
})
export class ClothesModule {}
