import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { Store, StoreDocument } from '../store/schemas/store.schema';
import { Clothes, ClothesDocument } from '../clothes/schemas/clothes.schema';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    @InjectModel(Clothes.name) private clothesModel: Model<ClothesDocument>,
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

  /**
   * Récupérer l'historique des transactions (montants envoyés/reçus)
   */
  async getTransactionsHistory(userId: string): Promise<any[]> {
    const transactions: any[] = [];

    // 1. Transactions sortantes : Achats (Orders où userId = userId)
    const purchases = await this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ orderDate: -1 })
      .exec();

    purchases.forEach((order: any) => {
      transactions.push({
        _id: order._id.toString(),
        type: 'outgoing',
        amount: order.price,
        description: `Achat de vêtement`,
        date: order.orderDate || order.createdAt,
        paymentMethod: 'balance', // Par défaut, peut être amélioré
        createdAt: order.createdAt,
      });
    });

    // 2. Transactions entrantes : Ventes (Store items vendus où userId = sellerId)
    // Note: Les items vendus sont supprimés, donc on doit utiliser les Orders pour retrouver les ventes
    // On cherche les Orders où le vendeur est l'utilisateur actuel
    // Pour cela, on doit trouver les Orders liés aux vêtements de l'utilisateur
    
    // Alternative : Utiliser les Orders avec populate pour trouver les vendeurs
    // Pour l'instant, on utilise une approche simple basée sur les Store items vendus
    
    // 2. Transactions entrantes : Ventes
    // Trouver tous les vêtements de l'utilisateur
    const userClothes = await this.clothesModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('_id')
      .exec();

    const userClothesIds = userClothes.map((cloth: any) => cloth._id);

    // Trouver les Orders qui contiennent ces vêtements (ce sont les ventes)
    const sales = await this.orderModel
      .find({ clothesId: { $in: userClothesIds } })
      .sort({ orderDate: -1 })
      .exec();

    sales.forEach((order: any) => {
      // S'assurer que ce n'est pas un achat de l'utilisateur (déjà ajouté)
      if (order.userId.toString() !== userId) {
        transactions.push({
          _id: `sale_${order._id.toString()}`,
          type: 'incoming',
          amount: order.price,
          description: `Vente de vêtement`,
          date: order.orderDate || order.createdAt,
          paymentMethod: 'balance',
          createdAt: order.createdAt,
        });
      }
    });

    // 3. Top-ups : À implémenter si vous avez une collection dédiée
    // Pour l'instant, on peut ajouter ça plus tard

    // Trier par date (plus récent en premier)
    return transactions.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt).getTime();
      const dateB = new Date(b.date || b.createdAt).getTime();
      return dateB - dateA;
    });
  }
}
