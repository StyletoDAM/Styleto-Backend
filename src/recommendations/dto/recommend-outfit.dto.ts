import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class RecommendOutfitDto {
  @ApiProperty({
    description: 'Style préféré de l\'utilisateur',
    enum: ['casual', 'formal', 'sport'],
    example: 'casual',
    examples: {
      casual: {
        value: 'casual',
        description: 'Style décontracté pour un look quotidien',
      },
      formal: {
        value: 'formal',
        description: 'Style formel pour un événement professionnel',
      },
      sport: {
        value: 'sport',
        description: 'Style sportif pour une activité physique',
      },
    },
  })
  @IsString()
  @IsIn(['casual', 'formal', 'sport' ,'elegant','bohemian','vintage','modern'])
  preference: string;

  @ApiProperty({
    description: 'Ville pour la météo (optionnel, défaut: Tunis). Si non fourni, utilise Tunis par défaut.',
    example: 'Tunis',
    required: false,
    examples: {
      tunis: {
        value: 'Tunis',
        description: 'Ville de Tunis (défaut)',
      },
      paris: {
        value: 'Paris',
        description: 'Ville de Paris',
      },
      newYork: {
        value: 'New York',
        description: 'Ville de New York',
      },
    },
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'Température simulée en degrés Celsius (optionnel). Si non fourni, utilise l\'API météo avec la ville spécifiée.',
    example: 25,
    required: false,
    examples: {
      summer: {
        value: 30,
        description: 'Température estivale (30°C)',
      },
      winter: {
        value: 5,
        description: 'Température hivernale (5°C)',
      },
      spring: {
        value: 20,
        description: 'Température printanière (20°C)',
      },
    },
  })
  @IsNumber()
  @IsOptional()
  temperature?: number;
}

