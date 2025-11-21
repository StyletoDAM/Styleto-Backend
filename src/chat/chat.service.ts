// src/chat/chat.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
  ) {}

  // CRÉER OU RÉCUPÉRER UNE CONVERSATION 1v1
  async ensureConversation(currentUserId: string, partnerId: string) {
    if (currentUserId === partnerId) {
      throw new BadRequestException('Tu ne peux pas créer une conversation avec toi-même');
    }

    const participants = [currentUserId, partnerId].sort(); // ordre alphabétique = même conv A→B ou B→A

    let conversation = await this.conversationModel.findOne({
      participants: { $all: participants, $size: 2 },
    });

    if (!conversation) {
      conversation = await this.conversationModel.create({
        participants,
        isGroup: false,
      });
    }

    return conversation;
  }

  // ENVOYER UN MESSAGE
  async createMessage(conversationId: string, senderId: string, content: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation non trouvée');

    const isParticipant = conversation.participants.some((id: any) => id.toString() === senderId);
    if (!isParticipant) throw new ForbiddenException('Tu ne fais pas partie de cette conversation');

    const message = await this.messageModel.create({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(senderId),
      content,
    });

    // Mise à jour du lastMessage
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    return await message.populate('senderId', 'fullName profilePicture');
  }

  // RÉCUPÉRER LES MESSAGES D'UNE CONVERSATION (triés par date)
  async getMessages(conversationId: string) {
    return this.messageModel
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'fullName profilePicture');
  }

  // MES CONVERSATIONS (avec dernier message + partenaire)
  async getUserConversations(userId: string) {
    return this.conversationModel
      .find({ participants: userId })
      .sort({ updatedAt: -1 })
      .populate('participants', 'fullName profilePicture')
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: 'fullName profilePicture' },
      });
  }

  // Récupérer une conversation par ID (pour le gateway)
  async getConversationById(conversationId: string) {
    const conv = await this.conversationModel.findById(conversationId).populate('participants');
    if (!conv) throw new NotFoundException('Conversation non trouvée');
    return conv;
  }
}