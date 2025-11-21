import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clothes, ClothesDocument } from './schemas/clothes.schema';
import { CreateClotheDto } from './dto/create-clothe.dto';
import { UpdateClotheDto } from './dto/update-clothe.dto';
import { User } from 'src/user/schemas/user.schema';
import { UserPreferencesService } from './services/user-preferences.service';

@Injectable()
export class ClothesService {
  constructor(
    @InjectModel(Clothes.name) private clothesModel: Model<ClothesDocument>,
    @InjectModel(User.name) private userModel: Model<Document>,
    private userPreferencesService: UserPreferencesService, // ✨ NOUVEAU
  ) {}

  // Vérifie si un utilisateur existe avant d'associer un vêtement
  private async verifyUserExists(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException(`Invalid user ID format`);
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  // CREATE : avec vérification de la clé étrangère
  async create(
    createClothesDto: CreateClotheDto & { userId: string },
  ): Promise<Clothes> {
    // Vérifie que l'utilisateur existe
    await this.verifyUserExists(createClothesDto.userId);

    const newClothes = new this.clothesModel({
      ...createClothesDto,
      userId: new Types.ObjectId(createClothesDto.userId),
    });

    const savedClothes = await newClothes.save();

    // ✨ NOUVEAU : Si c'est une correction, met à jour les préférences utilisateur
    if (savedClothes.isCorrected && savedClothes.originalDetection) {
      await this.userPreferencesService.updateFromCorrection(
        createClothesDto.userId,
        {
          category: savedClothes.category,
          style: savedClothes.style,
          season: savedClothes.season,
        },
      );
    }

    return savedClothes;
  }

  // ✨ NOUVEAU : Trouver tous les vêtements corrigés pour fine-tuning
  async findCorrected(): Promise<Clothes[]> {
    return await this.clothesModel.find({ isCorrected: true }).exec();
  }

  // ✨ NOUVEAU : Stats globales pour dashboard admin
  async getGlobalCorrectionStats() {
    const totalCorrections = await this.clothesModel
      .countDocuments({ isCorrected: true })
      .exec();

    const uniqueUsers = await this.clothesModel
      .distinct('userId', { isCorrected: true })
      .exec();

    // Groupement par catégorie
    const byCategory = await this.clothesModel.aggregate([
      { $match: { isCorrected: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { category: '$_id', count: 1, _id: 0 } },
    ]);

    // Groupement par style
    const byStyle = await this.clothesModel.aggregate([
      { $match: { isCorrected: true } },
      { $group: { _id: '$style', count: { $sum: 1 } } },
      { $project: { style: '$_id', count: 1, _id: 0 } },
    ]);

    // Groupement par saison
    const bySeason = await this.clothesModel.aggregate([
      { $match: { isCorrected: true } },
      { $group: { _id: '$season', count: { $sum: 1 } } },
      { $project: { season: '$_id', count: 1, _id: 0 } },
    ]);

    return {
      totalCorrections,
      uniqueUsers: uniqueUsers.length,
      byCategory,
      byStyle,
      bySeason,
      readyForFineTuning: totalCorrections >= 50,
      progress: {
        current: totalCorrections,
        target: 50,
        percentage: Math.min((totalCorrections / 50) * 100, 100),
      },
    };
  }

  // ✨ NOUVEAU : Stats personnelles pour un utilisateur
  async getUserStats(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    // Corrections de cet utilisateur
    const userCorrections = await this.clothesModel
      .countDocuments({ userId: userObjectId, isCorrected: true })
      .exec();

    // Total corrections globales
    const globalCorrections = await this.clothesModel
      .countDocuments({ isCorrected: true })
      .exec();

    // Préférences de l'utilisateur
    const prefs = await this.userPreferencesService.getPreferences(userId);

    return {
      totalCorrections: userCorrections,
      preferredStyle: prefs?.preferences?.preferredStyle || null,
      preferredSeason: prefs?.preferences?.preferredSeason || null,
      styleConfidence: prefs?.preferences?.styleConfidence || 0,
      seasonConfidence: prefs?.preferences?.seasonConfidence || 0,
      contributionToGlobal: {
        userCorrections,
        globalCorrections,
        percentage:
          globalCorrections > 0
            ? (userCorrections / globalCorrections) * 100
            : 0,
      },
      personalizationActive: (prefs?.totalCorrections || 0) >= 5,
    };
  }

  //  GET ALL
  async findAll(): Promise<Clothes[]> {
    return await this.clothesModel
      .find()
      .populate('userId', '-password -__v')
      .exec();
  }

  //  GET ONE
  async findOne(id: string): Promise<Clothes> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ForbiddenException(`Invalid clothes ID format`);
    }

    const clothes = await this.clothesModel
      .findById(id)
      .populate('userId', '-password -__v')
      .exec();

    if (!clothes) {
      throw new NotFoundException(`Clothes with ID ${id} not found`);
    }

    return clothes;
  }

  //  UPDATE
  async update(
    id: string,
    updateClothesDto: UpdateClotheDto,
  ): Promise<Clothes> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ForbiddenException(`Invalid clothes ID format`);
    }

    // Si on change le userId, on vérifie qu'il existe
    if (updateClothesDto.userId) {
      await this.verifyUserExists(updateClothesDto.userId);
    }

    const updated = await this.clothesModel
      .findByIdAndUpdate(id, updateClothesDto, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Clothes with ID ${id} not found`);
    }

    return updated;
  }

  //  DELETE
  async remove(id: string): Promise<Clothes> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ForbiddenException(`Invalid clothes ID format`);
    }

    const deleted = await this.clothesModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException(`Clothes with ID ${id} not found`);
    }

    return deleted;
  }

  async findByUserId(userId: string): Promise<Clothes[]> {
    console.log('findByUserId called with:', userId);
    if (!Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Invalid user ID format');
    }

    return await this.clothesModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('userId', '-password -__v')
      .exec();
  }

  // Supprimer uniquement si le vêtement appartient à l'utilisateur
  async removeMyClothe(clotheId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(clotheId) || !Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException("Format d'ID invalide");
    }

    const result = await this.clothesModel
      .deleteOne({
        _id: new Types.ObjectId(clotheId),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    return result.deletedCount > 0;
  }
}