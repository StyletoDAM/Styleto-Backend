// src/subscriptions/subscriptions.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { SubscriptionPlan } from './schemas/subscription.schema';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { ConfigService } from '@nestjs/config';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly service: SubscriptionsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  // --------------------------
  // STRIPE CHECKOUT SESSION
  // --------------------------

  @Post('create-checkout-session')
  @ApiOperation({ 
    summary: 'Create Stripe Checkout session',
    description: 'Crée une session de paiement Stripe pour souscrire à un plan'
  })
  @ApiBody({ type: CreateCheckoutDto })
  async createCheckoutSession(
    @GetUser() user: any,
    @Body() dto: CreateCheckoutDto,
  ) {
    this.logger.log(`User ${user.id} creating checkout for plan ${dto.plan}`);

    // Valider le plan
    if (!['PREMIUM', 'PRO_SELLER', 'FREE'].includes(dto.plan)) {
      throw new BadRequestException('Invalid plan. Use PREMIUM, PRO_SELLER or FREE');
    }

    // Le plan FREE ne nécessite pas de paiement
    if (dto.plan === 'FREE') {
      await this.service.upgradePlan(user.id, SubscriptionPlan.FREE);
      return {
        success: true,
        message: 'Downgraded to FREE plan',
        plan: 'FREE',
      };
    }

    // URLs de redirection
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    
    // Créer la session Stripe
    const session = await this.stripeService.createTestCheckoutSession(
      dto.plan as SubscriptionPlan,
      `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      `${frontendUrl}/subscription/cancel`,
      user.id, // Passer userId pour le webhook
    );

    return {
      checkoutUrl: session.url,
      sessionId: session.sessionId,
      displayPrice: session.displayPrice,
      plan: dto.plan,
    };
  }

  // --------------------------
  // VÉRIFIER UNE SESSION APRÈS PAIEMENT
  // --------------------------

  @Get('verify-session')
  @ApiOperation({ 
    summary: 'Verify checkout session',
    description: 'Vérifie le statut d\'une session après redirection'
  })
  async verifySession(
    @Query('sessionId') sessionId: string,
    @GetUser() user: any,
  ) {
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    this.logger.log(`Verifying session ${sessionId} for user ${user.id}`);

    const session = await this.stripeService.verifyCheckoutSession(sessionId);

    if (session.status !== 'paid') {
      return {
        success: false,
        message: 'Payment not completed',
        status: session.status,
      };
    }

    // Activer l'abonnement si pas déjà fait par le webhook
    if (session.userId === user.id && session.plan) {
      await this.service.upgradePlan(user.id, session.plan, {
        subscriptionId: session.subscriptionId,
        customerId: session.customerId,
      });
    }

    return {
      success: true,
      message: `Successfully subscribed to ${session.plan}`,
      plan: session.plan,
      subscriptionId: session.subscriptionId,
    };
  }

  // --------------------------
  // CUSTOMER PORTAL (Gestion abonnement)
  // --------------------------

  @Get('portal')
  @ApiOperation({ 
    summary: 'Get Stripe Customer Portal URL',
    description: 'Retourne l\'URL du portail Stripe pour gérer l\'abonnement'
  })
  async getPortalUrl(@GetUser() user: any) {
    const subscription = await this.service.getSubscription(user.id);

    if (!subscription.stripeCustomerId) {
      throw new BadRequestException('No active Stripe subscription found');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    // Créer une session Customer Portal
    const stripe = new (require('stripe'))(this.configService.get<string>('STRIPE_SECRET_KEY'));
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${frontendUrl}/subscription`,
    });

    return {
      portalUrl: session.url,
    };
  }

  // --------------------------
  // GET : Infos abonnement
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

  @Get('plans')
  @ApiOperation({ summary: 'Get all available subscription plans' })
  async getPlans() {
    return {
      plans: [
        {
          id: SubscriptionPlan.FREE,
          name: 'Free Pack',
          price: 0,
          priceDisplay: 'Gratuit',
          features: {
            clothesDetection: 5,
            outfitSuggestions: 3,
            storeSelling: 3,
          },
          color: '#9CA3AF',
          description: 'Plan de base avec fonctionnalités limitées',
        },
        {
          id: SubscriptionPlan.PREMIUM,
          name: 'Premium',
          price: 30,
          priceDisplay: '30 TND/mois',
          features: {
            clothesDetection: 'illimité',
            outfitSuggestions: 'illimité',
            storeSelling: 3,
          },
          color: '#CA3C66',
          description: 'Détection et suggestions illimitées',
        },
        {
          id: SubscriptionPlan.PRO_SELLER,
          name: 'Pro Seller',
          price: 90,
          priceDisplay: '90 TND/mois',
          features: {
            clothesDetection: 'illimité',
            outfitSuggestions: 'illimité',
            storeSelling: 'illimité',
          },
          color: '#4AA3A2',
          description: 'Toutes les fonctionnalités + vente illimitée',
        },
      ],
    };
  }

  // --------------------------
  // GET : Quotas
  // --------------------------

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

  // --------------------------
  // PATCH : Mise à jour manuelle (Admin/Debug)
  // --------------------------

  @Patch('me')
  @ApiOperation({ 
    summary: 'Update subscription plan manually (Admin/Debug)',
    description: 'In production, use create-checkout-session instead'
  })
  async updateSubscription(
    @GetUser() user: any,
    @Body() updateDto: UpdateSubscriptionDto
  ) {
    const normalizedPlan = updateDto.plan.trim().toUpperCase().replace(/-/g, '_') as SubscriptionPlan;

    if (!Object.values(SubscriptionPlan).includes(normalizedPlan)) {
      throw new BadRequestException('Invalid plan');
    }

    const subscription = await this.service.upgradePlan(user.id, normalizedPlan);

    return {
      message: 'Subscription updated successfully',
      subscription: {
        plan: subscription.plan,
        subscribedAt: subscription.subscribedAt,
        expiresAt: subscription.expiresAt,
        isActive: subscription.isActive,
      },
    };
  }
}