import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({ description: 'ID de l\'article du store' })
  @IsNotEmpty()
  @IsString()
  storeItemId: string;
}

