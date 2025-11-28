import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new order',
    description: 'Create a new order for a clothes item. The userId is automatically taken from the authenticated user token.'
  })
  @ApiBody({
    type: CreateOrderDto,
    examples: {
      example1: {
        summary: 'Example: Create order for a clothes item',
        description: 'Example of creating an order with clothes ID and price',
        value: {
          clothesId: '507f1f77bcf86cd799439011',
          price: 99.99
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    schema: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '507f1f77bcf86cd799439012' },
        clothesId: { type: 'string', example: '507f1f77bcf86cd799439011' },
        userId: { type: 'string', example: '507f1f77bcf86cd799439013' },
        price: { type: 'number', example: 99.99 },
        orderDate: { type: 'string', format: 'date-time', example: '2025-11-28T12:00:00.000Z' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token'
  })
  async create(
    @GetUser() user: any,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return await this.ordersService.create(user.id, createOrderDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all orders for the authenticated user',
    description: 'Retrieve all orders belonging to the currently authenticated user. Orders are sorted by date (newest first).'
  })
  @ApiResponse({
    status: 200,
    description: 'List of orders retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439012' },
          clothesId: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              name: { type: 'string', example: 'T-Shirt' },
              type: { type: 'string', example: 'top' },
              imageUrl: { type: 'string', example: 'https://example.com/image.jpg' }
            }
          },
          userId: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              fullName: { type: 'string', example: 'John Doe' },
              email: { type: 'string', example: 'john@example.com' }
            }
          },
          price: { type: 'number', example: 99.99 },
          orderDate: { type: 'string', format: 'date-time', example: '2025-11-28T12:00:00.000Z' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      example: [
        {
          _id: '507f1f77bcf86cd799439012',
          clothesId: {
            _id: '507f1f77bcf86cd799439011',
            name: 'Blue T-Shirt',
            type: 'top',
            imageUrl: 'https://example.com/image.jpg'
          },
          userId: {
            _id: '507f1f77bcf86cd799439013',
            fullName: 'John Doe',
            email: 'john@example.com'
          },
          price: 99.99,
          orderDate: '2025-11-28T12:00:00.000Z',
          createdAt: '2025-11-28T12:00:00.000Z',
          updatedAt: '2025-11-28T12:00:00.000Z'
        }
      ]
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token'
  })
  async findAll(@GetUser() user: any) {
    return await this.ordersService.findAll(user.id);
  }
}

