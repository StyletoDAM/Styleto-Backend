// src/avatar/avatar.controller.ts
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
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { AvatarService } from './avatars.service';
import { Avatar } from './schemas/avatar.schema';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Avatar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('avatar')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  // ------------------ CREATE ------------------
  @Post()
  @ApiOperation({ summary: 'Create a new avatar' })
  @ApiBody({ type: CreateAvatarDto })
  @ApiResponse({ status: 201, description: 'Avatar successfully created', type: Avatar })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createAvatarDto: CreateAvatarDto): Promise<Avatar> {
    return this.avatarService.create(createAvatarDto);
  }

  // ------------------ FIND ALL ------------------
  @Get()
  @ApiOperation({ summary: 'Retrieve all avatars' })
  @ApiResponse({ status: 200, description: 'List of all avatars', type: [Avatar] })
  async findAll(): Promise<Avatar[]> {
    return this.avatarService.findAll();
  }

  // ------------------ FIND ONE ------------------
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve one avatar by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the avatar to retrieve' })
  @ApiResponse({ status: 200, description: 'Avatar found', type: Avatar })
  @ApiResponse({ status: 404, description: 'Avatar not found' })
  async findOne(@Param('id') id: string): Promise<Avatar> {
    return this.avatarService.findOne(id);
  }

  // ------------------ UPDATE ------------------
  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing avatar by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the avatar to update' })
  @ApiBody({ type: UpdateAvatarDto })
  @ApiResponse({ status: 200, description: 'Avatar successfully updated', type: Avatar })
  @ApiResponse({ status: 404, description: 'Avatar not found' })
  async update(
    @Param('id') id: string,
    @Body() updateAvatarDto: UpdateAvatarDto,
  ): Promise<Avatar> {
    return this.avatarService.update(id, updateAvatarDto);
  }

  // ------------------ DELETE ------------------
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an avatar by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the avatar to delete' })
  @ApiResponse({ status: 200, description: 'Avatar successfully deleted', type: Avatar })
  @ApiResponse({ status: 404, description: 'Avatar not found' })
  async remove(@Param('id') id: string): Promise<Avatar> {
    return this.avatarService.remove(id);
  }
}
