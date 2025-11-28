import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'Clothes', required: true })
  clothesId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  price: number;

  @Prop({ type: Date, default: Date.now })
  orderDate: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

