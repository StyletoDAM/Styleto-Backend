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

@Injectable()
export class RecommendationsService {
  private readonly pythonScriptPath = join(
    process.cwd(),
    'Recommandation d\'Outfits',
    'recommender_v_finale.py',
  );

  constructor(
    @InjectModel(Clothes.name) private clothesModel: Model<ClothesDocument>,
  ) {}

  async recommendOutfit(
    userId: string,
    preference: string,
    city?: string,
    temperature?: number,
  ): Promise<any> {
    // Vérifier que le script existe
    if (!fs.existsSync(this.pythonScriptPath)) {
      throw new BadRequestException(
        'Script de recommandation introuvable. Vérifiez que le fichier recommender_v_finale.py existe dans le dossier "Recommandation d\'Outfits"',
      );
    }

    try {
      console.log('🎽 [Recommendations] Début de la recommandation...');
      console.log(`   User ID: ${userId}`);
      console.log(`   Préférence: ${preference}`);
      console.log(`   Ville: ${city || 'Tunis'}`);

      // 1. Récupérer TOUS les vêtements de l'utilisateur depuis MongoDB
      const userClothes = await this.clothesModel
        .find({ userId: new Types.ObjectId(userId) })
        .exec();

      console.log(`   📦 ${userClothes.length} vêtements trouvés pour l'utilisateur`);

      if (userClothes.length < 3) {
        throw new BadRequestException(
          `Vous avez seulement ${userClothes.length} vêtement(s). Ajoutez-en au moins 3 pour une recommandation.`,
        );
      }

      // 2. Préparer les données pour le script Python
      const clothesData = userClothes.map((cloth) => {
        // Normaliser la catégorie pour le script Python
        let category = cloth.category?.toLowerCase() || 'top';
        
        // Mapper les catégories vers les catégories attendues par le script
        // NOTE: Les robes peuvent être utilisées comme "top" OU "bottom" selon les besoins
        const categoryMap: { [key: string]: string } = {
          'tshirt': 'top',
          't-shirt': 'top',
          'shirt': 'top',
          'top': 'top',
          'robe': 'top', // On traite les robes comme des tops par défaut
          'dress': 'top',
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
        category = categoryMap[category] || category;
        
        // Normaliser la saison (français -> anglais)
        let season = cloth.season?.toLowerCase() || 'summer';
        const seasonMap: { [key: string]: string } = {
          'été': 'summer',
          'ete': 'summer',
          'hiver': 'winter',
          'automne': 'fall',
          'printemps': 'spring',
          'all': 'summer', // "all" -> "summer" par défaut
          'toutes': 'summer',
        };
        season = seasonMap[season] || season;
        
        // Normaliser le style
        let style = cloth.style?.toLowerCase() || 'casual';
        // Si le style est une catégorie (ex: "robe"), utiliser "casual" par défaut
        if (['robe', 'dress', 'tshirt', 'pantalon', 'shoes'].includes(style)) {
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

      // 3. Préparer les données JSON pour stdin
      const clothesDataJson = JSON.stringify(clothesData);
      console.log(`   📦 ${clothesData.length} vêtements préparés pour traitement`);

      // 4. Exécuter le script Python avec les données via stdin
      const cityParam = city || 'Tunis';
      const args = [
        this.pythonScriptPath,
        '--preference', preference,
        '--city', cityParam,
      ];
      
      if (temperature) {
        args.push('--temperature', temperature.toString());
      }
      args.push('--stdin'); // Flag pour indiquer qu'on utilise stdin
      
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
            `Module Python manquant: '${moduleName}'. Veuillez installer les dépendances avec: pip3 install -r "Recommandation d'Outfits/requirements.txt"`,
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
        throw new BadRequestException(
          pythonResult.message || pythonResult.error || 'Aucun outfit recommandé',
        );
      }

      // 6. Récupérer les objets Clothes complets depuis MongoDB
      const topId = pythonResult.outfit.top;
      const bottomId = pythonResult.outfit.bottom;
      const footwearId = pythonResult.outfit.footwear;

      const [top, bottom, footwear] = await Promise.all([
        this.clothesModel.findById(topId).exec(),
        this.clothesModel.findById(bottomId).exec(),
        this.clothesModel.findById(footwearId).exec(),
      ]);

      if (!top || !bottom || !footwear) {
        throw new NotFoundException('Certains vêtements recommandés sont introuvables dans la base de données');
      }

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
      const pythonProcess = spawn('python3', args, {
        cwd: process.cwd(),
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

