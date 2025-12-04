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
   * ✨ NOUVEAU : Helper pour enrichir les orders avec les données stockées
   */
  private enrichOrderWithStoredData(order: any): any {
    if (!order.clothesId) {
      // Si Clothes a été supprimé, créer un objet clothesId avec les données stockées dans Order
      order.clothesId = {
        _id: order.clothesId || null,
        name: order.category || 'Article supprimé', // Utiliser category comme nom
        category: order.category || 'unknown',
        imageURL: order.imageURL || '', // ✨ Image stockée
        style: order.style || '',
        color: order.color || '',
        season: order.season || '',
      };
    } else {
      // Si Clothes existe, compléter avec les données de Order si manquantes
      if (!order.clothesId.imageURL && order.imageURL) {
        order.clothesId.imageURL = order.imageURL;
      }
      if (!order.clothesId.category && order.category) {
        order.clothesId.category = order.category;
      }
      if (!order.clothesId.style && order.style) {
        order.clothesId.style = order.style;
      }
      if (!order.clothesId.color && order.color) {
        order.clothesId.color = order.color;
      }
      if (!order.clothesId.season && order.season) {
        order.clothesId.season = order.season;
      }
    }
    // ✨ NOUVEAU : Ajouter la taille depuis Order
    if (order.size) {
      order.size = order.size;
    }
    return order;
  }

  /**
   * Récupérer toutes les commandes de l'utilisateur
   */
  async findAll(userId: string): Promise<Order[]> {
    const orders = await this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('clothesId', 'name category imageURL style color season')
      .populate('userId', 'fullName email')
      .sort({ orderDate: -1 })
      .exec();

    // ✨ MODIFIÉ : Enrichir avec les données stockées dans Order
    return orders.map((order: any) => this.enrichOrderWithStoredData(order));
  }

  /**
   * Récupérer toutes les commandes (admin)
   */
  async findAllAdmin(): Promise<Order[]> {
    const orders = await this.orderModel
      .find()
      .populate('clothesId', 'name category imageURL style color season')
      .populate('userId', 'fullName email')
      .sort({ orderDate: -1 })
      .exec();

    // ✨ MODIFIÉ : Enrichir avec les données stockées dans Order
    return orders.map((order: any) => this.enrichOrderWithStoredData(order));
  }
}
