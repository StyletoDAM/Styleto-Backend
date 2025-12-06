// src/clothes/clothes.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clothes, ClothesDocument } from './schemas/clothes.schema';
import { CreateClotheDto } from './dto/create-clothe.dto';
import { UpdateClotheDto } from './dto/update-clothe.dto';
import { User } from 'src/user/schemas/user.schema';
import { UserPreferencesService } from './services/user-preferences.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import axios from 'axios';

@Injectable()
export class ClothesService {
  private readonly logger = new Logger(ClothesService.name);

  constructor(
    @InjectModel(Clothes.name) private clothesModel: Model<ClothesDocument>,
    @InjectModel(User.name) private userModel: Model<Document>,
    private userPreferencesService: UserPreferencesService,
    private subscriptionsService: SubscriptionsService,
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

  // ==========================================
  // MÉTHODES VTO - NOUVELLES
  // ==========================================

  /**
   * Récupère tous les vêtements d'un utilisateur
   * Remplace findByUserId mais conserve la même logique
   */
  async findAllByUser(userId: string): Promise<ClothesDocument[]> {
    console.log('findAllByUser called with:', userId);
    if (!Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Invalid user ID format');
    }

    return await this.clothesModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('userId', '-password -__v')
      .exec();
  }

  /**
   * Récupère les vêtements d'un utilisateur par catégorie
   */
  async findByUserAndCategory(
    userId: string,
    category: string,
  ): Promise<ClothesDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Invalid user ID format');
    }

