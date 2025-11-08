import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards } from '@nestjs/common';
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Store } from './schemas/store.schema';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Store')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new store item' })
  @ApiResponse({ status: 201, description: 'Store item created successfully', type: Store })
  create(@Body() createStoreDto: CreateStoreDto) {
    return this.storeService.create(createStoreDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all store items' })
  @ApiResponse({ status: 200, description: 'List of all store items', type: [Store] })
  findAll() {
    return this.storeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific store item by ID' })
  @ApiParam({ name: 'id', description: 'The store item ID' })
  @ApiResponse({ status: 200, description: 'Store item found', type: Store })
  @ApiResponse({ status: 404, description: 'Store item not found' })
  findOne(@Param('id') id: string) {
    return this.storeService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a store item by ID' })
  @ApiParam({ name: 'id', description: 'The store item ID' })
  @ApiResponse({ status: 200, description: 'Store item updated successfully', type: Store })
  @ApiResponse({ status: 404, description: 'Store item not found' })
  update(@Param('id') id: string, @Body() updateStoreDto: UpdateStoreDto) {
    return this.storeService.update(id, updateStoreDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a store item by ID' })
  @ApiParam({ name: 'id', description: 'The store item ID' })
  @ApiResponse({ status: 200, description: 'Store item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Store item not found' })
  remove(@Param('id') id: string) {
    return this.storeService.remove(id);
  }
}
