import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  content: string;

  @Prop({ type: Date })
  readAt?: Date;

  // ✨ NOUVEAU : Informations extraites par l'IA (téléphone, adresse, email, URL)
  @Prop({
    type: {
      phoneNumbers: [String],
      addresses: [String],
      emails: [String],
      urls: [String],
    },
    required: false,
  })
  extractedInfo?: {
    phoneNumbers?: string[];
    addresses?: string[];
    emails?: string[];
    urls?: string[];
  };
}

export type MessageDocument = Message & Document;
export const MessageSchema = SchemaFactory.createForClass(Message);