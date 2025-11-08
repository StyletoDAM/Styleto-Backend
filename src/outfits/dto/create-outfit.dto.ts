import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { Types } from 'mongoose';

export class CreateOutfitDto {
  @ApiProperty({
    description: 'The ID of the user who owns the outfit',
    example: '6731ab87c8e9b5e4f4a7a1cd',
  })
  @IsMongoId()
  userId: Types.ObjectId;

  @ApiProperty({
    description: 'List of clothing item IDs included in this outfit',
    example: ['6731ab87c8e9b5e4f4a7a1cd', '6731ab87c8e9b5e4f4a7a1cf'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  clothesIds?: Types.ObjectId[];

  @ApiProperty({
    description: 'The type of event this outfit is designed for (e.g., casual, business, party)',
    example: 'casual',
    required: false,
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiProperty({
    description: 'The type of weather this outfit is suitable for (e.g., sunny, rainy, cold)',
    example: 'sunny',
    required: false,
  })
  @IsOptional()
  @IsString()
  weatherType?: string;

  @ApiProperty({
    description: 'Status of the outfit suggestion',
    enum: ['accepted', 'rejected', 'pending'],
    default: 'pending',
  })
  @IsOptional()
  @IsEnum(['accepted', 'rejected', 'pending'])
  status?: string;
}
