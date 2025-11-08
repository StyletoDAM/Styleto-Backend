import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateStoreDto {
  @ApiProperty({
    description: 'The ID of the user who owns the store item',
    example: '64f7b89a4f1d3a7c2d9e0123',
  })
  @IsMongoId()
  userId: string;

  @ApiProperty({
    description: 'The ID of the related clothing item',
    example: '64f7b89a4f1d3a7c2d9e0456',
  })
  @IsMongoId()
  clothesId: string;

  @ApiProperty({
    description: 'The price of the clothing item in the store',
    example: 49.99,
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    description: 'The availability status of the item',
    example: 'available',
    enum: ['available', 'sold'],
    default: 'available',
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;
}
