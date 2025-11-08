import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './schemas/events.schema';
import { UserModule } from 'src/user/user.module'; // ✅ importer le UserModule
import { ClothesModule } from 'src/clothes/clothes.module'; // ✅ importer le ClothesModule si tu utilises ClothesModel

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    UserModule,     // ✅ permet d’utiliser UserModel et UserService
    ClothesModule,  // ✅ permet d’utiliser ClothesModel si nécessaire
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
