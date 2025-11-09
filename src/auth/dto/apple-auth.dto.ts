import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail } from 'class-validator';

export class AppleAuthDto {
  @ApiProperty({ example: 'eyJ...' })
  @IsString()
  readonly identityToken: string;  

  @ApiProperty({ example: 'Salma Mahjoub', required: false })
  @IsString()
  @IsOptional()
  readonly fullName?: string;

  @ApiProperty({ example: 's.mahjoub@icloud.com', required: false })
  @IsEmail()
  @IsOptional()
  readonly email?: string;
}