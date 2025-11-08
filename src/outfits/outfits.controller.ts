import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OutfitsService } from './outfits.service';
import { CreateOutfitDto } from './dto/create-outfit.dto';
import { UpdateOutfitDto } from './dto/update-outfit.dto';
import { Outfit } from './schemas/outfits.schema';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Outfits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('outfits')
export class OutfitsController {
  constructor(private readonly outfitsService: OutfitsService) {}

  // ------------------ CREATE ------------------
  @Post()
  @ApiOperation({ summary: 'Create a new outfit' })
  @ApiBody({ type: CreateOutfitDto })
  @ApiResponse({ status: 201, description: 'Outfit successfully created', type: Outfit })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(@Body() createOutfitDto: CreateOutfitDto): Promise<Outfit> {
    return this.outfitsService.create(createOutfitDto);
  }

  // ------------------ FIND ALL ------------------
  @Get()
  @ApiOperation({ summary: 'Retrieve all outfits' })
  @ApiResponse({ status: 200, description: 'List of all outfits', type: [Outfit] })
  async findAll(): Promise<Outfit[]> {
    return this.outfitsService.findAll();
  }

  // ------------------ FIND ONE ------------------
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a specific outfit by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the outfit' })
  @ApiResponse({ status: 200, description: 'Outfit found', type: Outfit })
  @ApiResponse({ status: 404, description: 'Outfit not found' })
  async findOne(@Param('id') id: string): Promise<Outfit> {
    return this.outfitsService.findOne(id);
  }

  // ------------------ UPDATE ------------------
  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing outfit by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the outfit to update' })
  @ApiBody({ type: UpdateOutfitDto })
  @ApiResponse({ status: 200, description: 'Outfit successfully updated', type: Outfit })
  @ApiResponse({ status: 404, description: 'Outfit not found' })
  async update(
    @Param('id') id: string,
    @Body() updateOutfitDto: UpdateOutfitDto,
  ): Promise<Outfit> {
    return this.outfitsService.update(id, updateOutfitDto);
  }

  // ------------------ DELETE ------------------
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an outfit by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the outfit to delete' })
  @ApiResponse({ status: 200, description: 'Outfit successfully deleted', type: Outfit })
  @ApiResponse({ status: 404, description: 'Outfit not found' })
  async remove(@Param('id') id: string): Promise<Outfit> {
    return this.outfitsService.remove(id);
  }
}
