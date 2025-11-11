import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from 'src/common/middleware/validators/is-strong-password.validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Jeton temporaire obtenu après validation de l’OTP SMS' })
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  @ApiProperty({
    description: 'Nouveau mot de passe respectant la politique de sécurité',
    minLength: 6,
  })
  @IsString()
  @IsStrongPassword({
    message:
      'Le mot de passe doit contenir au moins 6 caractères, une majuscule et un caractère spécial.',
  })
  newPassword: string;
}

