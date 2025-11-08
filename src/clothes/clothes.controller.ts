import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ClothesService } from './clothes.service';
import { CreateClotheDto } from './dto/create-clothe.dto';
import { UpdateClotheDto } from './dto/update-clothe.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Clothes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cloth')
export class ClothController {
  constructor(private readonly clothService: ClothesService) {}

  // ------------------ CREATE ------------------
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new clothing item' })
  @ApiBody({
    type: CreateClotheDto,
    description: 'Data required to create a clothing item',
  })
  @ApiResponse({
    status: 201,
    description: 'Clothing item created successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid data sent in the request body.',
  })
  async create(@Body() createClothDto: CreateClotheDto) {
    try {
      return await this.clothService.create(createClothDto);
    } catch (error) {
      throw new BadRequestException('Error occurred while creating the clothing item.');
    }
  }

  // ------------------ FIND ALL ------------------
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve all clothing items' })
  @ApiResponse({
    status: 200,
    description: 'List of clothing items retrieved successfully.',
  })
  async findAll() {
    return await this.clothService.findAll();
  }

  // ------------------ FIND ONE ------------------
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a clothing item by ID' })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier of the clothing item',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Clothing item found successfully.',
  })
  @ApiNotFoundResponse({
    description: 'No clothing item found with the provided ID.',
  })
  async findOne(@Param('id') id: string) {
    const cloth = await this.clothService.findOne(id);
    if (!cloth) throw new NotFoundException(`No clothing item found with ID ${id}`);
    return cloth;
  }

  // ------------------ UPDATE ------------------
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing clothing item' })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier of the clothing item',
    type: String,
  })
  @ApiBody({
    type: UpdateClotheDto,
    description: 'Data fields to update in the clothing item',
  })
  @ApiResponse({
    status: 200,
    description: 'Clothing item updated successfully.',
  })
  @ApiNotFoundResponse({
    description: 'No clothing item found with the provided ID.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid data sent for update.',
  })
  async update(@Param('id') id: string, @Body() updateClothDto: UpdateClotheDto) {
    try {
      return await this.clothService.update(id, updateClothDto);
    } catch (error) {
      throw new NotFoundException(`Unable to update clothing item with ID ${id}`);
    }
  }

  // ------------------ DELETE ------------------
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a clothing item by ID' })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier of the clothing item',
    type: String,
  })
  @ApiResponse({
    status: 204,
    description: 'Clothing item deleted successfully (no content returned).',
  })
  @ApiNotFoundResponse({
    description: 'No clothing item found with the provided ID.',
  })
  async remove(@Param('id') id: string) {
    const deleted = await this.clothService.remove(id);
    if (!deleted) throw new NotFoundException(`No clothing item found with ID ${id}`);
    return;
  }
}
