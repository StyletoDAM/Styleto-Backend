import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class TopUpBalanceDto {
  @ApiProperty({
    description: 'Montant à ajouter au solde (en cents)',
    example: 5000,
    minimum: 1,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;
}