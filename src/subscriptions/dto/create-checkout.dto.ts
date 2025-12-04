// src/subscriptions/dto/create-checkout.dto.ts
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({
    description: 'Subscription plan to purchase',
    enum: ['PREMIUM', 'PRO_SELLER', 'FREE'],
    example: 'PREMIUM'
  })
  @IsEnum(['PREMIUM', 'PRO_SELLER', 'FREE'], {
    message: 'Plan must be one of: PREMIUM, PRO_SELLER, FREE'
  })
  @IsNotEmpty()
  plan: 'PREMIUM' | 'PRO_SELLER' | 'FREE';
}