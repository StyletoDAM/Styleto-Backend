// src/subscriptions/webhook.controller.ts
import * as common from '@nestjs/common';
import type { Request, Response } from 'express';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlan } from './schemas/subscription.schema';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@common.Controller('webhooks')
export class WebhookController {
  private readonly logger = new common.Logger(WebhookController.name);

  constructor(
    private stripeService: StripeService,
    private subscriptionsService: SubscriptionsService,
    private configService: ConfigService,
  ) {}

  @common.Post('stripe')
  async handleStripeWebhook(
    @common.Req() req: common.RawBodyRequest<Request>,
    @common.Res() res: Response,
    @common.Headers('stripe-signature') signature: string,
  ) {
    this.logger.log('🔔 [WEBHOOK] Received from Stripe');

    if (!signature) {
      this.logger.error('❌ [WEBHOOK] Missing stripe-signature header');
      return res.status(400).send('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // ✅ SOLUTION ROBUSTE pour Render et toutes les plateformes
      let rawBody: Buffer;

      // Cas 1: req.rawBody existe (configuration NestJS avec rawBody: true)
      if (req.rawBody) {
        rawBody = req.rawBody;
        this.logger.log('📦 [WEBHOOK] Using req.rawBody');
      }
      // Cas 2: req.body est déjà un Buffer (middleware raw())
      else if (Buffer.isBuffer(req.body)) {
        rawBody = req.body;
        this.logger.log('📦 [WEBHOOK] Using req.body as Buffer');
      }
      // Cas 3: req.body est une string
      else if (typeof req.body === 'string') {
        rawBody = Buffer.from(req.body);
        this.logger.log('📦 [WEBHOOK] Converting req.body string to Buffer');
      }
      // Cas 4: req.body est un objet (déjà parsé)
      else {
        rawBody = Buffer.from(JSON.stringify(req.body));
        this.logger.log('📦 [WEBHOOK] Converting req.body object to Buffer');
      }

      this.logger.log(`📦 [WEBHOOK] Body length: ${rawBody.length} bytes`);

      // Vérifier la signature Stripe
      event = this.stripeService.constructWebhookEvent(rawBody, signature);

      this.logger.log(`✅ [WEBHOOK] Event verified: ${event.type}`);
    } catch (err) {
      this.logger.error(`❌ [WEBHOOK] Signature verification failed: ${err.message}`);
      this.logger.error(`   Signature (first 20 chars): ${signature?.substring(0, 20)}...`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Traiter l'événement
    try {
      await this.processWebhookEvent(event);
      
      this.logger.log(`✅ [WEBHOOK] Event processed successfully: ${event.type}`);
      return res.status(200).json({ received: true });
    } catch (error) {
      this.logger.error(`❌ [WEBHOOK] Processing error: ${error.message}`);
      this.logger.error(`   Stack: ${error.stack}`);
      // Retourner 200 pour éviter les retry infinis de Stripe
      return res.status(200).json({ received: true, error: error.message });
    }
  }

  private async processWebhookEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        this.logger.log(`🔔 [WEBHOOK] Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    this.logger.log(`💳 [WEBHOOK] Checkout completed: ${session.id}`);
    this.logger.log(`   Metadata: ${JSON.stringify(session.metadata)}`);

    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan as SubscriptionPlan;
    const interval = (session.metadata?.interval as 'month' | 'year') || 'month';

    if (!userId || !plan) {
      this.logger.error('❌ [WEBHOOK] Missing userId or plan in metadata');
      this.logger.error(`   userId: ${userId}`);
      this.logger.error(`   plan: ${plan}`);
      this.logger.error(`   Full metadata: ${JSON.stringify(session.metadata)}`);
      return;
    }

    try {
      await this.subscriptionsService.upgradePlan(userId, plan, {
        subscriptionId: session.subscription as string,
        customerId: session.customer as string,
      }, interval);

      this.logger.log(`✅ [WEBHOOK] User ${userId} upgraded to ${plan} (${interval})`);
    } catch (error) {
      this.logger.error(`❌ [WEBHOOK] Failed to upgrade user ${userId}: ${error.message}`);
      this.logger.error(`   Stack: ${error.stack}`);
      throw error;
    }
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    this.logger.log(`🆕 [WEBHOOK] Subscription created: ${subscription.id}`);

    const userId = subscription.metadata?.userId;
    const plan = subscription.metadata?.plan as SubscriptionPlan;
    const interval = (subscription.metadata?.interval as 'month' | 'year') || 'month';

    if (!userId || !plan) {
      this.logger.error('❌ [WEBHOOK] Missing userId or plan in metadata');
      return;
    }

    try {
      await this.subscriptionsService.upgradePlan(userId, plan, {
        subscriptionId: subscription.id,
        customerId: subscription.customer as string,
      }, interval);

      this.logger.log(`✅ [WEBHOOK] Subscription ${subscription.id} created for user ${userId}`);
    } catch (error) {
      this.logger.error(`❌ [WEBHOOK] Failed to create subscription: ${error.message}`);
      throw error;
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    this.logger.log(`🔄 [WEBHOOK] Subscription updated: ${subscription.id}`);

    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.error('❌ [WEBHOOK] Missing userId in metadata');
      return;
    }

    if (subscription.status === 'active') {
      const plan = subscription.metadata?.plan as SubscriptionPlan;
      const interval = (subscription.metadata?.interval as 'month' | 'year') || 'month';
      
      if (plan) {
        try {
          await this.subscriptionsService.upgradePlan(userId, plan, {
            subscriptionId: subscription.id,
            customerId: subscription.customer as string,
          }, interval);

          this.logger.log(`✅ [WEBHOOK] Subscription ${subscription.id} updated for user ${userId}`);
        } catch (error) {
          this.logger.error(`❌ [WEBHOOK] Failed to update subscription: ${error.message}`);
          throw error;
        }
      }
    } else if (subscription.status === 'canceled' || subscription.cancel_at_period_end) {
      this.logger.log(`⚠️ [WEBHOOK] Subscription ${subscription.id} will be canceled`);
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    this.logger.log(`🗑️ [WEBHOOK] Subscription deleted: ${subscription.id}`);

    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.error('❌ [WEBHOOK] Missing userId in metadata');
      return;
    }

    try {
      await this.subscriptionsService.upgradePlan(userId, SubscriptionPlan.FREE);
      this.logger.log(`✅ [WEBHOOK] User ${userId} downgraded to FREE`);
    } catch (error) {
      this.logger.error(`❌ [WEBHOOK] Failed to downgrade user: ${error.message}`);
      throw error;
    }
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    this.logger.log(`💰 [WEBHOOK] Payment succeeded for invoice: ${invoice.id}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    this.logger.error(`❌ [WEBHOOK] Payment failed for invoice: ${invoice.id}`);
    
    const subscriptionId = invoice.lines?.data[0]?.subscription as string | undefined;
    if (!subscriptionId) {
      this.logger.warn('⚠️ [WEBHOOK] Invoice not linked to a subscription');
      return;
    }

    this.logger.log(`⚠️ [WEBHOOK] Payment failed - Attempt ${invoice.attempt_count}/3 for subscription ${subscriptionId}`);
    
    // Après 3 échecs, retourner au FREE
    if (invoice.attempt_count >= 3) {
      try {
        const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        if (!stripeKey) {
          this.logger.error('❌ [WEBHOOK] STRIPE_SECRET_KEY not found');
          return;
        }
        
        const stripe = new (require('stripe'))(stripeKey);
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        const userId = subscription.metadata?.userId;
        if (userId) {
          await this.subscriptionsService.upgradePlan(userId, SubscriptionPlan.FREE);
          await stripe.subscriptions.cancel(subscriptionId);
          this.logger.log(`✅ [WEBHOOK] User ${userId} downgraded to FREE after payment failure`);
        }
      } catch (error) {
        this.logger.error(`❌ [WEBHOOK] Failed to handle payment failure: ${error.message}`);
      }
    }
  }
}