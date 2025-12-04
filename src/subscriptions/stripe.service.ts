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
    interval: 'month' | 'year' = 'month', // ✨ NOUVEAU : Intervalle de facturation
  ) {
    this.logger.log(`Creating checkout session for plan: ${plan}, userId: ${userId}`);

    // ✅ S'assurer que userId est bien une string
    const userIdString = userId ? String(userId) : '';
    
    this.logger.log(`UserID converted to string: ${userIdString}`);

    // ✅ Prix mensuels en TND (affichage) → convertis en centimes USD pour Stripe
    const monthlyPricesInTND: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PREMIUM]: 30, // 30 TND/mois
      [SubscriptionPlan.PRO_SELLER]: 90, // 90 TND/mois
    };

    // ✅ Prix annuels en TND avec 20% de réduction
    const annualPricesInTND: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PREMIUM]: Math.round(30 * 12 * 0.8), // 288 TND/an (20% de réduction)
      [SubscriptionPlan.PRO_SELLER]: Math.round(90 * 12 * 0.8), // 864 TND/an (20% de réduction)
    };

    // ✅ Conversion approximative TND → USD (1 TND ≈ 0.32 USD)
    const monthlyPricesInUSDCents: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PREMIUM]: 999, // ~10 USD
      [SubscriptionPlan.PRO_SELLER]: 2899, // ~29 USD
    };

    // ✅ Prix annuels en USD avec 20% de réduction
    const annualPricesInUSDCents: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PREMIUM]: Math.round(999 * 12 * 0.8), // ~9600 USD cents
      [SubscriptionPlan.PRO_SELLER]: Math.round(2899 * 12 * 0.8), // ~27830 USD cents
    };

    // ✨ Sélectionner les prix selon l'intervalle
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

    // ✨ NOUVEAU : Nom et description selon l'intervalle
    const intervalLabel = interval === 'year' ? 'an' : 'mois';
    const intervalText = interval === 'year' ? 'annuel' : 'mensuel';
    const productName = interval === 'year' 
      ? `${planNames[plan]} - ${pricesInTND[plan]} TND/an (Économisez 20%!)`
      : `${planNames[plan]} - ${pricesInTND[plan]} TND/mois`;

    try {
      // ✅ Création de la session Stripe avec metadata en string
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: productName, // ✨ Utiliser le nom dynamique
                description: `${planDescriptions[plan]} - Paiement ${intervalText}`,
                images: ['https://i.imgur.com/EbQKFLt.png'],
              },
              unit_amount: pricesInUSDCents[plan],
              recurring: {
                interval: interval, // ✨ Utiliser le paramètre interval
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          plan: plan,
          userId: userIdString, // ✅ Toujours une string
          priceDisplayedTND: pricesInTND[plan].toString(),
          interval: interval, // ✨ NOUVEAU : Stocker l'intervalle dans metadata
        },
      });

      this.logger.log(`Checkout session created: ${session.id}`);

      return { 
        url: session.url, 
        sessionId: session.id,
        displayPrice: interval === 'year' 
          ? `${pricesInTND[plan]} TND/an (Économisez 20%!)`
          : `${pricesInTND[plan]} TND/mois`,
        interval: interval, // ✨ NOUVEAU : Retourner l'intervalle
      };
    } catch (error) {
      this.logger.error(`Error creating checkout session: ${error.message}`);
      throw new BadRequestException(`Failed to create checkout session: ${error.message}`);
    }
  }

  /**
   * Vérifie la signature du webhook Stripe
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      this.logger.warn('⚠️ STRIPE_WEBHOOK_SECRET non défini, webhook non sécurisé');
      // En développement, on peut parser directement
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
      interval: (session.metadata?.interval as 'month' | 'year') || 'month', // ✨ NOUVEAU : Récupérer l'intervalle
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