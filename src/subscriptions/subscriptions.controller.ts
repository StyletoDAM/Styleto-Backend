// src/subscriptions/subscriptions.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { SubscriptionPlan } from './schemas/subscription.schema';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

// ✅ DTO pour le paiement simulé
class SimulatePaymentDto {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

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
  @ApiOperation({ summary: 'Get all available subscription plans (in TND)' })
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
  // POST : Paiement simulé (pour projet académique)
  // --------------------------

  @Post('purchase/:plan')
  @ApiOperation({ 
    summary: 'Simulate payment and activate plan (Academic project)',
    description: 'Use card number 4242424242424242 for test payment'
  })
  async simulatePurchase(
    @Param('plan') plan: string,
    @Body() paymentData: SimulatePaymentDto,
    @GetUser() user: any,
  ) {
    const normalizedPlan = this.normalizePlan(plan);

    // ✅ Validation de la carte de test Stripe
    const validTestCards = [
      '4242424242424242',
      '4242 4242 4242 4242',
      '4242-4242-4242-4242',
    ];

    const cleanCardNumber = paymentData.cardNumber.replace(/[\s-]/g, '');

    if (!validTestCards.some(card => card.replace(/[\s-]/g, '') === cleanCardNumber)) {
      throw new BadRequestException({
        success: false,
        message: 'Carte invalide. Utilisez 4242 4242 4242 4242 pour les tests.',
      });
    }

    // ✅ Validation CVV (3 chiffres)
    if (!/^\d{3,4}$/.test(paymentData.cvv)) {
      throw new BadRequestException({
        success: false,
        message: 'CVV invalide. Entrez 3 ou 4 chiffres.',
      });
    }

    // ✅ Validation date d'expiration (format MM/YY ou MM/YYYY)
    if (!/^\d{2}\/\d{2,4}$/.test(paymentData.expiryDate)) {
      throw new BadRequestException({
        success: false,
        message: 'Date d\'expiration invalide. Format attendu: MM/YY',
      });
    }

    // ✅ Simulation de délai réseau (pour réalisme)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // ✅ Activer l'abonnement
    const subscription = await this.service.upgradePlan(user.id, normalizedPlan, {
      subscriptionId: `test_sub_${Date.now()}`,
      customerId: `test_cus_${user.id}`,
    });

    // ✅ Récupérer les infos du plan
    const planDetails = {
      [SubscriptionPlan.FREE]: { name: 'Free Pack', price: 0 },
      [SubscriptionPlan.PREMIUM]: { name: 'Premium', price: 30 },
      [SubscriptionPlan.PRO_SELLER]: { name: 'Pro Seller', price: 90 },
    };

    return {
      success: true,
      message: `🎉 Paiement réussi ! Vous êtes maintenant abonné au plan ${planDetails[normalizedPlan].name}.`,
      transaction: {
        id: `txn_${Date.now()}`,
        amount: planDetails[normalizedPlan].price,
        currency: 'TND',
        plan: normalizedPlan,
        date: new Date().toISOString(),
        cardLast4: cleanCardNumber.slice(-4),
      },
      subscription: {
        plan: subscription.plan,
        subscribedAt: subscription.subscribedAt,
        expiresAt: subscription.expiresAt,
        isActive: subscription.isActive,
      },
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
  // PATCH : Mettre à jour l'abonnement
  // --------------------------

  @Patch('me')
  @ApiOperation({ 
    summary: 'Update subscription plan',
    description: 'Change the user subscription plan. Example: { "plan": "PREMIUM" } or { "plan": "PRO_SELLER" }'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        plan: {
          type: 'string',
          enum: ['FREE', 'PREMIUM', 'PRO_SELLER'],
          example: 'PREMIUM',
          description: 'The subscription plan to set'
        }
      },
      required: ['plan'],
      example: {
        plan: 'PREMIUM'
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Subscription updated successfully' },
        subscription: {
          type: 'object',
          properties: {
            plan: { type: 'string', example: 'PREMIUM' },
            subscribedAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
            isActive: { type: 'boolean', example: true }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid plan',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid plan' }
      }
    }
  })
  async updateSubscription(
    @GetUser() user: any,
    @Body() updateDto: UpdateSubscriptionDto
  ) {
    // Le DTO avec @IsEnum valide déjà le plan, mais on normalise quand même pour être sûr
    const normalizedPlan = this.normalizePlan(updateDto.plan);

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