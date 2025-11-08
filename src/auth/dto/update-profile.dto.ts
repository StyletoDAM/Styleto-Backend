import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  readonly fullName?: string;

  @ApiPropertyOptional({ example: 'jane.doe@example.com' })
  @IsOptional()
  @IsEmail()
  readonly email?: string;

  @ApiPropertyOptional({ enum: ['male', 'female'] })
  @IsOptional()
  @IsString()
  @IsIn(['male', 'female'])
  readonly gender?: 'male' | 'female';

  @ApiPropertyOptional({ example: '+21612345678' })
  @IsOptional()
  @IsString()
  readonly phoneNumber?: string;

  @ApiPropertyOptional({
    isArray: true,
    type: String,
    example: ['hiking', 'music'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly preferences?: string[];

  @ApiPropertyOptional({
    description:
      'Nouvelle valeur du mot de passe (optionnel). Doit contenir au moins 6 caractères.',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  readonly password?: string;
}
