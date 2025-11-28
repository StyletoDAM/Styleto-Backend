// src/subscriptions/stripe.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan } from './schemas/subscription.schema';

@Injectable()
export class StripeService {
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
    userId?: string, // ✅ AJOUT pour webhook
  ) {
    // ✅ Prix en TND (affichage) → convertis en centimes USD pour Stripe
    const pricesInTND: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PREMIUM]: 30, // 30 TND/mois
      [SubscriptionPlan.PRO_SELLER]: 90, // 90 TND/mois
    };

    // ✅ Conversion approximative TND → USD (1 TND ≈ 0.32 USD)
    const pricesInUSDCents: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PREMIUM]: 999, // ~10 USD
      [SubscriptionPlan.PRO_SELLER]: 2899, // ~29 USD
    };

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

    // ✅ Création de la session Stripe
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd', // ✅ Stripe Test ne supporte que USD/EUR/GBP
            product_data: {
              name: `${planNames[plan]} - ${pricesInTND[plan]} TND/mois`,
              description: planDescriptions[plan],
              images: ['https://i.imgur.com/EbQKFLt.png'], // Ton logo
            },
            unit_amount: pricesInUSDCents[plan],
            recurring: {
              interval: 'month',
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
        userId: userId || '', // ✅ Pour identifier l'utilisateur dans le webhook
        priceDisplayedTND: pricesInTND[plan].toString(),
      },
      // ✅ MODE TEST : Permet d'utiliser 4242 4242 4242 4242
      customer_email: undefined, // Optionnel : pré-remplir l'email
    });

    return { 
      url: session.url, 
      sessionId: session.id,
      displayPrice: `${pricesInTND[plan]} TND/mois`, // ✅ Pour affichage frontend
    };
  }

  /**
   * Vérifie la signature du webhook Stripe
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET non défini, webhook non sécurisé');
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
      status: session.payment_status, // 'paid' ou 'unpaid'
      plan: session.metadata?.plan as SubscriptionPlan,
      userId: session.metadata?.userId,
      priceDisplayedTND: session.metadata?.priceDisplayedTND,
      subscriptionId: session.subscription as string,
      customerId: session.customer as string,
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