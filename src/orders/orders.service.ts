import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  /**
   * Créer une nouvelle commande
   */
  async create(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    const order = new this.orderModel({
      clothesId: new Types.ObjectId(createOrderDto.clothesId),
      userId: new Types.ObjectId(userId),
      price: createOrderDto.price,
      orderDate: new Date(),
    });

    return await order.save();
  }

  /**
   * Récupérer toutes les commandes de l'utilisateur
   */
  async findAll(userId: string): Promise<Order[]> {
    return await this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('clothesId', 'name type imageUrl')
      .populate('userId', 'fullName email')
      .sort({ orderDate: -1 })
      .exec();
  }

  /**
   * Récupérer toutes les commandes (admin)
   */
  async findAllAdmin(): Promise<Order[]> {
    return await this.orderModel
      .find()
      .populate('clothesId', 'name type imageUrl')
      .populate('userId', 'fullName email')
      .sort({ orderDate: -1 })
      .exec();
  }
}

