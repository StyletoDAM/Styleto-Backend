import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { Types } from 'mongoose';

export class CreateEventDto {
  @ApiProperty({
    description: 'The name of the event',
    example: 'Business Conference 2025',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The start date and time of the event (ISO format)',
    example: '2025-11-15T09:00:00Z',
  })
  @IsDateString()
  startDate: Date;

  @ApiProperty({
    description: 'The end date and time of the event (ISO format)',
    example: '2025-11-16T17:00:00Z',
  })
  @IsDateString()
  endDate: Date;

  @ApiProperty({
    description: 'The location where the event takes place',
    example: 'Tunis, Tunisia',
  })
  @IsString()
  location: string;

  @ApiProperty({
    description: 'An optional description of the event',
    example: 'An annual conference focused on AI innovation.',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The ID of the user who created the event',
    example: '6724dcf9c82d5cfa9b57e2a1',
  })
  @IsString()
  userId: string; 
}
