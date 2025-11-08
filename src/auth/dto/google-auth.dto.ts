import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ example: 'google_user_id_123456789' })
  @IsString()
  readonly googleId: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  readonly fullName: string;

  @ApiProperty({ example: 'john.doe@gmail.com' })
  @IsEmail()
  readonly email: string;

  @ApiProperty({ required: false, example: 'https://example.com/photo.jpg' })
  @IsOptional()
  @IsString()
  readonly profilePicture?: string;

  @ApiProperty({ required: false, enum: ['male', 'female'] })
  @IsOptional()
  @IsString()
  readonly gender?: 'male' | 'female';
}

