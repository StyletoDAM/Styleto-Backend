import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AvatarDocument = Avatar & Document;

@Schema({ timestamps: true })
export class Avatar {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop()
  imageURL: string;

  @Prop()
  style: string; // ex: réaliste, cartoon, 3D, etc.

  @Prop({ default: 'default' })
  type: string; // "custom" ou "default"
}

export const AvatarSchema = SchemaFactory.createForClass(Avatar);
