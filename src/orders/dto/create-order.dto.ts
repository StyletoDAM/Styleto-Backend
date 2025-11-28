import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNumber, Min } from 'class-validator';
import { Types } from 'mongoose';

export class CreateOrderDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'The ID of the clothes item being ordered'
  })
  @IsMongoId({ message: 'clothesId must be a valid MongoDB ID' })
  clothesId: string;

  @ApiProperty({
    example: 99.99,
    description: 'The price of the order',
    minimum: 0
  })
  @IsNumber({}, { message: 'price must be a number' })
  @Min(0, { message: 'price must be greater than or equal to 0' })
  price: number;
}

