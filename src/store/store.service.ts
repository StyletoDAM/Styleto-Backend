import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Store, StoreDocument } from './schemas/store.schema';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { Clothes, ClothesDocument } from '../clothes/schemas/clothes.schema';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { forwardRef, Inject } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ConfirmPurchaseDto } from './dto/confirm-purchase.dto';

import { Order, OrderDocument } from '../orders/schemas/order.schema';

@Injectable()
export class StoreService {
  private stripe: Stripe;

  constructor(
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    @InjectModel(Clothes.name) private clothesModel: Model<ClothesDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>, 
    private configService: ConfigService,
    @Inject(forwardRef(() => UserService)) private userService: UserService,
    private subscriptionsService: SubscriptionsService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not found in config');
    }
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2025-11-17.clover',
    });
  }

  private isValidId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }

  private async verifyClothesOwnership(clothesId: Types.ObjectId, userId: string) {
    const clothes = await this.clothesModel.findOne({
      _id: clothesId,
      userId: new Types.ObjectId(userId),
    });

    if (!clothes) {
      throw new ForbiddenException('Ce vêtement ne vous appartient pas ou n\'existe pas');
    }
  }

  async create(dto: CreateStoreDto, userId: string): Promise<Store> {
    if (!this.isValidId(userId) || !this.isValidId(dto.clothesId.toString())) {
      throw new BadRequestException('Invalid ID format');
    }

    const quotaCheck = await this.subscriptionsService.canSellItem(userId);

    if (!quotaCheck.allowed) {
      throw new ForbiddenException(
        quotaCheck.message || 'Quota exceeded for store selling',
      );
    }

    await this.verifyClothesOwnership(dto.clothesId, userId);

    const storeItem = new this.storeModel({
      ...dto,
      userId: new Types.ObjectId(userId),
    });

    const saved = await storeItem.save();
    await this.subscriptionsService.incrementItemSold(userId);

    return saved;
  }

  async findAll(): Promise<Store[]> {
    return this.storeModel
      .find()
      .populate('userId', '-password -__v')
      .populate('clothesId')
      .exec();
  }

  async findByUserId(userId: string): Promise<Store[]> {
    if (!this.isValidId(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    return this.storeModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('userId', '-password -__v')
      .populate('clothesId')
      .exec();
  }

  async findOne(id: string): Promise<Store> {
    if (!this.isValidId(id)) {
      throw new BadRequestException('Invalid store item ID');
    }

    const item = await this.storeModel
      .findById(id)
      .populate('userId', '-password -__v')
      .populate('clothesId')
      .exec();

    if (!item) {
      throw new NotFoundException(`Store item with ID ${id} not found`);
    }

    return item;
  }

  async update(id: string, dto: UpdateStoreDto, userId: string): Promise<Store> {
    if (!this.isValidId(id)) {
      throw new BadRequestException('Invalid store item ID');
    }

    const item = await this.storeModel.findById(id).exec();
    if (!item) {
      throw new NotFoundException(`Store item with ID ${id} not found`);
    }

    if (item.userId.toString() !== userId.toString()) {
      throw new ForbiddenException('Vous ne pouvez pas modifier cet article');
    }

    if (dto.clothesId) {
      await this.verifyClothesOwnership(dto.clothesId, userId);
    }

    const updated = await this.storeModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
        dto,
        { new: true },
      )
      .populate('userId', '-password -__v')
      .populate('clothesId')
      .exec();

    if (!updated) {
      throw new NotFoundException(`Store item with ID ${id} not found`);
    }

    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    if (!this.isValidId(id)) {
      throw new BadRequestException('Invalid store item ID');
    }

    const result = await this.storeModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId)
    }).exec();

    if (!result) {
      throw new NotFoundException(
        `Store item with ID ${id} not found or you don't have permission to delete it`
      );
    }
  }

  async createPaymentIntent(amount: number, currency?: string): Promise<string> {
    const finalCurrency = currency || this.configService.get<string>('STRIPE_CURRENCY', 'usd');
    
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: finalCurrency,
      payment_method_types: ['card'],
      metadata: {
        integration: 'labasni-store',
      },
    });
    
    if (!paymentIntent.client_secret) {
      throw new BadRequestException('Failed to create client secret');
    }
    
    return paymentIntent.client_secret;
  }

  async confirmPurchase(
    storeItemId: string,
    dto: ConfirmPurchaseDto,
    buyerId: string,
  ): Promise<Store> {
    const item = await this.storeModel.findById(storeItemId).exec();
    
    if (!item) {
      throw new NotFoundException('Article non trouvé');
    }

    if (item.status === 'sold') {
      throw new BadRequestException('Cet article est déjà vendu');
    }

    const sellerId = item.userId.toString();

    if (sellerId === buyerId) {
      throw new BadRequestException('Vous ne pouvez pas acheter votre propre article');
    }

    const amountCents = Math.round(item.price * 100);

    // PAIEMENT PAR BALANCE
    if (dto.paymentMethod === 'balance') {
      if (dto.paymentIntentId) {
        throw new BadRequestException('paymentIntentId ne doit pas être fourni pour le paiement par balance');
      }

      const buyer = await this.userService.findById(buyerId);
      if (!buyer || (buyer.balance || 0) < amountCents) {
        throw new BadRequestException('Solde insuffisant');
      }

      await this.userService.subtractFromBalance(buyerId, amountCents);
    }

    // PAIEMENT PAR STRIPE
    else if (dto.paymentMethod === 'stripe') {
      if (!dto.paymentIntentId) {
        throw new BadRequestException('paymentIntentId est requis pour Stripe');
      }

      const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';

      if (!isDevelopment) {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(dto.paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
          throw new BadRequestException(`Paiement non réussi. Statut: ${paymentIntent.status}`);
        }

        if (paymentIntent.amount !== amountCents) {
          throw new BadRequestException('Montant du paiement incorrect');
        }
      } else {
        console.log('[DEV MODE] Stripe verification skipped');
      }
    } else {
      throw new BadRequestException('Méthode de paiement invalide');
    }

    // CRÉDIT VENDEUR
    await this.userService.addToBalance(sellerId, amountCents);

    // MARQUER COMME VENDU
    const updatedItem = await this.storeModel
      .findByIdAndUpdate(
        storeItemId,
        {
          status: 'sold',
          soldAt: new Date(),
          buyerId: new Types.ObjectId(buyerId),
          stripePaymentIntentId: dto.paymentMethod === 'stripe' ? dto.paymentIntentId : null,
          paymentMethod: dto.paymentMethod,
        },
        { new: true },
      )
      .populate('userId', '-password -__v')
      .populate('clothesId')
      .exec();

    if (!updatedItem) {
      throw new NotFoundException("Erreur lors de la mise à jour de l'article");
    }

    // AJOUT CRITIQUE : CRÉER L'ORDRE
    try {
      const newOrder = new this.orderModel({
        clothesId: item.clothesId,
        userId: new Types.ObjectId(buyerId),
        price: item.price,
        orderDate: new Date(),
      });

      await newOrder.save();
      console.log(`✅ Order created for buyer ${buyerId}, item ${storeItemId}`);
    } catch (error) {
      console.error('Failed to create order:', error);
      // Ne pas bloquer la transaction si la création d'ordre échoue
      // mais logger l'erreur pour investigation
    }

    return updatedItem;
  }
}