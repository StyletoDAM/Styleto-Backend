// src/subscriptions/dto/create-checkout.dto.ts
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
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

  @ApiProperty({
    description: 'Payment interval (monthly or yearly)',
    enum: ['month', 'year'],
    example: 'month',
    required: false,
    default: 'month'
  })
  @IsEnum(['month', 'year'], {
    message: 'Interval must be either "month" or "year"'
  })
  @IsOptional()
  interval?: 'month' | 'year' = 'month';
}