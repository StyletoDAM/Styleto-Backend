import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Outfit, OutfitDocument } from './schemas/outfits.schema';
import { CreateOutfitDto } from './dto/create-outfit.dto';
import { UpdateOutfitDto } from './dto/update-outfit.dto';
import { User, UserDocument } from 'src/user/schemas/user.schema';
import { Clothes, ClothesDocument } from 'src/clothes/schemas/clothes.schema';

@Injectable()
export class OutfitsService {
  constructor(
    @InjectModel(Outfit.name) private outfitModel: Model<OutfitDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Clothes.name) private clothesModel: Model<ClothesDocument>,
  ) {}

  //  Vérifie si un ObjectId est valide
  private validateObjectId(id: string, fieldName: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new ForbiddenException(`Invalid ${fieldName} ID format`);
    }
  }

  // Vérifie si un utilisateur existe
  private async verifyUserExists(userId: string) {
    this.validateObjectId(userId, 'user');
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);
  }

  //  Vérifie si les vêtements existent
  private async verifyClothesExist(clothesIds: string[]) {
    for (const id of clothesIds) {
      this.validateObjectId(id, 'clothe');
      const clothe = await this.clothesModel.findById(id).exec();
      if (!clothe) throw new NotFoundException(`Clothe with ID ${id} not found`);
    }
  }

  // CREATE
async create(createOutfitDto: CreateOutfitDto): Promise<Outfit> {
  if (createOutfitDto.userId) {
    await this.verifyUserExists(createOutfitDto.userId.toString()); //  convert ObjectId to string
  }

  if (createOutfitDto.clothesIds && createOutfitDto.clothesIds.length > 0) {
    await this.verifyClothesExist(createOutfitDto.clothesIds.map(id => id.toString())); //  convert each ObjectId to string
  }

  const outfit = new this.outfitModel(createOutfitDto);
  return await outfit.save();
}

  // READ ALL
  async findAll(): Promise<Outfit[]> {
    return await this.outfitModel
      .find()
      .populate('userId', '-password -__v')
      .populate('clothesIds')
      .exec();
  }

  // READ ONE
  async findOne(id: string): Promise<Outfit> {
    this.validateObjectId(id, 'outfit');

    const outfit = await this.outfitModel
      .findById(id)
      .populate('userId', '-password -__v')
      .populate('clothesIds')
      .exec();

    if (!outfit) {
      throw new NotFoundException(`Outfit with ID ${id} not found`);
    }

    return outfit;
  }

  // UPDATE
async update(id: string, updateOutfitDto: UpdateOutfitDto): Promise<Outfit> {
  this.validateObjectId(id, 'outfit');

  if (updateOutfitDto.userId) {
    await this.verifyUserExists(updateOutfitDto.userId.toString()); // convert ObjectId to string
  }

  if (updateOutfitDto.clothesIds && updateOutfitDto.clothesIds.length > 0) {
    await this.verifyClothesExist(updateOutfitDto.clothesIds.map(id => id.toString())); // convert each ObjectId to string
  }

  const updated = await this.outfitModel
    .findByIdAndUpdate(id, updateOutfitDto, { new: true })
    .exec();

  if (!updated) {
    throw new NotFoundException(`Outfit with ID ${id} not found`);
  }

  return updated;
}

  // DELETE
  async remove(id: string): Promise<Outfit> {
    this.validateObjectId(id, 'outfit');

    const deleted = await this.outfitModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Outfit with ID ${id} not found`);
    }

    return deleted;
  }
}
