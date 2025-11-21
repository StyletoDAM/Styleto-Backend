import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserPreferences, UserPreferencesDocument } from '../schemas/user-preferences.schema';

@Injectable()
export class UserPreferencesService {
  constructor(
    @InjectModel(UserPreferences.name)
    private preferencesModel: Model<UserPreferencesDocument>,
  ) {}

  /**
   * Met à jour les préférences après une correction utilisateur
   */
  async updateFromCorrection(
    userId: string,
    correction: {
      category: string;
      style: string;
      season: string;
    },
  ): Promise<UserPreferences> {
    // Convertit userId en ObjectId
    const userObjectId = new Types.ObjectId(userId);

    // Cherche les préférences existantes ou créé nouvelles
    let prefs = await this.preferencesModel.findOne({ userId: userObjectId }).exec();

    if (!prefs) {
      prefs = new this.preferencesModel({
        userId: userObjectId,
        correctionStats: {
          styles: {},
          seasons: {},
          categories: {},
        },
        totalCorrections: 0,
      });
    }

    // Normalise les valeurs en lowercase
    const normalizedCategory = correction.category.toLowerCase();
    const normalizedStyle = correction.style.toLowerCase();
    const normalizedSeason = correction.season.toLowerCase();

    // Incrémente les compteurs
    if (!prefs.correctionStats.styles) prefs.correctionStats.styles = {};
    if (!prefs.correctionStats.seasons) prefs.correctionStats.seasons = {};
    if (!prefs.correctionStats.categories) prefs.correctionStats.categories = {};

    prefs.correctionStats.styles[normalizedStyle] =
      (prefs.correctionStats.styles[normalizedStyle] || 0) + 1;

    prefs.correctionStats.seasons[normalizedSeason] =
      (prefs.correctionStats.seasons[normalizedSeason] || 0) + 1;

    prefs.correctionStats.categories[normalizedCategory] =
      (prefs.correctionStats.categories[normalizedCategory] || 0) + 1;

    prefs.totalCorrections += 1;

    // Calcule les préférences dominantes
    prefs.preferences = this.calculatePreferences(
      prefs.correctionStats,
      prefs.totalCorrections,
    );

    await prefs.save();
    return prefs;
  }

  /**
   * Calcule le style/saison préféré de l'utilisateur
   */
  private calculatePreferences(stats: any, total: number) {
    // Trouve le style le plus fréquent
    const styleEntries = Object.entries(stats.styles || {});
    const topStyle = styleEntries.reduce(
      (max: any, [style, count]: any) =>
        count > (max.count || 0) ? { style, count } : max,
      { style: '', count: 0 },
    );

    // Trouve la saison la plus fréquente
    const seasonEntries = Object.entries(stats.seasons || {});
    const topSeason = seasonEntries.reduce(
      (max: any, [season, count]: any) =>
        count > (max.count || 0) ? { season, count } : max,
      { season: '', count: 0 },
    );

    return {
      preferredStyle: topStyle.style || null,
      preferredSeason: topSeason.season || null,
      styleConfidence: total > 0 ? (topStyle.count as number) / total : 0,
      seasonConfidence: total > 0 ? (topSeason.count as number) / total : 0,
    };
  }

  /**
   * Récupère les préférences d'un utilisateur
   */
  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const userObjectId = new Types.ObjectId(userId);
    return this.preferencesModel.findOne({ userId: userObjectId }).exec();
  }

  /**
   * Applique un boost de personnalisation aux prédictions IA
   */
  applyPersonalizationBoost(
    aiPrediction: {
      style: string;
      season: string;
      styleConfidence?: number;
      seasonConfidence?: number;
    },
    userPrefs: UserPreferences | null,
  ): {
    style: string;
    season: string;
    personalizedStyle?: string;
    personalizedSeason?: string;
    wasPersonalized: boolean;
  } {
    // Si pas assez de données utilisateur (< 5 corrections), retourne prediction IA normale
    if (!userPrefs || userPrefs.totalCorrections < 5) {
      return {
        ...aiPrediction,
        wasPersonalized: false,
      };
    }

    const result: any = {
      style: aiPrediction.style,
      season: aiPrediction.season,
      wasPersonalized: true,
    };

    // Si l'utilisateur a un style préféré fort (>50% de ses corrections)
    if (
      userPrefs.preferences.preferredStyle &&
      userPrefs.preferences.styleConfidence! > 0.5
    ) {
      result.personalizedStyle = userPrefs.preferences.preferredStyle;
      result.styleBoostApplied = true;
    }

    // Si l'utilisateur a une saison préférée forte (>50% de ses corrections)
    if (
      userPrefs.preferences.preferredSeason &&
      userPrefs.preferences.seasonConfidence! > 0.5
    ) {
      result.personalizedSeason = userPrefs.preferences.preferredSeason;
      result.seasonBoostApplied = true;
    }

    return result;
  }
}