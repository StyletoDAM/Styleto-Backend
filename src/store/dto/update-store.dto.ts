import { PartialType } from '@nestjs/mapped-types';
import { CreateStoreDto } from './create-store.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateStoreDto extends PartialType(CreateStoreDto) {
  @ApiPropertyOptional({
    description: 'The updated price of the clothing item',
    example: 39.99,
  })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({
    description: 'The updated status of the item',
    example: 'sold',
    enum: ['available', 'sold'],
  })
  @IsOptional()
  @IsString()
  status?: string;
}
