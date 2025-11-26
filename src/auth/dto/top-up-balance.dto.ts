import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class TopUpBalanceDto {
  @ApiProperty({
    description: 'Montant à ajouter au solde (en TND)',
    example: 50.0,
    minimum: 0.1,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  amount: number;
}