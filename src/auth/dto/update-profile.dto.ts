import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsArray, IsIn, IsEmail, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Image de profil' })
  @IsOptional()
  readonly image?: any;

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
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(v => v.trim());
    }
    return value;
  })
  readonly preferences?: string[];


  @ApiPropertyOptional({
    description: 'Mot de passe (optionnel)',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  readonly password?: string;
}
