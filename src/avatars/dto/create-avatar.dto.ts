import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateAvatarDto {
  @ApiProperty({
    description: 'The ID of the user who owns this avatar',
    example: '671f9b6a9e2e4a0a2c123456',
  })
  @IsMongoId()
  userId: string;

  @ApiProperty({
    description: 'The URL of the avatar image',
    example: 'https://example.com/avatar.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageURL?: string;

  @ApiProperty({
    description: 'The visual style of the avatar (e.g., realistic, cartoon, 3D)',
    example: 'cartoon',
    required: false,
  })
  @IsOptional()
  @IsString()
  style?: string;

  @ApiProperty({
    description: 'The type of avatar: either "custom" or "default"',
    example: 'custom',
    default: 'default',
  })
  @IsOptional()
  @IsString()
  type?: string;
}
