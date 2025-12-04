// src/subscriptions/webhook.controller.ts
import * as common from '@nestjs/common';
import express from 'express';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlan } from './schemas/subscription.schema';
import Stripe from 'stripe';

@common.Controller('webhooks')
export class WebhookController {
  private readonly logger = new common.Logger(WebhookController.name);

  constructor(
    private stripeService: StripeService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  @common.Post('stripe')
  async handleStripeWebhook(
    @common.Req() req: common.RawBodyRequest<express.Request>,
    @common.Res() res: express.Response,
    @common.Headers('stripe-signature') signature: string,
  ) {
    this.logger.log('🔔 Webhook reçu de Stripe');

    if (!signature) {
      this.logger.error('❌ Signature Stripe manquante');
      return res.status(common.HttpStatus.BAD_REQUEST).send('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Récupérer le raw body
      const rawBody = req.rawBody || req.body;
      
      // Vérifier la signature du webhook
      event = this.stripeService.constructWebhookEvent(
        Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(JSON.stringify(rawBody)),
        signature,
      );

      this.logger.log(`✅ Event vérifié : ${event.type}`);
    } catch (err) {
      this.logger.error(`⚠️ Erreur vérification signature : ${err.message}`);
      return res.status(common.HttpStatus.BAD_REQUEST).send(`Webhook Error: ${err.message}`);
    }

    // Traiter l'événement selon son type
    try {
      switch (event.type) {
        // --------------------------
        // NOUVELLE SOUSCRIPTION
        // --------------------------
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        // --------------------------
        // MISE À JOUR D'ABONNEMENT
        // --------------------------
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        // --------------------------
        // ANNULATION D'ABONNEMENT
        // --------------------------
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        // --------------------------
        // PAIEMENT RÉUSSI
        // --------------------------
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        // --------------------------
        // ÉCHEC DE PAIEMENT
        // --------------------------
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          this.logger.log(`🔔 Event non géré : ${event.type}`);
      }

      // Toujours retourner 200 pour confirmer la réception
      return res.status(common.HttpStatus.OK).json({ received: true });
    } catch (error) {
      this.logger.error(`❌ Erreur traitement webhook : ${error.message}`);
      // Même en cas d'erreur, retourner 200 pour éviter les retry Stripe
      return res.status(common.HttpStatus.OK).json({ received: true, error: error.message });
    }
  }

  // --------------------------
  // HANDLERS PRIVÉS
  // --------------------------

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    this.logger.log(`💳 Checkout completed : ${session.id}`);

    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan as SubscriptionPlan;

    if (!userId || !plan) {
      this.logger.error('❌ Missing userId or plan in session metadata');
      return;
    }

    // Activer l'abonnement dans la BDD
    await this.subscriptionsService.upgradePlan(userId, plan, {
      subscriptionId: session.subscription as string,
      customerId: session.customer as string,
    });

    this.logger.log(`✅ User ${userId} upgraded to ${plan}`);
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    this.logger.log(`🆕 Subscription created: ${subscription.id}`);

    const userId = subscription.metadata?.userId;
    const plan = subscription.metadata?.plan as SubscriptionPlan;

    if (!userId || !plan) {
      this.logger.error('❌ Missing userId or plan in subscription metadata');
      return;
    }

    await this.subscriptionsService.upgradePlan(userId, plan, {
      subscriptionId: subscription.id,
      customerId: subscription.customer as string,
    });

    this.logger.log(`✅ Subscription ${subscription.id} created for user ${userId}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    this.logger.log(`🔄 Subscription updated: ${subscription.id}`);

    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.error('❌ Missing userId in subscription metadata');
      return;
    }

    // Vérifier le statut de l'abonnement
    if (subscription.status === 'active') {
      const plan = subscription.metadata?.plan as SubscriptionPlan;
      
      if (plan) {
        await this.subscriptionsService.upgradePlan(userId, plan, {
          subscriptionId: subscription.id,
          customerId: subscription.customer as string,
        });

        this.logger.log(`✅ Subscription ${subscription.id} updated for user ${userId}`);
      }
    } else if (subscription.status === 'canceled' || subscription.cancel_at_period_end) {
      this.logger.log(`⚠️ Subscription ${subscription.id} will be canceled`);
      // L'annulation effective sera gérée par customer.subscription.deleted
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    this.logger.log(`🗑️ Subscription deleted: ${subscription.id}`);

    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.error('❌ Missing userId in subscription metadata');
      return;
    }

    // Retour au plan gratuit
    await this.subscriptionsService.upgradePlan(userId, SubscriptionPlan.FREE);

    this.logger.log(`✅ User ${userId} downgraded to FREE plan`);
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    this.logger.log(`💰 Payment succeeded for invoice: ${invoice.id}`);

    // Récupérer le subscription ID depuis le premier line item (pour invoices de subscription)
    const subscriptionId = invoice.lines?.data[0]?.subscription as string | undefined;
    if (!subscriptionId) {
      this.logger.warn('⚠️ Invoice not linked to a subscription');
      return;
    }

    this.logger.log(`✅ Payment confirmed for subscription ${subscriptionId}`);
    // La prolongation de période est automatiquement gérée par Stripe
    // TODO: Si besoin, prolonge manuellement ou notifie l'user
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    this.logger.error(`❌ Payment failed for invoice: ${invoice.id}`);

    // Récupérer le subscription ID depuis le premier line item (pour invoices de subscription)
    const subscriptionId = invoice.lines?.data[0]?.subscription as string | undefined;
    if (!subscriptionId) {
      this.logger.warn('⚠️ Invoice not linked to a subscription');
      return;
    }

    this.logger.log(`⚠️ Payment failed - Attempt ${invoice.attempt_count} for subscription ${subscriptionId}`);
    
    // TODO: Envoyer notification à l'utilisateur
    // TODO: Suspendre accès après X tentatives (selon vos règles métier)
    
    // Stripe réessaiera automatiquement selon vos paramètres
  }
}