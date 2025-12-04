// src/subscriptions/subscriptions.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { UserModule } from '../user/user.module';
import { StripeService } from './stripe.service'; 
import { ConfigModule } from '@nestjs/config';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    ConfigModule,
    forwardRef(() => UserModule),
  ],
  controllers: [SubscriptionsController,WebhookController,],
  providers: [SubscriptionsService,StripeService],
  exports: [SubscriptionsService], // Important pour l'utiliser dans d'autres modules
})
export class SubscriptionsModule {}
