import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateClotheDto } from './create-clothe.dto';

export class UpdateClotheDto extends PartialType(CreateClotheDto) {
  @ApiPropertyOptional({
    description: 'The unique ID of the user who owns the clothing item (optional).',
    example: '6725c8f9a2d4b5f8e1234567',
  })
  userId?: string;

  @ApiPropertyOptional({
    description: 'The URL of the clothing image (optional).',
    example: 'https://example.com/images/updated_tshirt.jpg',
  })
  imageURL?: string;

  @ApiPropertyOptional({
    description: 'List of updated categories for the clothing item.',
    example: ['tshirt', 'summer', 'casual'],
    type: [String],
  })
  category?: string;

  @ApiPropertyOptional({
    description: 'Updated color of the clothing item (optional).',
    example: 'beige',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Updated style of the clothing item (optional).',
    example: 'modern',
  })
  style?: string;
}


