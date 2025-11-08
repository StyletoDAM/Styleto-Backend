import { IsArray, IsMongoId, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClotheDto {
  @ApiProperty({
    description: 'The unique ID of the user who owns the clothing item.',
    example: '6725c8f9a2d4b5f8e1234567',
  })
  @IsMongoId()
  userId: string;

  @ApiProperty({
    description: 'The URL of the clothing image.',
    example: 'https://example.com/images/tshirt_white.jpg',
  })
  @IsUrl()
  imageURL: string;

  @ApiProperty({
    description: 'List of categories describing the clothing item.',
    example: ['tshirt', 'casual'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  category: string[];

  @ApiProperty({
    description: 'Color of the clothing item (optional).',
    example: 'white',
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    description: 'Style of the clothing item (optional).',
    example: 'minimalist',
    required: false,
  })
  @IsOptional()
  @IsString()
  style?: string;
}

