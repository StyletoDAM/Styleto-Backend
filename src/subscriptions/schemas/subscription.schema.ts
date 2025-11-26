// src/subscriptions/schemas/subscription.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

export enum SubscriptionPlan {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
  PRO_SELLER = 'PRO_SELLER',
}

// --------------------------
// Monthly Usage Subschema
// --------------------------
@Schema({ _id: false })
export class MonthlyUsage {
  @Prop({ required: true })
  month: string; // ex: "2025-02"

  @Prop({ default: 0 })
  clothesDetectionUsed: number;

  @Prop({ default: 0 })
  outfitSuggestionsUsed: number;

  @Prop({ default: 0 })
  itemsSoldCount: number;

  @Prop({ type: Date, default: Date.now })
  lastReset: Date;
}

export const MonthlyUsageSchema = SchemaFactory.createForClass(MonthlyUsage);

// --------------------------
// Subscription Schema
// --------------------------
@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(SubscriptionPlan),
    default: SubscriptionPlan.FREE,
  })
  plan: SubscriptionPlan;

  @Prop({
    type: MonthlyUsageSchema,
    default: () => ({
      month: new Date().toISOString().slice(0, 7),
      clothesDetectionUsed: 0,
      outfitSuggestionsUsed: 0,
      itemsSoldCount: 0,
      lastReset: new Date(),
    }),
  })
  currentUsage: MonthlyUsage;

  @Prop({ type: [MonthlyUsageSchema], default: [] })
  usageHistory: MonthlyUsage[];

  @Prop({ type: Date, default: Date.now })
  subscribedAt: Date;

  @Prop()
  expiresAt?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  stripeSubscriptionId?: string;

  @Prop()
  stripeCustomerId?: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// --------------------------
// PLAN LIMITS
// --------------------------
export const PLAN_LIMITS = {
  [SubscriptionPlan.FREE]: {
    clothesDetection: 5,
    outfitSuggestions: 3,
    storeSelling: 3,
    color: '#9CA3AF',
  },
  [SubscriptionPlan.PREMIUM]: {
    clothesDetection: -1,
    outfitSuggestions: -1,
    storeSelling: 3,
    color: '#CA3C66',
  },
  [SubscriptionPlan.PRO_SELLER]: {
    clothesDetection: -1,
    outfitSuggestions: -1,
    storeSelling: -1,
    color: '#4AA3A2',
  },
};
