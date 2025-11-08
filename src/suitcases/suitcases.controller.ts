import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards } from '@nestjs/common';
import { SuitcaseService } from './suitcases.service';
import { CreateSuitcaseDto } from './dto/create-suitcase.dto';
import { UpdateSuitcaseDto } from './dto/update-suitcase.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Suitcase } from './schemas/suitcase.schema';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Suitcase')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suitcases')
export class SuitcaseController {
  constructor(private readonly suitcaseService: SuitcaseService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new suitcase' })
  @ApiResponse({ status: 201, description: 'Suitcase created successfully', type: Suitcase })
  create(@Body() createSuitcaseDto: CreateSuitcaseDto) {
    return this.suitcaseService.create(createSuitcaseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all suitcases' })
  @ApiResponse({ status: 200, description: 'List of all suitcases', type: [Suitcase] })
  findAll() {
    return this.suitcaseService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific suitcase by ID' })
  @ApiParam({ name: 'id', description: 'Suitcase ID' })
  @ApiResponse({ status: 200, description: 'Suitcase found', type: Suitcase })
  @ApiResponse({ status: 404, description: 'Suitcase not found' })
  findOne(@Param('id') id: string) {
    return this.suitcaseService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a suitcase by ID' })
  @ApiParam({ name: 'id', description: 'Suitcase ID' })
  @ApiResponse({ status: 200, description: 'Suitcase updated successfully', type: Suitcase })
  @ApiResponse({ status: 404, description: 'Suitcase not found' })
  update(@Param('id') id: string, @Body() updateSuitcaseDto: UpdateSuitcaseDto) {
    return this.suitcaseService.update(id, updateSuitcaseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a suitcase by ID' })
  @ApiParam({ name: 'id', description: 'Suitcase ID' })
  @ApiResponse({ status: 200, description: 'Suitcase deleted successfully' })
  @ApiResponse({ status: 404, description: 'Suitcase not found' })
  remove(@Param('id') id: string) {
    return this.suitcaseService.remove(id);
  }
}
