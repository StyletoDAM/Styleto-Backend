import { Module } from '@nestjs/common';
import { SuitcaseService } from './suitcases.service';
import { SuitcaseController } from './suitcases.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Suitcase, SuitcaseSchema } from './schemas/suitcase.schema';
import { Clothes, ClothesSchema } from 'src/clothes/schemas/clothes.schema';
import { EventSchema } from 'src/events/schemas/events.schema';
import { User, UserSchema } from 'src/user/schemas/user.schema';

@Module({
  imports: [
      MongooseModule.forFeature([
        {
          name: Suitcase.name,
          schema: SuitcaseSchema,
        },
        { name: Event.name, schema: EventSchema },    
      { name: Clothes.name, schema: ClothesSchema }, 
      { name: User.name, schema: UserSchema },      
      ]),
    ],
  controllers: [SuitcaseController],
  providers: [SuitcaseService],
})
export class SuitcasesModule {}
