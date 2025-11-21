import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserPreferencesDocument = UserPreferences & Document;

@Schema({ timestamps: true })
export class UserPreferences {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  // Statistiques des corrections de l'utilisateur
  @Prop({
    type: {
      styles: {
        casual: { type: Number, default: 0 },
        elegant: { type: Number, default: 0 },
        sport: { type: Number, default: 0 },
        vintage: { type: Number, default: 0 },
        modern: { type: Number, default: 0 },
        bohemian: { type: Number, default: 0 },
      },
      seasons: {
        winter: { type: Number, default: 0 },
        summer: { type: Number, default: 0 },
        fall: { type: Number, default: 0 },
        spring: { type: Number, default: 0 },
      },
      categories: {
        top: { type: Number, default: 0 },
        bottom: { type: Number, default: 0 },
        dress: { type: Number, default: 0 },
        shoes: { type: Number, default: 0 },
        accessory: { type: Number, default: 0 },
        jacket: { type: Number, default: 0 },
      },
    },
    default: {
      styles: {},
      seasons: {},
      categories: {},
    },
  })
  correctionStats: {
    styles: Record<string, number>;
    seasons: Record<string, number>;
    categories: Record<string, number>;
  };

  @Prop({ type: Number, default: 0 })
  totalCorrections: number;

  // Préférences calculées automatiquement
  @Prop({
    type: {
      preferredStyle: String,
      preferredSeason: String,
      styleConfidence: Number,
      seasonConfidence: Number,
    },
    default: {},
  })
  preferences: {
    preferredStyle?: string;
    preferredSeason?: string;
    styleConfidence?: number;
    seasonConfidence?: number;
  };
}

export const UserPreferencesSchema = SchemaFactory.createForClass(UserPreferences);