// src/subscriptions/subscriptions.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { SubscriptionPlan } from './schemas/subscription.schema';
import { StripeService } from './stripe.service';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly service: SubscriptionsService,
    private readonly stripeService: StripeService,
  ) {}

  // --------------------------
  // Utilitaire : normaliser plan
  // --------------------------
  private normalizePlan(plan: string): SubscriptionPlan {
  const normalized = plan.trim().toUpperCase().replace(/-/g, '_');
  if (!Object.values(SubscriptionPlan).includes(normalized as SubscriptionPlan)) {
    throw new BadRequestException('Invalid plan');
  }
  return normalized as SubscriptionPlan;
}
  // --------------------------
  // Endpoints
  // --------------------------

  @Get('me')
  @ApiOperation({ summary: 'Get my current subscription' })
  async getMySubscription(@GetUser() user: any) {
    return this.service.getSubscription(user.id);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get my usage statistics' })
  async getMyStats(@GetUser() user: any) {
    return this.service.getUsageStats(user.id);
  }

  @Post('upgrade/:plan')
  @ApiOperation({ summary: 'Upgrade subscription plan (production)' })
  async upgradePlan(@Param('plan') plan: string, @GetUser() user: any) {
    const normalizedPlan = this.normalizePlan(plan);

    const subscription = await this.service.upgradePlan(user.id, normalizedPlan);
    return {
      message: `Successfully upgraded to ${normalizedPlan}`,
      subscription,
    };
  }

  @Post('upgrade/:plan/test')
  @ApiOperation({ summary: 'Upgrade subscription plan (test simulation)' })
  async upgradePlanTest(@Param('plan') plan: string, @GetUser() user: any) {
    const normalizedPlan = this.normalizePlan(plan);

    const subscription = await this.service.upgradePlan(user.id, normalizedPlan);
    return {
      message: `Test purchase successful! You are now on the ${normalizedPlan} plan.`,
      subscription,
    };
  }

  @Post('upgrade/:plan/stripe')
  @ApiOperation({ summary: 'Upgrade subscription plan via Stripe checkout' })
  async upgradePlanStripe(@Param('plan') plan: string, @GetUser() user: any) {
    const normalizedPlan = this.normalizePlan(plan);

    const successUrl = `${process.env.FRONTEND_URL}/subscription-success`;
    const cancelUrl = `${process.env.FRONTEND_URL}/subscription-cancel`;

    const url = await this.stripeService.createTestCheckoutSession(
      normalizedPlan,
      successUrl,
      cancelUrl,
    );

    return { url };
  }

  @Get('quota/clothes-detection')
  @ApiOperation({ summary: 'Check if user can detect clothes' })
  async canDetect(@GetUser() user: any) {
    return this.service.canDetectClothes(user.id);
  }

  @Get('quota/outfit-generation')
  @ApiOperation({ summary: 'Check if user can generate outfit suggestions' })
  async canGenerate(@GetUser() user: any) {
    return this.service.canGenerateOutfit(user.id);
  }

  @Get('quota/store-selling')
  @ApiOperation({ summary: 'Check if user can sell items in store' })
  async canSell(@GetUser() user: any) {
    return this.service.canSellItem(user.id);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get all available subscription plans' })
  async getPlans() {
    return {
      plans: [
        {
          id: SubscriptionPlan.FREE,
          name: 'Free Pack',
          price: 0,
          features: { clothesDetection: 5, outfitSuggestions: 3, storeSelling: 3 },
          color: '#9CA3AF',
        },
        {
          id: SubscriptionPlan.PREMIUM,
          name: 'Premium',
          price: 9.99,
          features: { clothesDetection: 'unlimited', outfitSuggestions: 'unlimited', storeSelling: 3 },
          color: '#CA3C66',
        },
        {
          id: SubscriptionPlan.PRO_SELLER,
          name: 'Pro Seller',
          price: 29.99,
          features: { clothesDetection: 'unlimited', outfitSuggestions: 'unlimited', storeSelling: 'unlimited' },
          color: '#4AA3A2',
        },
      ],
    };
  }
}