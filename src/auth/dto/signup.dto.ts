import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { IsFullName } from 'src/common/middleware/validators/is-full-name.validator';
import { IsStrongPassword } from 'src/common/middleware/validators/is-strong-password.validator';
export class SignupDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsFullName({ message: 'Full name must contain at least two words separated by a space.' })
  @IsString()
  readonly fullName: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  readonly email: string;

  @ApiProperty({ minLength: 6 })
  @IsStrongPassword({ 
    message: 'Password must be at least 6 characters long and contain at least one uppercase letter and one special character.' 
  })
  @IsString()
  @MinLength(6)
  readonly password: string;

  @ApiProperty({ enum: ['male', 'female'] })
  @IsString()
  @IsIn(['male', 'female'])
  readonly gender: 'male' | 'female';

  @ApiProperty({ example: '+21652904114', description: 'Numéro de téléphone format international' })
  @IsString()
  @Matches(/^\+?\d{6,15}$/, {
    message: 'Le numéro de téléphone doit contenir entre 6 et 15 chiffres et peut commencer par +',
  })
  readonly phoneNumber: string;

  @ApiProperty({
    required: false,
    isArray: true,
    type: String,
    example: ['hiking', 'music'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly preferences?: string[];
}
