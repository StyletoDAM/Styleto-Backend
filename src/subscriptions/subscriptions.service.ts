// src/subscriptions/subscriptions.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionPlan,
  PLAN_LIMITS,
} from './schemas/subscription.schema';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining?: number | 'unlimited';
  limit?: number | 'unlimited';
  plan: SubscriptionPlan;
  message?: string;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  async createDefaultSubscription(userId: string) {
    const existing = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (existing) return existing;

    return await new this.subscriptionModel({
      userId: new Types.ObjectId(userId),
      plan: SubscriptionPlan.FREE,
      currentUsage: {
        month: new Date().toISOString().slice(0, 7),
        clothesDetectionUsed: 0,
        outfitSuggestionsUsed: 0,
        itemsSoldCount: 0,
        lastReset: new Date(),
      },
    }).save();
  }

  async getSubscription(userId: string) {
    let sub = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!sub) {
      sub = await this.createDefaultSubscription(userId);
    }

    await this.checkAndResetMonthlyUsage(sub);

    return sub;
  }

  private async checkAndResetMonthlyUsage(sub: SubscriptionDocument) {
    const currentMonth = new Date().toISOString().slice(0, 7);

    if (sub.currentUsage.month !== currentMonth) {
      sub.usageHistory.push({ ...sub.currentUsage });

      sub.currentUsage = {
        month: currentMonth,
        clothesDetectionUsed: 0,
        outfitSuggestionsUsed: 0,
        itemsSoldCount: 0,
        lastReset: new Date(),
      };

      await sub.save();
    }
  }

  // --------------------------
  // QUOTA CHECKS
  // --------------------------

  async canDetectClothes(userId: string): Promise<QuotaCheckResult> {
    const sub = await this.getSubscription(userId);
    const limits = PLAN_LIMITS[sub.plan];

    if (limits.clothesDetection === -1)
      return { allowed: true, plan: sub.plan };

    const used = sub.currentUsage.clothesDetectionUsed;
    const remaining = limits.clothesDetection - used;

    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        limit: limits.clothesDetection,
        plan: sub.plan,
        message: `Limite atteinte. Passez en Premium pour un accès illimité.`,
      };
    }

    return { allowed: true, remaining, limit: limits.clothesDetection, plan: sub.plan };
  }

  async canGenerateOutfit(userId: string): Promise<QuotaCheckResult> {
    const sub = await this.getSubscription(userId);
    const limits = PLAN_LIMITS[sub.plan];

    if (limits.outfitSuggestions === -1)
      return { allowed: true, plan: sub.plan };

    const used = sub.currentUsage.outfitSuggestionsUsed;
    const remaining = limits.outfitSuggestions - used;

    return remaining <= 0
      ? {
          allowed: false,
          remaining: 0,
          limit: limits.outfitSuggestions,
          plan: sub.plan,
          message: `Limite atteinte. Passez en Premium.`,
        }
      : {
          allowed: true,
          remaining,
          limit: limits.outfitSuggestions,
          plan: sub.plan,
        };
  }

  async canSellItem(userId: string) {
    const sub = await this.getSubscription(userId);
    const limits = PLAN_LIMITS[sub.plan];

    if (limits.storeSelling === -1)
      return { allowed: true, plan: sub.plan };

    const used = sub.currentUsage.itemsSoldCount;
    const remaining = limits.storeSelling - used;

    return remaining <= 0
      ? {
          allowed: false,
          remaining: 0,
          limit: limits.storeSelling,
          plan: sub.plan,
          message: `Limite atteinte. Passez au plan Pro Seller.`,
        }
      : {
          allowed: true,
          remaining,
          limit: limits.storeSelling,
          plan: sub.plan,
        };
  }

  // --------------------------
  // USAGE INCREMENTS
  // --------------------------

  async incrementClothesDetection(userId: string) {
    const sub = await this.getSubscription(userId);
    sub.currentUsage.clothesDetectionUsed++;
    await sub.save();
  }

  async incrementOutfitSuggestion(userId: string) {
    const sub = await this.getSubscription(userId);
    sub.currentUsage.outfitSuggestionsUsed++;
    await sub.save();
  }

  async incrementItemSold(userId: string) {
    const sub = await this.getSubscription(userId);
    sub.currentUsage.itemsSoldCount++;
    await sub.save();
  }

  // --------------------------
  // UPGRADE
  // --------------------------

  async upgradePlan(userId: string, plan: SubscriptionPlan, stripe?: any) {
    const sub = await this.getSubscription(userId);

    sub.plan = plan;
    sub.subscribedAt = new Date();

    if (plan !== SubscriptionPlan.FREE) {
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1);
      sub.expiresAt = expiry;
    } else {
      sub.expiresAt = undefined;
    }

    if (stripe) {
      sub.stripeSubscriptionId = stripe.subscriptionId;
      sub.stripeCustomerId = stripe.customerId;
    }

    return await sub.save();
  }

  // --------------------------
  // STATS
  // --------------------------

  async getUsageStats(userId: string) {
    const sub = await this.getSubscription(userId);
    const limits = PLAN_LIMITS[sub.plan];

    return {
      plan: sub.plan,
      currentMonth: sub.currentUsage.month,
      clothesDetection: {
        used: sub.currentUsage.clothesDetectionUsed,
        limit: limits.clothesDetection === -1 ? 'unlimited' : limits.clothesDetection,
        remaining:
          limits.clothesDetection === -1
            ? 'unlimited'
            : limits.clothesDetection - sub.currentUsage.clothesDetectionUsed,
      },
      outfitSuggestions: {
        used: sub.currentUsage.outfitSuggestionsUsed,
        limit: limits.outfitSuggestions === -1 ? 'unlimited' : limits.outfitSuggestions,
        remaining:
          limits.outfitSuggestions === -1
            ? 'unlimited'
            : limits.outfitSuggestions - sub.currentUsage.outfitSuggestionsUsed,
      },
      storeSelling: {
        used: sub.currentUsage.itemsSoldCount,
        limit: limits.storeSelling === -1 ? 'unlimited' : limits.storeSelling,
        remaining:
          limits.storeSelling === -1
            ? 'unlimited'
            : limits.storeSelling - sub.currentUsage.itemsSoldCount,
      },
      subscribedAt: sub.subscribedAt,
      expiresAt: sub.expiresAt,
      isActive: sub.isActive,
    };
  }
}
