// src/events/events.controller.ts
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
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './schemas/events.schema';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ------------------ CREATE ------------------
  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiBody({ type: CreateEventDto })
  @ApiResponse({ status: 201, description: 'Event successfully created', type: Event })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createEventDto: CreateEventDto): Promise<Event> {
    return this.eventsService.create(createEventDto);
  }

  // ------------------ FIND ALL ------------------
  @Get()
  @ApiOperation({ summary: 'Retrieve all events' })
  @ApiResponse({ status: 200, description: 'List of all events', type: [Event] })
  async findAll(): Promise<Event[]> {
    return this.eventsService.findAll();
  }

  // ------------------ FIND ONE ------------------
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve one event by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the event to retrieve' })
  @ApiResponse({ status: 200, description: 'Event found', type: Event })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string): Promise<Event> {
    return this.eventsService.findOne(id);
  }

  // ------------------ UPDATE ------------------
  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing event by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the event to update' })
  @ApiBody({ type: UpdateEventDto })
  @ApiResponse({ status: 200, description: 'Event successfully updated', type: Event })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ): Promise<Event> {
    return this.eventsService.update(id, updateEventDto);
  }

  // ------------------ DELETE ------------------
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an event by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the event to delete' })
  @ApiResponse({ status: 200, description: 'Event successfully deleted', type: Event })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async remove(@Param('id') id: string): Promise<Event> {
    return this.eventsService.remove(id);
  }
}
