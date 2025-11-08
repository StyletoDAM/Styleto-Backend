import { PartialType } from '@nestjs/swagger';
import { CreateOutfitDto } from './create-outfit.dto';

export class UpdateOutfitDto extends PartialType(CreateOutfitDto) {}
