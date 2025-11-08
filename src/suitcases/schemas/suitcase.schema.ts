import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SuitcaseDocument = Suitcase & Document;

@Schema({ timestamps: true })
export class Suitcase {
  @Prop({ required: true })
  name: string; // exemple : "Valise Voyage Paris"

  // Lien 1-1 avec l’événement
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  event: Event;

  // Liste des vêtements contenus
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Clothes' }] })
  clothes: Types.ObjectId[];


}

export const SuitcaseSchema = SchemaFactory.createForClass(Suitcase);
