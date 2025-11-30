import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ConfirmPurchaseDto {
  @ApiProperty({ 
    enum: ['stripe', 'balance'], 
    description: 'Méthode de paiement choisie' 
  })
  @IsEnum(['stripe', 'balance'], { message: 'paymentMethod doit être "stripe" ou "balance"' })
  paymentMethod: 'stripe' | 'balance';

  @ApiPropertyOptional({ 
    description: 'Requis UNIQUEMENT pour Stripe. Ne pas envoyer pour balance.', 
    example: 'pi_3Pxxxxxx' 
  })
  @IsOptional()
  @IsString({ message: 'paymentIntentId must be a string' })
  paymentIntentId?: string;
}