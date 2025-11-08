import { Module } from '@nestjs/common';
import { AvatarService } from './avatars.service';
import { AvatarController } from './avatars.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Avatar } from './entities/avatar.entity';
import { AvatarSchema } from './schemas/avatar.schema';
import { User, UserSchema } from 'src/user/schemas/user.schema';

@Module({
  imports: [
      MongooseModule.forFeature([
        {
          name: Avatar.name,
          schema: AvatarSchema,
        },
              { name: User.name, schema: UserSchema }, 

      ]),
    ],
  controllers: [AvatarController],
  providers: [AvatarService],
})
export class AvatarsModule {}
