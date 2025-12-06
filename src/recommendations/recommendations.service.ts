// src/recommendations/recommendations.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clothes, ClothesDocument } from 'src/clothes/schemas/clothes.schema';
import { spawn } from 'child_process';
import { join } from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { SubscriptionsService } from '../subscriptions/subscriptions.service'; // ✨ NOUVEAU

@Injectable()
export class RecommendationsService {
  private readonly pythonScriptPath = join(
    process.cwd(),
    'AI-Models',
    'recommender_v_finale.py',
  );

  constructor(
    @InjectModel(Clothes.name) private clothesModel: Model<ClothesDocument>,
    private subscriptionsService: SubscriptionsService, // ✨ NOUVEAU
  ) {}

  /**
   * Récupère la météo réelle depuis l'API OpenWeatherMap
   */
  private async getWeatherFromAPI(city: string): Promise<{ temperature: number; condition: string }> {
    try {
      const API_KEY = 'a92f907ace22631f8af40374ae0b30b6';
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`;
      
      const response = await axios.get(url, { timeout: 5000 });
      const temp = response.data.main.temp;
      const condition = response.data.weather[0].main;
      
      console.log(`   🌤️ Météo réelle récupérée depuis API: ${temp}°C, ${condition} (ville: ${city})`);
      return { temperature: temp, condition };
    } catch (error: any) {
      console.error(`   ⚠️ Erreur API météo pour ${city}: ${error.message}. Utilisation de 20°C par défaut.`);
      return { temperature: 20, condition: 'sunny' };
    }
  }

  async recommendOutfit(
    userId: string,
    preference: string,
    city?: string,
    temperature?: number,
  ): Promise<any> {
    // ✨ NOUVEAU: Vérifier le quota AVANT de faire la recommandation
    console.log('📊 [Recommendations] Vérification du quota...');
    const quotaCheck = await this.subscriptionsService.canGenerateOutfit(userId);

    if (!quotaCheck.allowed) {
      console.log(`❌ [Recommendations] Quota atteint pour user ${userId}`);
      throw new ForbiddenException(
        quotaCheck.message || 'You have reached your monthly limit for outfit suggestions. Upgrade to Premium for unlimited suggestions.',
      );
    }

    console.log(`✅ [Recommendations] Quota OK - Remaining: ${quotaCheck.remaining}`);

    // Vérifier que le script existe
    if (!fs.existsSync(this.pythonScriptPath)) {
      throw new BadRequestException(
        'Script de recommandation introuvable. Vérifiez que le fichier recommender_v_finale.py existe dans le dossier "AI-Models"',
      );
    }

    try {
      console.log('🎽 [Recommendations] Début de la recommandation...');
      console.log(`   User ID: ${userId}`);
      console.log(`   Préférence: ${preference}`);
      console.log(`   Ville: ${city || 'Tunis'}`);

      // Récupérer la température
      let finalTemperature: number;
      if (temperature !== undefined && temperature !== null) {
        finalTemperature = temperature;
        console.log(`   🌤️ Température fournie par l'utilisateur: ${finalTemperature}°C`);
      } else {
        const cityParam = city || 'Tunis';
        console.log(`   🌤️ Récupération de la météo depuis l'API pour ${cityParam}...`);
        const weather = await this.getWeatherFromAPI(cityParam);
        finalTemperature = weather.temperature;
        console.log(`   ✅ Température récupérée: ${finalTemperature}°C`);
      }

      const normalizedPreference = preference.toLowerCase().trim();

      // 1. Récupérer TOUS les vêtements de l'utilisateur depuis MongoDB
      const userClothes = await this.clothesModel
        .find({ userId: new Types.ObjectId(userId) })
        .exec();

      console.log(`   📦 ${userClothes.length} vêtements trouvés pour l'utilisateur`);

      if (userClothes.length < 3) {
        throw new BadRequestException(
          `You only have ${userClothes.length} item(s) in your wardrobe. Please add at least 3 items to get outfit recommendations.`,
        );
      }

      // 2. Préparer les données pour le script Python
      const clothesData = userClothes.map((cloth) => {
        let category = cloth.category?.toLowerCase() || 'top';
        
        const categoryMap: { [key: string]: string } = {
          'tshirt': 'top',
          't-shirt': 'top',
          'shirt': 'top',
          'top': 'top',
          'robe': 'top',
          'dress': 'top',
          'jacket': 'top',
          'pantalon': 'bottom',
          'pants': 'bottom',
          'jean': 'bottom',
          'jeans': 'bottom',
          'bottom': 'bottom',
          'shoes': 'footwear',
          'shoe': 'footwear',
          'footwear': 'footwear',
          'sneakers': 'footwear',
          'chaussures': 'footwear',
        };
        const normalizedCategory = category.toLowerCase();
        category = categoryMap[normalizedCategory] || category;
        
        let season = cloth.season?.toLowerCase() || 'summer';
        const seasonMap: { [key: string]: string } = {
          'été': 'summer',
          'ete': 'summer',
          'hiver': 'winter',
          'automne': 'fall',
          'printemps': 'spring',
          'all': 'all',
          'toutes': 'all',
          'toutes saisons': 'all',
          'all seasons': 'all',
        };
        season = seasonMap[season] || season;
        
        let style = cloth.style?.toLowerCase().trim() || 'casual';
        
        if (style.includes('formal')) {
          style = 'formal';
        } else if (style.includes('sport')) {
          style = 'sport';
        } else if (style.includes('casual')) {
          style = 'casual';
        } else if (style.includes('elegant')) {
          style = 'elegant';
        } else if (style.includes('bohemian')) {
          style = 'bohemian';
        } else if (style.includes('vintage')) {
          style = 'vintage';
        } else if (style.includes('modern')) {
          style = 'modern';
        } else if (['robe', 'dress', 'tshirt', 'pantalon', 'shoes', 'top', 'bottom', 'footwear'].includes(style)) {
          style = 'casual';
        }
        
        const validStyles = ['casual', 'formal', 'sport', 'elegant', 'bohemian', 'vintage', 'modern'];
        if (!validStyles.includes(style)) {
          console.warn(`   ⚠️ Style non reconnu pour le vêtement ${cloth._id}: "${cloth.style}" → "casual"`);
          style = 'casual';
        }
        
        return {
          id: (cloth._id as Types.ObjectId).toString(),
          category: category,
          color: cloth.color?.toLowerCase() || 'unknown',
          style: style,
          season: season,
          score: this.calculateScore(cloth.acceptedCount, cloth.rejectedCount),
          image: cloth.imageURL,
        };
      });

      const clothesDataJson = JSON.stringify(clothesData);
      console.log(`   📦 ${clothesData.length} vêtements préparés pour traitement`);
      
      const stylesCount = clothesData.reduce((acc, cloth) => {
        acc[cloth.style] = (acc[cloth.style] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`   🎨 Styles disponibles dans les vêtements:`, stylesCount);
      console.log(`   🎯 Préférence demandée: "${normalizedPreference}"`);
      
      type ClothDataItem = {
        id: string;
        category: string;
        color: string;
        style: string;
        season: string;
        score: number;
        image: string;
      };
      const byCategory = clothesData.reduce((acc, cloth) => {
        if (!acc[cloth.category]) acc[cloth.category] = [];
        acc[cloth.category].push(cloth);
        return acc;
      }, {} as Record<string, ClothDataItem[]>);
      
      const topsWithStyle = byCategory['top']?.filter(c => c.style === normalizedPreference).length || 0;
      const bottomsWithStyle = byCategory['bottom']?.filter(c => c.style === normalizedPreference).length || 0;
      const footwearWithStyle = byCategory['footwear']?.filter(c => c.style === normalizedPreference).length || 0;
      
      console.log(`   📊 Vêtements avec style "${normalizedPreference}" par catégorie:`);
      console.log(`      - Top: ${topsWithStyle}`);
      console.log(`      - Bottom: ${bottomsWithStyle}`);
      console.log(`      - Footwear: ${footwearWithStyle}`);
      
      const getSeasonFromTemperature = (temp: number | undefined): string => {
        if (temp === undefined) return 'summer';
        if (temp > 25) return 'summer';
        if (temp > 17) return 'spring';
        if (temp > 0) return 'fall';
        return 'winter';
      };
      
      const targetSeason = getSeasonFromTemperature(finalTemperature);
      console.log(`   🌤️ Saison déterminée par météo: ${targetSeason} (temp: ${finalTemperature}°C)`);
      
      const matchesSeason = (itemSeason: string, target: string): boolean => {
        const item = itemSeason?.toLowerCase() || '';
        const targetLower = target.toLowerCase();
        if (item === 'all' || item === 'toutes' || item === 'all seasons' || item === 'toutes saisons' || item === '') {
          return true;
        }
        return item === targetLower;
      };
      
      const topsWithSeason = byCategory['top']?.filter(c => matchesSeason(c.season, targetSeason)).length || 0;
      const bottomsWithSeason = byCategory['bottom']?.filter(c => matchesSeason(c.season, targetSeason)).length || 0;
      const footwearWithSeason = byCategory['footwear']?.filter(c => matchesSeason(c.season, targetSeason)).length || 0;
      
      console.log(`   📊 Vêtements avec saison "${targetSeason}" (météo) par catégorie:`);
      console.log(`      - Top: ${topsWithSeason}`);
      console.log(`      - Bottom: ${bottomsWithSeason}`);
      console.log(`      - Footwear: ${footwearWithSeason}`);
      
      const topsWithStyleAndSeason = byCategory['top']?.filter(c => 
        c.style === normalizedPreference && matchesSeason(c.season, targetSeason)
      ).length || 0;
      const bottomsWithStyleAndSeason = byCategory['bottom']?.filter(c => 
        c.style === normalizedPreference && matchesSeason(c.season, targetSeason)
      ).length || 0;
      const footwearWithStyleAndSeason = byCategory['footwear']?.filter(c => 
        c.style === normalizedPreference && matchesSeason(c.season, targetSeason)
      ).length || 0;
      
      console.log(`   📊 Vêtements avec style "${normalizedPreference}" ET saison "${targetSeason}" par catégorie:`);
      console.log(`      - Top: ${topsWithStyleAndSeason}`);
      console.log(`      - Bottom: ${bottomsWithStyleAndSeason}`);
      console.log(`      - Footwear: ${footwearWithStyleAndSeason}`);
      
      const hasEnoughStyle = topsWithStyle > 0 && bottomsWithStyle > 0 && footwearWithStyle > 0;
      const hasEnoughSeason = topsWithSeason > 0 && bottomsWithSeason > 0 && footwearWithSeason > 0;
      const hasEnoughStyleAndSeason = topsWithStyleAndSeason > 0 && bottomsWithStyleAndSeason > 0 && footwearWithStyleAndSeason > 0;
      
      // ✨ IMPORTANT: Ces erreurs ne comptent PAS dans le quota
      if (!hasEnoughStyle) {
        const missingStyle: string[] = [];
        if (topsWithStyle === 0) missingStyle.push('top');
        if (bottomsWithStyle === 0) missingStyle.push('bottom');
        if (footwearWithStyle === 0) missingStyle.push('footwear');
        
        const itemNames = missingStyle.map(cat => cat === 'footwear' ? 'pair of shoes' : cat);
        let errorMessage = `Your wardrobe is missing items for the "${normalizedPreference}" style. Please add ${itemNames.length === 3 ? 'a top, a bottom, and a pair of shoes' : itemNames.length === 2 ? `a ${itemNames.join(' and a ')}` : `a ${itemNames[0]}`} to continue.`;
        throw new BadRequestException(errorMessage);
      }
      
      if (!hasEnoughSeason) {
        const missingSeason: string[] = [];
        if (topsWithSeason === 0) missingSeason.push('top');
        if (bottomsWithSeason === 0) missingSeason.push('bottom');
        if (footwearWithSeason === 0) missingSeason.push('footwear');
        
        const itemNames = missingSeason.map(cat => cat === 'footwear' ? 'pair of shoes' : cat);
        const seasonName = targetSeason.charAt(0).toUpperCase() + targetSeason.slice(1);
        let errorMessage = `Your wardrobe is missing items for the ${seasonName} weather. Please add ${itemNames.length === 3 ? 'a top, a bottom, and a pair of shoes' : itemNames.length === 2 ? `a ${itemNames.join(' and a ')}` : `a ${itemNames[0]}`} to continue.`;
        throw new BadRequestException(errorMessage);
      }
      
      if (!hasEnoughStyleAndSeason) {
        const missingBoth: string[] = [];
        if (topsWithStyleAndSeason === 0) missingBoth.push('top');
        if (bottomsWithStyleAndSeason === 0) missingBoth.push('bottom');
        if (footwearWithStyleAndSeason === 0) missingBoth.push('footwear');
        
        const itemNames = missingBoth.map(cat => cat === 'footwear' ? 'pair of shoes' : cat);
        const seasonName = targetSeason.charAt(0).toUpperCase() + targetSeason.slice(1);
        let errorMessage = `Your wardrobe is missing items for the "${normalizedPreference}" style and ${seasonName} weather. Please add ${itemNames.length === 3 ? 'a top, a bottom, and a pair of shoes' : itemNames.length === 2 ? `a ${itemNames.join(' and a ')}` : `a ${itemNames[0]}`} to continue.`;
        throw new BadRequestException(errorMessage);
      }

      // 4. Exécuter le script Python
      const cityParam = city || 'Tunis';
      const args = [
        'recommender_v_finale.py',
        '--preference', normalizedPreference,
        '--city', cityParam,
        '--temperature', finalTemperature.toString(),
        '--stdin',
      ];
      
      console.log(`   🔄 Exécution du script Python avec température: ${finalTemperature}°C`);
      console.log(`   Command: python3 ${args.join(' ')}`);

      const timeout = 120000;
      const { stdout, stderr } = await this.executePythonScript(args, clothesDataJson, timeout);

      if (stderr && !stderr.includes('Warning') && !stderr.includes('DeprecationWarning')) {
        console.error('❌ Erreur Python:', stderr);
        
        if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
          const moduleMatch = stderr.match(/No module named ['"]([^'"]+)['"]/);
          const moduleName = moduleMatch ? moduleMatch[1] : 'unknown';
          throw new BadRequestException(
            `Module Python manquant: '${moduleName}'. Veuillez installer les dépendances avec: pip3 install -r "AI-Models/requirements.txt"`,
          );
        }
        
        throw new BadRequestException(`Erreur lors de la recommandation: ${stderr.substring(0, 500)}`);
      }

      console.log(`   ✅ Script Python exécuté avec succès`);

      // 5. Parser la réponse JSON
      const pythonResult = this.parsePythonOutput(stdout);
      
      if (!pythonResult.success || !pythonResult.outfit) {
        let errorMessage = pythonResult.message || pythonResult.error;
        
        if (!errorMessage) {
          const seasonName = targetSeason.charAt(0).toUpperCase() + targetSeason.slice(1);
          errorMessage = `Your wardrobe is missing items for the "${normalizedPreference}" style and ${seasonName} weather. Please add a top, a bottom, and a pair of shoes to continue.`;
        }
        
        throw new BadRequestException(errorMessage);
      }
      
      const topId = pythonResult.outfit.top;
      const bottomId = pythonResult.outfit.bottom;
      const footwearId = pythonResult.outfit.footwear;

      const [topCheck, bottomCheck, footwearCheck] = await Promise.all([
        this.clothesModel.findById(topId).exec(),
        this.clothesModel.findById(bottomId).exec(),
        this.clothesModel.findById(footwearId).exec(),
      ]);

      const topStyle = topCheck?.style?.toLowerCase().trim() || '';
      const bottomStyle = bottomCheck?.style?.toLowerCase().trim() || '';
      const footwearStyle = footwearCheck?.style?.toLowerCase().trim() || '';
      
      const styleMatches = (style: string, preference: string): boolean => {
        if (style.includes(preference)) return true;
        if (preference === 'formal' && style.includes('formal')) return true;
        if (preference === 'sport' && style.includes('sport')) return true;
        if (preference === 'casual' && style.includes('casual')) return true;
        return false;
      };
      
      const topSeason = topCheck?.season?.toLowerCase() || '';
      const bottomSeason = bottomCheck?.season?.toLowerCase() || '';
      const footwearSeason = footwearCheck?.season?.toLowerCase() || '';
      
      const seasonMatches = (itemSeason: string, target: string): boolean => {
        const item = itemSeason?.toLowerCase() || '';
        const targetLower = target.toLowerCase();
        if (item === 'all' || item === 'toutes' || item === 'all seasons' || item === 'toutes saisons' || item === '') {
          return true;
        }
        return item === targetLower;
      };
      
      const topSeasonMatch = seasonMatches(topSeason, targetSeason);
      const bottomSeasonMatch = seasonMatches(bottomSeason, targetSeason);
      const footwearSeasonMatch = seasonMatches(footwearSeason, targetSeason);
      
      if (!topSeasonMatch || !bottomSeasonMatch || !footwearSeasonMatch) {
        const missingSeasonItems: string[] = [];
        if (!topSeasonMatch) missingSeasonItems.push('top');
        if (!bottomSeasonMatch) missingSeasonItems.push('bottom');
        if (!footwearSeasonMatch) missingSeasonItems.push('footwear');
        
        const itemNames = missingSeasonItems.map(cat => cat === 'footwear' ? 'pair of shoes' : cat);
        const seasonName = targetSeason.charAt(0).toUpperCase() + targetSeason.slice(1);
        let errorMessage = `Your wardrobe is missing items for the ${seasonName} weather. Please add ${itemNames.length === 3 ? 'a top, a bottom, and a pair of shoes' : itemNames.length === 2 ? `a ${itemNames.join(' and a ')}` : `a ${itemNames[0]}`} to continue.`;
        console.warn(`   ⚠️ Season mismatch détecté`);
        throw new BadRequestException(errorMessage);
      }
      
      if (!styleMatches(topStyle, normalizedPreference) || 
          !styleMatches(bottomStyle, normalizedPreference) || 
          !styleMatches(footwearStyle, normalizedPreference)) {
        console.warn(`   ⚠️ Style mismatch détecté`);
        throw new BadRequestException(
          `Unable to create a complete outfit with the "${normalizedPreference}" style. ` +
          `Please make sure you have at least one top, one bottom, and one pair of shoes with the "${normalizedPreference}" style in your wardrobe.`
        );
      }

      // ✨ NOUVEAU: Incrémenter le compteur SEULEMENT si la suggestion est réussie
      console.log(`✅ [Recommendations] Suggestion réussie - Incrémentation du compteur`);
      await this.subscriptionsService.incrementOutfitSuggestion(userId);

      const top = topCheck!;
      const bottom = bottomCheck!;
      const footwear = footwearCheck!;

      // 7. Construire la réponse finale
      const response = {
        success: true,
        outfit: {
          top: this.formatClothResponse(top),
          bottom: this.formatClothResponse(bottom),
          footwear: this.formatClothResponse(footwear),
        },
        metadata: {
          weather: pythonResult.weather || {},
          season: pythonResult.season,
          preference: preference,
          explanation: pythonResult.explanation || {},
        },
        clothesIds: [
          (top._id as Types.ObjectId).toString(),
          (bottom._id as Types.ObjectId).toString(),
          (footwear._id as Types.ObjectId).toString(),
        ],
      };

      console.log(`   ✅ Recommandation terminée avec succès`);
      return response;
    } catch (error: any) {
      console.error('❌ [Recommendations] Erreur:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      
      if (error.message && (error.message.includes('ModuleNotFoundError') || error.message.includes('No module named'))) {
        const moduleMatch = error.message.match(/No module named ['"]([^'"]+)['"]/);
        const moduleName = moduleMatch ? moduleMatch[1] : 'unknown';
        throw new BadRequestException(
          `Module Python manquant: '${moduleName}'. Veuillez installer les dépendances`,
        );
      }
      
      if (error.message && error.message.includes('Timeout')) {
        throw new BadRequestException(
          `Le script Python prend trop de temps à s'exécuter.`,
        );
      }
      
      throw new BadRequestException(`Échec de la recommandation: ${error.message}`);
    }
  }

  private calculateScore(accepts: number, rejects: number): number {
    const total = accepts + rejects;
    if (total === 0) return 0;
    return (accepts - rejects) / total;
  }

  private formatClothResponse(cloth: ClothesDocument): any {
    return {
      _id: (cloth._id as Types.ObjectId).toString(),
      imageURL: cloth.imageURL,
      category: cloth.category,
      color: cloth.color,
      style: cloth.style,
      season: cloth.season,
      userId: (cloth.userId as Types.ObjectId).toString(),
      acceptedCount: cloth.acceptedCount,
      rejectedCount: cloth.rejectedCount,
    };
  }

  private executePythonScript(
    args: string[],
    inputData: string,
    timeout: number,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const aiModelsDir = join(process.cwd(), 'AI-Models');
      const pythonProcess = spawn('python3', args, {
        cwd: aiModelsDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdin.write(inputData);
      pythonProcess.stdin.end();

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0 && !stdout.includes('success')) {
          reject(new Error(`Script Python terminé avec le code ${code}. stderr: ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Erreur lors du lancement du script Python: ${error.message}`));
      });

      const timeoutId = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error(`Timeout: Le script Python a pris plus de ${timeout / 1000} secondes à s'exécuter`));
      }, timeout);

      pythonProcess.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  private parsePythonOutput(output: string): any {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      const outfitMatch = output.match(/Outfit Suggéré.*?(\{.*\})/);
      if (outfitMatch) {
        const jsonStr = outfitMatch[1].replace(/'/g, '"');
        return {
          success: true,
          outfit: JSON.parse(jsonStr),
        };
      }

      throw new Error('Format de sortie non reconnu');
    } catch (error) {
      console.error('Erreur parsing:', error);
      throw new BadRequestException('Impossible de parser la réponse du script Python');
    }
  }
}