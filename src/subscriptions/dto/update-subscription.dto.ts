import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { SubscriptionPlan } from '../schemas/subscription.schema';

export class UpdateSubscriptionDto {
  @ApiProperty({
    enum: SubscriptionPlan,
    enumName: 'SubscriptionPlan',
    example: 'PREMIUM',
    description: 'The subscription plan to set. Valid values: FREE, PREMIUM, PRO_SELLER'
  })
  @IsEnum(SubscriptionPlan, {
    message: 'plan must be one of: FREE, PREMIUM, PRO_SELLER'
  })
  @IsString()
  plan: SubscriptionPlan;
}