    return this.clothesModel
      .find({
        userId: new Types.ObjectId(userId),
        category: category,
      })
      .exec();
  }

  /**
   * Récupère uniquement les vêtements PRÊTS pour le VTO
   */
  async findReadyForVTO(userId: string): Promise<ClothesDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Invalid user ID format');
    }

    return this.clothesModel
      .find({
        userId: new Types.ObjectId(userId),
        processingStatus: 'ready',
        processedImageURL: { $exists: true, $ne: null },
      })
      .exec();
  }

  /**
   * Récupère un vêtement par ID (avec vérification du propriétaire)
   */
  async findOneByIdAndUser(
    clothingId: string,
    userId: string,
  ): Promise<ClothesDocument> {
    if (!Types.ObjectId.isValid(clothingId) || !Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Invalid ID format');
    }

    const clothing = await this.clothesModel.findOne({
      _id: new Types.ObjectId(clothingId),
      userId: new Types.ObjectId(userId),
    });

    if (!clothing) {
      throw new NotFoundException('Vêtement introuvable ou non autorisé');
    }

    return clothing;
  }

  /**
   * Récupère plusieurs vêtements par leurs IDs (pour le VTO)
   */
  async findManyByIds(
    clothingIds: string[],
    userId: string,
  ): Promise<ClothesDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Invalid user ID format');
    }

    const objectIds = clothingIds.map((id) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new ForbiddenException(`Invalid clothing ID: ${id}`);
      }
      return new Types.ObjectId(id);
    });

    return this.clothesModel
      .find({
        _id: { $in: objectIds },
        userId: new Types.ObjectId(userId),
        processingStatus: 'ready', // Seulement les vêtements prêts
      })
      .exec();
  }

  /**
   * Traite une image de vêtement (détourage)
   * Cette fonction appelle le service Python pour enlever le fond
   */
  async processClothingImage(clothingId: string): Promise<void> {
    try {
      const clothing = await this.clothesModel.findById(clothingId);
      if (!clothing) {
        throw new NotFoundException('Vêtement introuvable');
      }

      // Marquer comme "en traitement"
      clothing.processingStatus = 'processing';
      clothing.processingError = undefined;
      await clothing.save();

      this.logger.log(
        `🔄 Traitement de l'image ${clothingId} (${clothing.category})...`,
      );

      // Appeler le service Python pour enlever le fond
      const pythonServiceUrl =
        process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';

      const response = await axios.post(
        `${pythonServiceUrl}/process-clothing`,
        {
          imageURL: clothing.imageURL,
          category: clothing.category,
        },
        { timeout: 30000 }, // 30 secondes max
      );

      if (response.data.success && response.data.processedImageURL) {
        // Sauvegarder l'URL de l'image détourée
        clothing.processedImageURL = response.data.processedImageURL;
        clothing.isProcessed = true;
        clothing.processingStatus = 'ready';
        clothing.processingError = undefined;

        await clothing.save();

        this.logger.log(
          `✅ Image ${clothingId} traitée avec succès: ${response.data.processedImageURL}`,
        );
      } else {
        throw new Error(
          response.data.error || 'Échec du traitement sans erreur',
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Erreur traitement image ${clothingId}: ${error.message}`,
      );

      // Marquer comme échoué
      await this.clothesModel.findByIdAndUpdate(clothingId, {
        processingStatus: 'failed',
        processingError: error.message,
      });
    }
  }

  /**
   * Retraite une image (si le traitement a échoué)
   */
  async reprocessClothingImage(
    clothingId: string,
    userId: string,
  ): Promise<ClothesDocument> {
    const clothing = await this.findOneByIdAndUser(clothingId, userId);

    // Réinitialiser le statut
    clothing.processingStatus = 'pending';
    clothing.processedImageURL = undefined;
    clothing.isProcessed = false;
    clothing.processingError = undefined;
    await clothing.save();

    // Relancer le traitement
    this.processClothingImage(clothingId).catch((err) => {
      this.logger.error(`Erreur retraitement: ${err.message}`);
    });

    return clothing;
  }

  /**
   * Supprimer un vêtement (sans Cloudinary pour l'instant)
   */
  async deleteClothing(clothingId: string, userId: string): Promise<void> {
    const clothing = await this.findOneByIdAndUser(clothingId, userId);

    // TODO: Ajouter la suppression Cloudinary si nécessaire
    // Pour l'instant, on supprime juste de la BD
    await this.clothesModel.findByIdAndDelete(clothingId);
    
    this.logger.log(`🗑️  Vêtement ${clothingId} supprimé`);
  }

  /**
   * Retraite TOUS les vêtements d'un utilisateur
   * Utile pour traiter les vêtements existants après migration
   */
  async reprocessAllUserClothes(userId: string): Promise<{
    total: number;
    queued: number;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Invalid user ID format');
    }

    const clothes = await this.clothesModel
      .find({
        userId: new Types.ObjectId(userId),
        $or: [
          { processingStatus: { $in: ['pending', 'failed'] } },
          { processedImageURL: null },
        ],
      })
      .exec();

    const total = clothes.length;
    let queued = 0;

    // Traiter en série pour ne pas surcharger le serveur Python
    for (const cloth of clothes) {
      try {
        cloth.processingStatus = 'pending';
        await cloth.save();

        // Lancer le traitement (non-bloquant)
        const clothId = String(cloth._id);
        this.processClothingImage(clothId).catch((err) => {
          this.logger.error(
            `Erreur traitement ${clothId}: ${err.message}`,
          );
        });

        queued++;

        // Attendre 500ms entre chaque traitement
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        this.logger.error(
          `Erreur ajout à la queue ${cloth._id}: ${error.message}`,
        );
      }
    }

    return { total, queued };
  }

  // ==========================================
  // MÉTHODES EXISTANTES - CONSERVÉES
  // ==========================================

  // CREATE : avec vérification de la clé étrangère ET DU QUOTA + traitement VTO
  async create(
    createClothesDto: CreateClotheDto & { userId: string },
  ): Promise<Clothes> {
    // Vérifier le quota AVANT de créer
    const quotaCheck = await this.subscriptionsService.canDetectClothes(
      createClothesDto.userId,
    );

    if (!quotaCheck.allowed) {
      throw new ForbiddenException(
        quotaCheck.message || 'Quota exceeded for clothes detection',
      );
    }

    // Vérifie que l'utilisateur existe
    await this.verifyUserExists(createClothesDto.userId);

    const newClothes = new this.clothesModel({
      ...createClothesDto,
      userId: new Types.ObjectId(createClothesDto.userId),
      processingStatus: 'pending', // ✨ NOUVEAU
    });

    const savedClothes = await newClothes.save();

    // Incrémenter le compteur APRÈS la création réussie
    await this.subscriptionsService.incrementClothesDetection(
      createClothesDto.userId,
    );

    // ✨ NOUVEAU : Lancer le traitement VTO en arrière-plan (non-bloquant)
    const savedClothesId = String(savedClothes._id);
    this.processClothingImage(savedClothesId).catch((err) => {
      this.logger.error(
        `Erreur traitement image ${savedClothesId}: ${err.message}`,
      );
    });

    // Si c'est une correction, met à jour les préférences utilisateur
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

  // Trouver tous les vêtements corrigés pour fine-tuning
  async findCorrected(): Promise<Clothes[]> {
    return await this.clothesModel.find({ isCorrected: true }).exec();
  }

  // Stats globales pour dashboard admin
  async getGlobalCorrectionStats() {
    const totalCorrections = await this.clothesModel
      .countDocuments({ isCorrected: true })
      .exec();

    const uniqueUsers = await this.clothesModel
      .distinct('userId', { isCorrected: true })
      .exec();

    const byCategory = await this.clothesModel.aggregate([
      { $match: { isCorrected: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { category: '$_id', count: 1, _id: 0 } },
    ]);

    const byStyle = await this.clothesModel.aggregate([
      { $match: { isCorrected: true } },
      { $group: { _id: '$style', count: { $sum: 1 } } },
      { $project: { style: '$_id', count: 1, _id: 0 } },
    ]);

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

  // Stats personnelles pour un utilisateur
  async getUserStats(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const userCorrections = await this.clothesModel
      .countDocuments({ userId: userObjectId, isCorrected: true })
      .exec();

    const globalCorrections = await this.clothesModel
      .countDocuments({ isCorrected: true })
      .exec();

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

  // GET ALL
  async findAll(): Promise<Clothes[]> {
    return await this.clothesModel
      .find()
      .populate('userId', '-password -__v')
      .exec();
  }

  // GET ONE
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

  // UPDATE
  async update(
    id: string,
    updateClothesDto: UpdateClotheDto,
  ): Promise<Clothes> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ForbiddenException(`Invalid clothes ID format`);
    }

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

  // DELETE
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

  // Conservé pour compatibilité avec le code existant
  async findByUserId(userId: string): Promise<Clothes[]> {
    return this.findAllByUser(userId);
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

  // Mettre à jour le feedback (acceptedCount / rejectedCount)
  async updateFeedback(
    clotheId: string,
    accepted: boolean,
    userId: string,
  ): Promise<Clothes> {
    if (!Types.ObjectId.isValid(clotheId)) {
      throw new ForbiddenException('Invalid clothe ID format');
    }

    const clothe = await this.clothesModel
      .findOne({
        _id: new Types.ObjectId(clotheId),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!clothe) {
      throw new NotFoundException(
        "Vêtement non trouvé ou vous n'êtes pas autorisé à le modifier",
      );
    }

    const updateField = accepted ? 'acceptedCount' : 'rejectedCount';

    const updated = await this.clothesModel
      .findByIdAndUpdate(
        clotheId,
        { $inc: { [updateField]: 1 } },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Clothe with ID ${clotheId} not found`);
    }

    return updated;
  }

  // Obtenir les vêtements avec beaucoup de rejets (suggestions de vente)
  async getSellSuggestions(userId: string): Promise<Clothes[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Invalid user ID format');
    }

    const suggestions = await this.clothesModel
      .find({
        userId: new Types.ObjectId(userId),
        rejectedCount: { $gte: 3 },
      })
      .exec();

    return suggestions.filter((cloth) => {
      const total = cloth.acceptedCount + cloth.rejectedCount;
      if (total === 0) return false;
      const rejectRatio = cloth.rejectedCount / total;
      return rejectRatio > 0.6;
    });
  }
}