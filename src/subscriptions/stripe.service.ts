// src/subscriptions/stripe.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new Error('STRIPE_SECRET_KEY missing');
    this.stripe = new Stripe(key, { apiVersion: '2025-11-17.clover' });
  }

  async createTestCheckoutSession(plan: string, successUrl: string, cancelUrl: string) {
    const prices = {
      free: 0,
      premium: 999,
      pro_seller: 2999,
    };

    if (!(plan in prices)) throw new BadRequestException('Invalid plan');

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `Upgrade to ${plan.toUpperCase()}` },
            unit_amount: prices[plan],
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return session.url;
  }
}
