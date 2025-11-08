import { PartialType } from '@nestjs/mapped-types';
import { CreateSuitcaseDto } from './create-suitcase.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsMongoId, IsArray } from 'class-validator';

export class UpdateSuitcaseDto extends PartialType(CreateSuitcaseDto) {
  @ApiPropertyOptional({
    description: 'Updated name of the suitcase',
    example: 'Business Trip Rome',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated user ID associated with the suitcase',
    example: '64f7b89a4f1d3a7c2d9e0123',
  })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Updated event ID associated with the suitcase',
    example: '64f7b89a4f1d3a7c2d9e0999',
  })
  @IsOptional()
  @IsMongoId()
  event?: string;

  @ApiPropertyOptional({
    description: 'Updated list of clothing items in the suitcase',
    example: ['64f7b89a4f1d3a7c2d9e0456'],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  clothes?: string[];
}
