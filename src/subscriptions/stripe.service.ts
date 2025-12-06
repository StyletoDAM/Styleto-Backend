// src/subscriptions/stripe.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan } from './schemas/subscription.schema';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new Error('STRIPE_SECRET_KEY missing in .env');
    
    this.stripe = new Stripe(key, { 
      apiVersion: '2025-11-17.clover'
    });
    
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
  }

  /**
   * Crée une session Stripe Checkout en MODE TEST
   * Prix affichés en TND mais traités en USD pour Stripe Test
   */
  async createTestCheckoutSession(
    plan: SubscriptionPlan,
    successUrl: string,
    cancelUrl: string,
    userId?: string,
    interval: 'month' | 'year' = 'month',
  ) {
    this.logger.log(`Creating checkout session for plan: ${plan}, userId: ${userId}`);

    const userIdString = userId ? String(userId) : '';
    this.logger.log(`UserID converted to string: ${userIdString}`);

    // Prix mensuels en TND
    const monthlyPricesInTND: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PREMIUM]: 30,
      [SubscriptionPlan.PRO_SELLER]: 90,
    };

    // Prix annuels en TND avec 20% de réduction
    const annualPricesInTND: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PREMIUM]: Math.round(30 * 12 * 0.8), // 288 TND/an
      [SubscriptionPlan.PRO_SELLER]: Math.round(90 * 12 * 0.8), // 864 TND/an
    };

    // Conversion TND → USD
    const monthlyPricesInUSDCents: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PREMIUM]: 999, // ~10 USD
      [SubscriptionPlan.PRO_SELLER]: 2899, // ~29 USD
    };

    const annualPricesInUSDCents: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PREMIUM]: Math.round(999 * 12 * 0.8),
      [SubscriptionPlan.PRO_SELLER]: Math.round(2899 * 12 * 0.8),
    };

    const pricesInTND = interval === 'year' ? annualPricesInTND : monthlyPricesInTND;
    const pricesInUSDCents = interval === 'year' ? annualPricesInUSDCents : monthlyPricesInUSDCents;

    if (!(plan in pricesInTND)) {
      throw new BadRequestException(`Invalid plan: ${plan}`);
    }

    const planNames: Record<SubscriptionPlan, string> = {
      [SubscriptionPlan.FREE]: 'Free Pack',
      [SubscriptionPlan.PREMIUM]: 'Premium',
      [SubscriptionPlan.PRO_SELLER]: 'Pro Seller',
    };

    const planDescriptions: Record<SubscriptionPlan, string> = {
      [SubscriptionPlan.FREE]: 'Plan gratuit avec limites',
      [SubscriptionPlan.PREMIUM]: 'Détection illimitée + Suggestions illimitées',
      [SubscriptionPlan.PRO_SELLER]: 'Toutes les fonctionnalités + Vente illimitée',
    };

    const intervalText = interval === 'year' ? 'annuel' : 'mensuel';
    const productName = interval === 'year' 
      ? `${planNames[plan]} - ${pricesInTND[plan]} TND/an (Économisez 20%!)`
      : `${planNames[plan]} - ${pricesInTND[plan]} TND/mois`;

    try {
      // ✨ MODIFICATION IMPORTANTE : Ajouter subscription_data pour copier les metadata
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: productName,
                description: `${planDescriptions[plan]} - Paiement ${intervalText}`,
                images: ['https://i.imgur.com/EbQKFLt.png'],
              },
              unit_amount: pricesInUSDCents[plan],
              recurring: {
                interval: interval,
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        
        // ✅ Metadata sur la session (pour checkout.session.completed)
        metadata: {
          plan: plan,
          userId: userIdString,
          priceDisplayedTND: pricesInTND[plan].toString(),
          interval: interval,
        },
        
        // ✨ NOUVEAU : Copier les metadata vers la subscription automatiquement
        subscription_data: {
          metadata: {
            plan: plan,
            userId: userIdString,
            priceDisplayedTND: pricesInTND[plan].toString(),
            interval: interval,
          },
        },
      });

      this.logger.log(`✅ Checkout session created: ${session.id}`);
      this.logger.log(`   📦 Plan: ${plan}, User: ${userIdString}, Interval: ${interval}`);

      return { 
        url: session.url, 
        sessionId: session.id,
        displayPrice: interval === 'year' 
          ? `${pricesInTND[plan]} TND/an (Économisez 20%!)`
          : `${pricesInTND[plan]} TND/mois`,
        interval: interval,
      };
    } catch (error) {
      this.logger.error(`❌ Error creating checkout session: ${error.message}`);
      throw new BadRequestException(`Failed to create checkout session: ${error.message}`);
    }
  }

  /**
   * Vérifie la signature du webhook Stripe
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      this.logger.warn('⚠️ STRIPE_WEBHOOK_SECRET non défini, webhook non sécurisé');
      return JSON.parse(payload.toString()) as Stripe.Event;
    }

    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }
  }

  /**
   * Vérifie une session Stripe après redirection
   */
  async verifyCheckoutSession(sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    
    return {
      status: session.payment_status,
      plan: session.metadata?.plan as SubscriptionPlan,
      userId: session.metadata?.userId,
      priceDisplayedTND: session.metadata?.priceDisplayedTND,
      subscriptionId: session.subscription as string,
      customerId: session.customer as string,
      interval: (session.metadata?.interval as 'month' | 'year') || 'month',
    };
  }

  /**
   * Crée un PaymentIntent (pour paiement unique, optionnel)
   */
  async createPaymentIntent(amount: number, currency = 'usd') {
    return await this.stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['card'],
    });
  }

  /**
   * Annule une souscription Stripe
   */
  async cancelSubscription(subscriptionId: string) {
    return await this.stripe.subscriptions.cancel(subscriptionId);
  }
}