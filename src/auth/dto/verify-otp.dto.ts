import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'utilisateur@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: 'Code OTP SMS (6 chiffres)' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Le code doit contenir exactement 6 chiffres.' })
  code: string;
}

