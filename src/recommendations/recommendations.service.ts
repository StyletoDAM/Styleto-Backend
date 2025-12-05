import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clothes, ClothesDocument } from 'src/clothes/schemas/clothes.schema';
import { spawn } from 'child_process';
import { join } from 'path';
import * as fs from 'fs';
import axios from 'axios';

@Injectable()
export class RecommendationsService {
  private readonly pythonScriptPath = join(
    process.cwd(),
    'AI-Models',
    'recommender_v_finale.py',
  );

  constructor(
    @InjectModel(Clothes.name) private clothesModel: Model<ClothesDocument>,
  ) {}

  /**
   * Récupère la météo réelle depuis l'API OpenWeatherMap
   */
  private async getWeatherFromAPI(city: string): Promise<{ temperature: number; condition: string }> {
    try {
      const API_KEY = 'a92f907ace22631f8af40374ae0b30b6'; // Clé OpenWeatherMap
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

      // ✨ NOUVEAU: Si temperature n'est pas fournie, la récupérer depuis l'API OpenWeather
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

      // ✨ NOUVEAU: Normaliser la préférence pour correspondre aux styles des vêtements
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
        // Normaliser la catégorie pour le script Python
        let category = cloth.category?.toLowerCase() || 'top';
        
        // Mapper les catégories vers les catégories attendues par le script
        // NOTE: Les robes peuvent être utilisées comme "top" OU "bottom" selon les besoins
        // ✨ IMPORTANT: Normaliser en minuscules pour gérer les majuscules (Pants, Jacket, Shoes, Tshirt)
        const categoryMap: { [key: string]: string } = {
          'tshirt': 'top',
          't-shirt': 'top',
          'shirt': 'top',
          'top': 'top',
          'robe': 'top', // On traite les robes comme des tops par défaut
          'dress': 'top',
          'jacket': 'top', // ✨ NOUVEAU: Jacket = top
          'pantalon': 'bottom',
          'pants': 'bottom', // ✨ NOUVEAU: Pants = bottom
          'jean': 'bottom',
          'jeans': 'bottom',
          'bottom': 'bottom',
          'shoes': 'footwear',
          'shoe': 'footwear',
          'footwear': 'footwear',
          'sneakers': 'footwear',
          'chaussures': 'footwear',
        };
        // ✨ Normaliser en minuscules d'abord, puis mapper
        const normalizedCategory = category.toLowerCase();
        category = categoryMap[normalizedCategory] || category;
        
        // ✨ NOUVEAU: Log pour déboguer le mapping des catégories
        if (categoryMap[category] && categoryMap[category] !== category) {
          console.log(`   🔄 Catégorie mappée: "${cloth.category}" → "${categoryMap[category]}" (vêtement ${cloth._id})`);
        }
        
        // Normaliser la saison (français -> anglais)
        // ✨ IMPORTANT: Garder "all" tel quel pour que le script Python puisse l'utiliser
        let season = cloth.season?.toLowerCase() || 'summer';
        const seasonMap: { [key: string]: string } = {
          'été': 'summer',
          'ete': 'summer',
          'hiver': 'winter',
          'automne': 'fall',
          'printemps': 'spring',
          'all': 'all', // ✨ NOUVEAU: Garder "all" tel quel (pas "summer")
          'toutes': 'all',
          'toutes saisons': 'all',
          'all seasons': 'all',
        };
        season = seasonMap[season] || season;
        
        // Normaliser le style - IMPORTANT: Garder le style original du vêtement
        let style = cloth.style?.toLowerCase().trim() || 'casual';
        
        // ✨ NOUVEAU: Mapper les styles avec majuscules vers les styles attendus
        // Si le style contient "formal" (peu importe la casse), utiliser "formal"
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
        }
        // Si le style est une catégorie (ex: "robe"), utiliser "casual" par défaut
        else if (['robe', 'dress', 'tshirt', 'pantalon', 'shoes', 'top', 'bottom', 'footwear'].includes(style)) {
          style = 'casual';
        }
        
        // ✨ S'assurer que le style est valide (un des styles acceptés par le script Python)
        const validStyles = ['casual', 'formal', 'sport', 'elegant', 'bohemian', 'vintage', 'modern'];
        if (!validStyles.includes(style)) {
          // Si le style n'est pas reconnu, utiliser "casual" par défaut
          console.warn(`   ⚠️ Style non reconnu pour le vêtement ${cloth._id}: "${cloth.style}" → "casual"`);
          style = 'casual';
        }
        
        const clothData = {
          id: (cloth._id as Types.ObjectId).toString(),
          category: category,
          color: cloth.color?.toLowerCase() || 'unknown',
          style: style, // ✨ Style normalisé (formal, casual, sport, etc.)
          season: season,
          score: this.calculateScore(cloth.acceptedCount, cloth.rejectedCount),
          image: cloth.imageURL,
        };
        
        // ✨ Log pour déboguer la normalisation des styles
        if (cloth.style && cloth.style.toLowerCase() !== style) {
          console.log(`   🔄 Style normalisé: "${cloth.style}" → "${style}" (vêtement ${cloth._id})`);
        }
        
        return clothData;
      });

      // 3. Préparer les données JSON pour stdin
      const clothesDataJson = JSON.stringify(clothesData);
      console.log(`   📦 ${clothesData.length} vêtements préparés pour traitement`);
      
      // ✨ NOUVEAU: Log des styles disponibles pour déboguer
      const stylesCount = clothesData.reduce((acc, cloth) => {
        acc[cloth.style] = (acc[cloth.style] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`   🎨 Styles disponibles dans les vêtements:`, stylesCount);
      console.log(`   🎯 Préférence demandée: "${normalizedPreference}"`);
      
      // ✨ NOUVEAU: Vérifier par catégorie
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
      
      // ✨ NOUVEAU: Afficher les détails des vêtements avec le style demandé
      const formalTops = byCategory['top']?.filter(c => c.style === normalizedPreference) || [];
      const formalBottoms = byCategory['bottom']?.filter(c => c.style === normalizedPreference) || [];
      const formalFootwear = byCategory['footwear']?.filter(c => c.style === normalizedPreference) || [];
      
      console.log(`   📋 Détails des vêtements "${normalizedPreference}":`);
      if (formalTops.length > 0) {
        console.log(`      Tops: ${formalTops.map(t => `ID:${t.id.substring(0, 8)}... (season:${t.season})`).join(', ')}`);
      }
      if (formalBottoms.length > 0) {
        console.log(`      Bottoms: ${formalBottoms.map(b => `ID:${b.id.substring(0, 8)}... (season:${b.season})`).join(', ')}`);
      }
      if (formalFootwear.length > 0) {
        console.log(`      Footwear: ${formalFootwear.map(f => `ID:${f.id.substring(0, 8)}... (season:${f.season})`).join(', ')}`);
      }
      
      // Vérifier si on a des vêtements avec le style demandé
      const matchingStyleCount = clothesData.filter(c => c.style === normalizedPreference).length;
      console.log(`   ✅ ${matchingStyleCount} vêtement(s) au total avec le style "${normalizedPreference}"`);
      
      // ✨ NOUVEAU: Calculer la saison à partir de la température (comme le script Python)
      // Les seuils correspondent exactement à ceux du script Python recommender_v_finale.py
      const getSeasonFromTemperature = (temp: number | undefined): string => {
        if (temp === undefined) return 'summer'; // Défaut
        if (temp > 25) return 'summer';  // ✨ Modifié: > 25 au lieu de > 20
        if (temp > 17) return 'spring';  // ✨ Modifié: > 17 au lieu de > 10
        if (temp > 0) return 'fall';
        return 'winter';
      };
      
      const targetSeason = getSeasonFromTemperature(finalTemperature); // ✨ Utiliser finalTemperature au lieu de temperature
      console.log(`   🌤️ Saison déterminée par météo: ${targetSeason} (temp: ${finalTemperature}°C)`);
      
      // ✨ NOUVEAU: Vérifier les vêtements par saison (météo)
      const matchesSeason = (itemSeason: string, target: string): boolean => {
        const item = itemSeason?.toLowerCase() || '';
        const targetLower = target.toLowerCase();
        // Accepter "all" saison
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
      
      // ✨ NOUVEAU: Vérifier les vêtements avec style ET saison
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
      
      // ✨ NOUVEAU: Détecter les 3 cas et générer les messages appropriés
      const hasEnoughStyle = topsWithStyle > 0 && bottomsWithStyle > 0 && footwearWithStyle > 0;
      const hasEnoughSeason = topsWithSeason > 0 && bottomsWithSeason > 0 && footwearWithSeason > 0;
      const hasEnoughStyleAndSeason = topsWithStyleAndSeason > 0 && bottomsWithStyleAndSeason > 0 && footwearWithStyleAndSeason > 0;
      
      // Cas 1: Pas assez de vêtements pour le style
      if (!hasEnoughStyle) {
        const missingStyle: string[] = [];
        if (topsWithStyle === 0) missingStyle.push('top');
        if (bottomsWithStyle === 0) missingStyle.push('bottom');
        if (footwearWithStyle === 0) missingStyle.push('footwear');
        
        const itemNames = missingStyle.map(cat => cat === 'footwear' ? 'pair of shoes' : cat);
        let errorMessage = `Your wardrobe is missing items for the "${normalizedPreference}" style. Please add ${itemNames.length === 3 ? 'a top, a bottom, and a pair of shoes' : itemNames.length === 2 ? `a ${itemNames.join(' and a ')}` : `a ${itemNames[0]}`} to continue.`;
        throw new BadRequestException(errorMessage);
      }
      
      // Cas 2: Pas assez de vêtements pour la saison (météo)
      if (!hasEnoughSeason) {
        const missingSeason: string[] = [];
        if (topsWithSeason === 0) missingSeason.push('top');
        if (bottomsWithSeason === 0) missingSeason.push('bottom');
        if (footwearWithSeason === 0) missingSeason.push('footwear');
        
        const itemNames = missingSeason.map(cat => cat === 'footwear' ? 'pair of shoes' : cat);
        const seasonName = targetSeason.charAt(0).toUpperCase() + targetSeason.slice(1); // Capitalize first letter
        let errorMessage = `Your wardrobe is missing items for the ${seasonName} weather. Please add ${itemNames.length === 3 ? 'a top, a bottom, and a pair of shoes' : itemNames.length === 2 ? `a ${itemNames.join(' and a ')}` : `a ${itemNames[0]}`} to continue.`;
        throw new BadRequestException(errorMessage);
      }
      
      // Cas 3: Pas assez de vêtements pour le style ET la saison
      if (!hasEnoughStyleAndSeason) {
        const missingBoth: string[] = [];
        if (topsWithStyleAndSeason === 0) missingBoth.push('top');
        if (bottomsWithStyleAndSeason === 0) missingBoth.push('bottom');
        if (footwearWithStyleAndSeason === 0) missingBoth.push('footwear');
        
        const itemNames = missingBoth.map(cat => cat === 'footwear' ? 'pair of shoes' : cat);
        const seasonName = targetSeason.charAt(0).toUpperCase() + targetSeason.slice(1); // Capitalize first letter
        let errorMessage = `Your wardrobe is missing items for the "${normalizedPreference}" style and ${seasonName} weather. Please add ${itemNames.length === 3 ? 'a top, a bottom, and a pair of shoes' : itemNames.length === 2 ? `a ${itemNames.join(' and a ')}` : `a ${itemNames[0]}`} to continue.`;
        throw new BadRequestException(errorMessage);
      }

      // 4. Exécuter le script Python avec les données via stdin
      const cityParam = city || 'Tunis';
      // Utiliser un chemin relatif car le cwd sera AI-Models
      const args = [
        'recommender_v_finale.py',
        '--preference', normalizedPreference, // ✨ Utiliser la préférence normalisée
        '--city', cityParam,
        '--temperature', finalTemperature.toString(), // ✨ TOUJOURS passer la température (récupérée depuis API si non fournie)
      ];
      args.push('--stdin'); // Flag pour indiquer qu'on utilise stdin
      
      console.log(`   🔄 Exécution du script Python avec température: ${finalTemperature}°C`);
      
      console.log(`   🔄 Exécution du script Python...`);
      console.log(`   Command: python3 ${args.join(' ')}`);

      // Timeout de 2 minutes (120 secondes) pour le script Python
      const timeout = 120000; // 2 minutes en millisecondes
      
      const { stdout, stderr } = await this.executePythonScript(args, clothesDataJson, timeout);

      if (stderr && !stderr.includes('Warning') && !stderr.includes('DeprecationWarning')) {
        console.error('❌ Erreur Python:', stderr);
        
        // Vérifier si c'est une erreur de module manquant
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
      console.log(`   📄 Sortie (premiers 500 caractères): ${stdout.substring(0, 500)}...`);
      console.log(`   📏 Taille de la sortie: ${stdout.length} caractères`);

      // 5. Parser la réponse JSON du script Python
      const pythonResult = this.parsePythonOutput(stdout);
      
      if (!pythonResult.success || !pythonResult.outfit) {
        // ✨ NOUVEAU: Si le script Python échoue, utiliser le message générique
        // (Les vérifications spécifiques ont déjà été faites avant l'appel au script)
        let errorMessage = pythonResult.message || pythonResult.error;
        
        if (!errorMessage) {
          // Message générique si le script Python n'a pas fourni de message
          errorMessage = `Unable to generate a complete "${normalizedPreference}" outfit. `;
          const seasonName = targetSeason.charAt(0).toUpperCase() + targetSeason.slice(1);
          errorMessage = `Your wardrobe is missing items for the "${normalizedPreference}" style and ${seasonName} weather. Please add a top, a bottom, and a pair of shoes to continue.`;
        } else {
          // Si le script Python a fourni un message, le traduire en anglais user-friendly
          errorMessage = errorMessage
            .replace(/Impossible de créer/i, 'Unable to create')
            .replace(/outfit complet/i, 'complete outfit')
            .replace(/style/i, 'style')
            .replace(/Assurez-vous/i, 'Make sure')
            .replace(/dressing/i, 'wardrobe')
            .replace(/Catégories manquantes/i, 'Missing categories')
            .replace(/chaussures/i, 'shoes');
        }
        
        throw new BadRequestException(errorMessage);
      }
      
      // ✨ NOUVEAU: Vérifier que tous les vêtements ont le style demandé ET la saison correcte
      const topId = pythonResult.outfit.top;
      const bottomId = pythonResult.outfit.bottom;
      const footwearId = pythonResult.outfit.footwear;

      const [topCheck, bottomCheck, footwearCheck] = await Promise.all([
        this.clothesModel.findById(topId).exec(),
        this.clothesModel.findById(bottomId).exec(),
        this.clothesModel.findById(footwearId).exec(),
      ]);

      // Vérifier que tous les styles correspondent à la préférence
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
      
      // ✨ NOUVEAU: Vérifier que tous les vêtements correspondent à la saison (météo)
      const topSeason = topCheck?.season?.toLowerCase() || '';
      const bottomSeason = bottomCheck?.season?.toLowerCase() || '';
      const footwearSeason = footwearCheck?.season?.toLowerCase() || '';
      
      const seasonMatches = (itemSeason: string, target: string): boolean => {
        const item = itemSeason?.toLowerCase() || '';
        const targetLower = target.toLowerCase();
        // Accepter "all" saison
        if (item === 'all' || item === 'toutes' || item === 'all seasons' || item === 'toutes saisons' || item === '') {
          return true;
        }
        return item === targetLower;
      };
      
      // Vérifier d'abord la saison (priorité)
      const topSeasonMatch = seasonMatches(topSeason, targetSeason);
      const bottomSeasonMatch = seasonMatches(bottomSeason, targetSeason);
      const footwearSeasonMatch = seasonMatches(footwearSeason, targetSeason);
      
      if (!topSeasonMatch || !bottomSeasonMatch || !footwearSeasonMatch) {
        const missingSeasonItems: string[] = [];
        if (!topSeasonMatch) missingSeasonItems.push('top');
        if (!bottomSeasonMatch) missingSeasonItems.push('bottom');
        if (!footwearSeasonMatch) missingSeasonItems.push('footwear');
        
        const itemNames = missingSeasonItems.map(cat => cat === 'footwear' ? 'pair of shoes' : cat);
        const seasonName = targetSeason.charAt(0).toUpperCase() + targetSeason.slice(1); // Capitalize first letter
        let errorMessage = `Your wardrobe is missing items for the ${seasonName} weather. Please add ${itemNames.length === 3 ? 'a top, a bottom, and a pair of shoes' : itemNames.length === 2 ? `a ${itemNames.join(' and a ')}` : `a ${itemNames[0]}`} to continue.`;
        console.warn(`   ⚠️ Season mismatch détecté: top="${topSeason}", bottom="${bottomSeason}", footwear="${footwearSeason}", saison cible="${targetSeason}"`);
        throw new BadRequestException(errorMessage);
      }
      
      // Vérifier ensuite le style
      if (!styleMatches(topStyle, normalizedPreference) || 
          !styleMatches(bottomStyle, normalizedPreference) || 
          !styleMatches(footwearStyle, normalizedPreference)) {
        console.warn(`   ⚠️ Style mismatch détecté: top="${topStyle}", bottom="${bottomStyle}", footwear="${footwearStyle}", préférence="${normalizedPreference}"`);
        throw new BadRequestException(
          `Unable to create a complete outfit with the "${normalizedPreference}" style. ` +
          `Please make sure you have at least one top, one bottom, and one pair of shoes with the "${normalizedPreference}" style in your wardrobe.`
        );
      }

      // 6. Récupérer les objets Clothes complets depuis MongoDB (déjà récupérés pour la vérification)
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
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      // Si l'erreur contient des informations sur les modules Python manquants
      if (error.message && (error.message.includes('ModuleNotFoundError') || error.message.includes('No module named'))) {
        const moduleMatch = error.message.match(/No module named ['"]([^'"]+)['"]/);
        const moduleName = moduleMatch ? moduleMatch[1] : 'unknown';
        throw new BadRequestException(
          `Module Python manquant: '${moduleName}'. Veuillez installer les dépendances avec: pip3 install -r "Recommandation d'Outfits/requirements.txt"`,
        );
      }
      
      // Si c'est un timeout
      if (error.message && error.message.includes('Timeout')) {
        throw new BadRequestException(
          `Le script Python prend trop de temps à s'exécuter. Cela peut être dû au chargement des modèles ML (ResNet50). Veuillez réessayer ou vérifier les logs du serveur.`,
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

      // Écrire les données dans stdin
      pythonProcess.stdin.write(inputData);
      pythonProcess.stdin.end();

      // Collecter stdout
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collecter stderr
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Gérer la fin du processus
      pythonProcess.on('close', (code) => {
        if (code !== 0 && !stdout.includes('success')) {
          reject(new Error(`Script Python terminé avec le code ${code}. stderr: ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      // Gérer les erreurs
      pythonProcess.on('error', (error) => {
        reject(new Error(`Erreur lors du lancement du script Python: ${error.message}`));
      });

      // Timeout
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
      // Chercher un JSON dans la sortie
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Si pas de JSON, essayer de parser la sortie texte
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

