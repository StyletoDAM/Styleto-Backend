import { Module } from '@nestjs/common';
import { OutfitsService } from './outfits.service';
import { OutfitsController } from './outfits.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Outfit } from './entities/outfit.entity';
import { OutfitSchema } from './schemas/outfits.schema';
import { ClothesModule } from 'src/clothes/clothes.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
      MongooseModule.forFeature([
        {
          name: Outfit.name,
          schema: OutfitSchema,
        },
      ]),
      UserModule,     
    ClothesModule,  
    ],
  controllers: [OutfitsController],
  providers: [OutfitsService],
})
export class OutfitsModule {}
