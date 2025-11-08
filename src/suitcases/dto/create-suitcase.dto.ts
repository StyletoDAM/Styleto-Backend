import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
} from 'class-validator';

export class CreateSuitcaseDto {
  @ApiProperty({
    description: 'Name of the suitcase (example: "Trip to Paris")',
    example: 'Travel Bag Paris',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The ID of the user who owns the suitcase',
    example: '64f7b89a4f1d3a7c2d9e0001',
  })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'The ID of the associated event',
    example: '64f7b89a4f1d3a7c2d9e0123',
  })
  @IsMongoId()
  @IsNotEmpty()
  event: string;

  @ApiProperty({
    description: 'List of clothing IDs included in the suitcase',
    example: ['64f7b89a4f1d3a7c2d9e0456', '64f7b89a4f1d3a7c2d9e0789'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  clothes?: string[];
}
