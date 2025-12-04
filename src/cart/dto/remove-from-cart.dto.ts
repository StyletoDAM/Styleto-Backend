import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemoveFromCartDto {
  @ApiProperty({ description: 'ID de l\'article du store à retirer' })
  @IsNotEmpty()
  @IsString()
  storeItemId: string;
}

