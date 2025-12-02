import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ClothesService } from './clothes.service';
import { CreateClotheDto } from './dto/create-clothe.dto';
import { UpdateClotheDto } from './dto/update-clothe.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('Clothes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cloth')
export class ClothController {
  constructor(private readonly clothService: ClothesService) {}

  // ==========================================
  // ROUTES SPÉCIFIQUES EN PREMIER
  // ==========================================
  
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new clothing item (user from JWT)' })
  async create(@Body() createClothDto: CreateClotheDto, @GetUser() user: any) {
    // ... votre code existant
  }

  @Get('corrections')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exporter les vêtements corrigés pour fine-tuning' })
  async getCorrections() {
    return await this.clothService.findCorrected();
  }

  @Get('stats/global')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Statistiques globales des corrections' })
  async getGlobalStats() {
    return await this.clothService.getGlobalCorrectionStats();
  }

  @Get('stats/me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mes statistiques de corrections et préférences' })
  async getMyStats(@GetUser() user: any) {
    if (!user?.id) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return await this.clothService.getUserStats(user.id);
  }

  // ✅ DÉPLACÉ ICI - AVANT @Get(':id')
  @Get('sell-suggestions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtenir les vêtements à vendre (rejetés plusieurs fois)' })
  @ApiBearerAuth()
  async getSellSuggestions(@GetUser() user: any) {
    if (!user?.id) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return await this.clothService.getSellSuggestions(user.id);
  }

  @Get('my')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Récupérer mes vêtements' })
  async findMyClothes(@GetUser() user: any) {
    if (!user?.id) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return await this.clothService.findByUserId(user.id);
  }

  // ==========================================
  // ROUTES GÉNÉRIQUES EN DERNIER
  // ==========================================

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve all clothing items' })
  async findAll() {
    return await this.clothService.findAll();
  }

  // ⚠️ Cette route doit être EN DERNIER parmi les GET
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a clothing item by ID' })
  async findOne(@Param('id') id: string) {
    const cloth = await this.clothService.findOne(id);
    if (!cloth)
      throw new NotFoundException(`No clothing item found with ID ${id}`);
    return cloth;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing clothing item' })
  async update(
    @Param('id') id: string,
    @Body() updateClothDto: UpdateClotheDto,
  ) {
    try {
      return await this.clothService.update(id, updateClothDto);
    } catch (error) {
      throw new NotFoundException(`Unable to update clothing item with ID ${id}`);
    }
  }

  @Patch(':id/feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Incrémenter acceptedCount ou rejectedCount' })
  async updateFeedback(
    @Param('id') id: string,
    @Body('accepted') accepted: boolean,
    @GetUser() user: any,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return await this.clothService.updateFeedback(id, accepted, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un de MES vêtements' })
  async removeMyClothe(@Param('id') id: string, @GetUser() user: any) {
    if (!user?.id) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    const success = await this.clothService.removeMyClothe(id, user.id);
    if (!success) {
      throw new NotFoundException(
        "Vêtement non trouvé ou vous n'êtes pas autorisé à le supprimer",
      );
    }
    return;
  }
}