// src/clothes/schemas/clothes.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClothesDocument = Clothes & Document;

@Schema({ timestamps: true })
export class Clothes {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  imageURL: string;

  // ✨ NOUVEAU : URL de l'image détourée (PNG transparent) pour VTO
  // Générée automatiquement après l'upload par le service Python
  @Prop({ default: null })
  processedImageURL?: string;

  // Catégorie (haut, bas, pantalon, chaussures, etc.)
  @Prop({ required: true })
  category: string;

  // Saison
  @Prop()
  season: string;

  // Couleur
  @Prop()
  color: string;

  // Style
  @Prop()
  style: string;

  @Prop({ default: 0 })
  acceptedCount: number;

  @Prop({ default: 0 })
  rejectedCount: number;

  @Prop({ default: false })
  isCorrected: boolean;

  @Prop({ type: Object })
  originalDetection: {
    type: string;
    color: string;
    style: string;
    season: string;
  };

  // ✨ NOUVEAU : Flag pour savoir si l'image a été traitée pour VTO
  @Prop({ default: false })
  isProcessed: boolean;

  // ✨ NOUVEAU : Statut du traitement de l'image
  // - 'pending': En attente de traitement
  // - 'processing': Traitement en cours par Python
  // - 'ready': Prêt pour VTO
  // - 'failed': Échec du traitement
  @Prop({ 
    enum: ['pending', 'processing', 'ready', 'failed'], 
    default: 'pending' 
  })
  processingStatus: string;

  // ✨ NOUVEAU : Message d'erreur si le traitement échoue
  @Prop({ default: null })
  processingError?: string;
}

export const ClothesSchema = SchemaFactory.createForClass(Clothes);

// Index pour améliorer les performances des requêtes VTO
ClothesSchema.index({ userId: 1, category: 1 });
ClothesSchema.index({ userId: 1, processingStatus: 1 });
ClothesSchema.index({ userId: 1, isProcessed: 1 });