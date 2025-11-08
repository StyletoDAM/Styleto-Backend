import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Store, StoreDocument } from './schemas/store.schema';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { Clothes, ClothesDocument } from '../clothes/schemas/clothes.schema';
import { User, UserDocument } from 'src/user/schemas/user.schema';

@Injectable()
export class StoreService {
  constructor(
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Clothes.name) private clothesModel: Model<ClothesDocument>,
  ) {}

  //  Vérifie l'existence des clés étrangères
  private async validateForeignKeys(userId?: string, clothesId?: string) {
    if (userId) {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException(`Invalid userId: ${userId}`);
      }

      const userExists = await this.userModel.exists({ _id: userId });
      if (!userExists) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
    }

    if (clothesId) {
      if (!Types.ObjectId.isValid(clothesId)) {
        throw new BadRequestException(`Invalid clothesId: ${clothesId}`);
      }

      const clothesExists = await this.clothesModel.exists({ _id: clothesId });
      if (!clothesExists) {
        throw new NotFoundException(`Clothes with ID ${clothesId} not found`);
      }
    }
  }

  //  CREATE
  async create(createStoreDto: CreateStoreDto): Promise<Store> {
    await this.validateForeignKeys(createStoreDto.userId, createStoreDto.clothesId);
    const storeItem = new this.storeModel(createStoreDto);
    return await storeItem.save();
  }

  // READ ALL
  async findAll(): Promise<Store[]> {
    return this.storeModel.find().populate('userId clothesId').exec();
  }

  //  READ ONE
  async findOne(id: string): Promise<Store> {
    const storeItem = await this.storeModel
      .findById(id)
      .populate('userId clothesId')
      .exec();

    if (!storeItem) {
      throw new NotFoundException(`Store item with ID ${id} not found`);
    }
    return storeItem;
  }

  // UPDATE
  async update(id: string, updateStoreDto: UpdateStoreDto): Promise<Store> {
    if (updateStoreDto.userId || updateStoreDto.clothesId) {
      await this.validateForeignKeys(updateStoreDto.userId, updateStoreDto.clothesId);
    }

    const updated = await this.storeModel
      .findByIdAndUpdate(id, updateStoreDto, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Store item with ID ${id} not found`);
    }
    return updated;
  }

  // DELETE
  async remove(id: string): Promise<{ message: string }> {
    const result = await this.storeModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Store item with ID ${id} not found`);
    }

    return { message: 'Store item deleted successfully' };
  }
}
