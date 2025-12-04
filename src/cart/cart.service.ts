import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { Store, StoreDocument } from '../store/schemas/store.schema';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
  ) {}

  /**
   * Récupérer le panier d'un utilisateur avec les détails des articles
   */
  async getCart(userId: string) {
    let cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!cart) {
      // Créer un panier vide si n'existe pas
      cart = await this.cartModel.create({
        userId: new Types.ObjectId(userId),
        items: [],
      });
    }

    // Récupérer les détails des articles du store
    const storeItemIds = cart.items.map(item => item.storeItemId);
    const storeItems = await this.storeModel
      .find({ _id: { $in: storeItemIds } })
      .populate('clothesId')
      .populate('userId', '_id fullName profilePicture') // ✨ MODIFIÉ : Inclure _id dans le populate
      .exec();

    // Mapper les items du panier avec les détails du store
    const cartItemsWithDetails = cart.items.map(cartItem => {
      const storeItem = storeItems.find(
        (item: any) => item._id.toString() === cartItem.storeItemId.toString()
      ) as any;

      if (!storeItem) {
        // ✨ MODIFIÉ : Si l'article n'existe plus dans le Store, c'est qu'il a été vendu et supprimé
        // Normalement, l'article devrait déjà être supprimé de tous les paniers lors de l'achat
        // Mais au cas où il y aurait un problème de synchronisation, on retourne null pour le filtrer
        return null;
      }

      return {
        storeItemId: storeItem._id.toString(),
        addedAt: cartItem.addedAt,
        storeItem: {
          _id: storeItem._id.toString(),
          price: storeItem.price,
          size: storeItem.size,
          status: storeItem.status, // "available" normalement
          clothesId: storeItem.clothesId,
          userId: storeItem.userId,
        },
      };
    }).filter(item => item !== null); // ✨ MODIFIÉ : Filtrer les articles supprimés (vendus)

    const cartDoc = cart as any;
    return {
      _id: cartDoc._id.toString(),
      userId: cartDoc.userId.toString(),
      items: cartItemsWithDetails,
      createdAt: cartDoc.createdAt,
      updatedAt: cartDoc.updatedAt,
    };
  }

  /**
   * Ajouter un article au panier
   */
  async addToCart(userId: string, storeItemId: string) {
    // Vérifier que l'article existe et est disponible
    const storeItem = await this.storeModel.findById(storeItemId).exec();
    if (!storeItem) {
      throw new NotFoundException('Article non trouvé');
    }

    if (storeItem.status === 'sold') {
      throw new BadRequestException('Cet article est déjà vendu');
    }

    // Vérifier que l'utilisateur n'achète pas son propre article
    if (storeItem.userId.toString() === userId) {
      throw new BadRequestException('Vous ne pouvez pas ajouter votre propre article au panier');
    }

    // Récupérer ou créer le panier
    let cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!cart) {
      cart = await this.cartModel.create({
        userId: new Types.ObjectId(userId),
        items: [],
      });
    }

    // Vérifier si l'article est déjà dans le panier
    const existingItem = cart.items.find(
      item => item.storeItemId.toString() === storeItemId
    );

    if (existingItem) {
      throw new BadRequestException('Cet article est déjà dans votre panier');
    }

    // Ajouter l'article
    cart.items.push({
      storeItemId: new Types.ObjectId(storeItemId),
      addedAt: new Date(),
    });

    await cart.save();

    return this.getCart(userId);
  }

  /**
   * Retirer un article du panier
   */
  async removeFromCart(userId: string, storeItemId: string) {
    const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!cart) {
      throw new NotFoundException('Panier non trouvé');
    }

    const itemIndex = cart.items.findIndex(
      item => item.storeItemId.toString() === storeItemId
    );

    if (itemIndex === -1) {
      throw new NotFoundException('Article non trouvé dans le panier');
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    return this.getCart(userId);
  }

  /**
   * Vider le panier
   */
  async clearCart(userId: string) {
    const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!cart) {
      return { message: 'Panier déjà vide' };
    }

    cart.items = [];
    await cart.save();

    return { message: 'Panier vidé avec succès' };
  }

  /**
   * ✨ NOUVEAU : Vérifier le statut des articles dans le panier
   * Retourne un map { storeItemId: 'available' | 'sold' }
   */
  async checkItemsStatus(userId: string): Promise<{ [storeItemId: string]: 'available' | 'sold' }> {
    const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!cart || cart.items.length === 0) {
      return {};
    }

    const storeItemIds = cart.items.map(item => item.storeItemId);
    const storeItems = await this.storeModel
      .find({ _id: { $in: storeItemIds } })
      .select('_id status')
      .exec();

    const statusMap: { [key: string]: 'available' | 'sold' } = {};
    storeItems.forEach((item: any) => {
      statusMap[item._id.toString()] = item.status;
    });

    return statusMap;
  }

  /**
   * ✨ MODIFIÉ : Supprimer l'article de tous les paniers (acheteur + autres utilisateurs)
   * Quand un article est acheté, il doit être retiré de tous les paniers
   */
  async removeItemFromAllCarts(storeItemId: string) {
    // Trouver tous les paniers contenant cet article
    const carts = await this.cartModel
      .find({ 'items.storeItemId': new Types.ObjectId(storeItemId) })
      .exec();

    // Retirer l'article de tous les paniers
    let removedCount = 0;
    for (const cart of carts) {
      const initialLength = cart.items.length;
      cart.items = cart.items.filter(
        item => item.storeItemId.toString() !== storeItemId
      );
      if (cart.items.length < initialLength) {
        await cart.save();
        removedCount++;
      }
    }

    return removedCount; // Nombre de paniers mis à jour
  }
}

