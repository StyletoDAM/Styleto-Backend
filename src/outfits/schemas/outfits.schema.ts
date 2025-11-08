import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OutfitDocument = Outfit & Document;

@Schema({ timestamps: true })
export class Outfit {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Clothes', default: [] })
  clothesIds: Types.ObjectId[];

  @Prop()
  eventType: string;

  @Prop()
  weatherType: string;

  @Prop({ enum: ['accepted', 'rejected', 'pending'], default: 'pending' })
  status: string;
}

export const OutfitSchema = SchemaFactory.createForClass(Outfit);
