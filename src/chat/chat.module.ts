// src/chat/chat.module.ts

import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';

// SUPER IMPORTANT : on importe JwtModule ici !
import { JwtModule } from '@nestjs/jwt';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    // On ajoute JwtModule pour que WsJwtGuard fonctionne
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me-in-production-please',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [
    ChatGateway,
    ChatService,
    WsJwtGuard, // On l'ajoute ici aussi (même si c'est global, c'est plus sûr)
  ],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}