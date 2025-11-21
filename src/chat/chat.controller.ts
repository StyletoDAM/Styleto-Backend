// src/chat/chat.controller.ts

import { Controller, Post, Get, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // CRÉER UNE CONVERSATION 1v1
  @Post('conversations')
  @ApiOperation({ summary: 'Créer une conversation avec un autre utilisateur' })
  @ApiBody({ schema: { example: { participantId: '691afd9d2985a29548ff07dd' } } })
  async createConversation(@Req() req: any, @Body('participantId') participantId: string) {
    return this.chatService.ensureConversation(req.user.sub, participantId);
  }

  // MES CONVERSATIONS
  @Get('conversations')
  async getMyConversations(@Req() req: any) {
    return this.chatService.getUserConversations(req.user.sub);
  }

  // TOUS LES MESSAGES D'UNE CONVERSATION
  @Get('conversations/:id/messages')
  async getMessages(@Param('id') conversationId: string) {
    return this.chatService.getMessages(conversationId);
  }

  // ENVOYER UN MESSAGE (REST)
  @Post('messages')
  @ApiOperation({ summary: 'Envoyer un message' })
  @ApiBody({ schema: { example: { conversationId: '...', content: 'Salut !' } } })
  async sendMessage(@Req() req: any, @Body() body: { conversationId: string; content: string }) {
    return this.chatService.createMessage(body.conversationId, req.user.sub, body.content);
  }
}