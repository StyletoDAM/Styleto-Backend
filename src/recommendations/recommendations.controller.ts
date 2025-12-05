import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { RecommendOutfitDto } from './dto/recommend-outfit.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('Recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Post('outfit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recommandation d\'outfit basée sur ML',
    description: 'Génère une recommandation d\'outfit intelligente basée sur le style préféré, la météo et les vêtements de l\'utilisateur. Utilise un modèle ML (ResNet50) pour la similarité visuelle et la compatibilité des couleurs.',
  })
  @ApiBody({
    type: RecommendOutfitDto,
    examples: {
      casualStyle: {
        summary: 'Style Casual (exemple simple)',
        description: 'Recommandation avec style casual et météo réelle de Tunis',
        value: {
          preference: 'casual',
        },
      },
      formalWithCity: {
        summary: 'Style Formal avec ville personnalisée',
        description: 'Recommandation formelle avec météo de Paris',
        value: {
          preference: 'formal',
          city: 'Paris',
        },
      },
      sportWithTemperature: {
        summary: 'Style Sport avec température simulée',
        description: 'Recommandation sportive avec température de 20°C',
        value: {
          preference: 'sport',
          temperature: 20,
        },
      },
      completeExample: {
        summary: 'Exemple complet',
        description: 'Tous les paramètres spécifiés',
        value: {
          preference: 'casual',
          city: 'Tunis',
          temperature: 25,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Outfit recommandé avec succès',
    schema: {
      type: 'object',
      example: {
        success: true,
        outfit: {
          top: {
            _id: '507f1f77bcf86cd799439011',
            imageURL: 'https://res.cloudinary.com/demo/image/upload/v1234567890/labasni/top_casual_summer.jpg',
            category: 'top',
            color: 'blanc',
            style: 'casual',
            season: 'summer',
            userId: '507f1f77bcf86cd799439012',
            acceptedCount: 4,
            rejectedCount: 2,
          },
          bottom: {
            _id: '507f1f77bcf86cd799439013',
            imageURL: 'https://res.cloudinary.com/demo/image/upload/v1234567890/labasni/bottom_casual_summer.jpg',
            category: 'bottom',
            color: 'bleu',
            style: 'casual',
            season: 'summer',
            userId: '507f1f77bcf86cd799439012',
            acceptedCount: 2,
            rejectedCount: 1,
          },
          footwear: {
            _id: '507f1f77bcf86cd799439014',
            imageURL: 'https://res.cloudinary.com/demo/image/upload/v1234567890/labasni/footwear_casual_summer.jpg',
            category: 'footwear',
            color: 'noir',
            style: 'casual',
            season: 'summer',
            userId: '507f1f77bcf86cd799439012',
            acceptedCount: 3,
            rejectedCount: 0,
          },
        },
        metadata: {
          weather: {
            temperature: 25.5,
            condition: 'sunny',
            city: 'Tunis',
          },
          season: 'summer',
          preference: 'casual',
          explanation: {
            top: {
              reason: 'Best rated item (Score: 2.00) among 2 filtered candidates',
              score: 2.0,
            },
            bottom: {
              reason: 'Best match for top (Total Score: 0.85)',
              score: 1.0,
              visualSimilarity: 0.75,
              colorCompatibility: 0.90,
              totalScore: 0.85,
            },
            footwear: {
              reason: 'Best match for top (Total Score: 0.92)',
              score: 3.0,
              visualSimilarity: 0.80,
              colorCompatibility: 0.95,
              totalScore: 0.92,
            },
          },
        },
        clothesIds: [
          '507f1f77bcf86cd799439011',
          '507f1f77bcf86cd799439013',
          '507f1f77bcf86cd799439014',
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Requête invalide (pas assez de vêtements, préférence invalide, etc.)',
    schema: {
      type: 'object',
      example: {
        statusCode: 400,
        message: 'Vous avez seulement 2 vêtement(s). Ajoutez-en au moins 3 pour une recommandation.',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
    schema: {
      type: 'object',
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Erreur serveur (script Python introuvable, erreur d\'exécution, etc.)',
    schema: {
      type: 'object',
      example: {
        statusCode: 500,
        message: 'Script de recommandation introuvable. Vérifiez que le fichier recommender_v_finale.py existe dans le dossier "AI-Models"',
        error: 'Internal Server Error',
      },
    },
  })
  async recommendOutfit(
    @Body() dto: RecommendOutfitDto,
    @GetUser() user: any,
  ) {
    return this.recommendationsService.recommendOutfit(
      user.id,
      dto.preference,
      dto.city,
      dto.temperature,
    );
  }
}

