import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { RemoveFromCartDto } from './dto/remove-from-cart.dto';

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer le panier de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Panier récupéré avec succès' })
  async getCart(@Request() req: { user: { id: string } }) {
    return this.cartService.getCart(req.user.id);
  }

  @Post('add')
  @ApiOperation({ summary: 'Ajouter un article au panier' })
  @ApiResponse({ status: 201, description: 'Article ajouté au panier' })
  @ApiResponse({ status: 404, description: 'Article non trouvé' })
  @ApiResponse({ status: 400, description: 'Article déjà vendu ou déjà dans le panier' })
  async addToCart(
    @Request() req: { user: { id: string } },
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToCart(req.user.id, dto.storeItemId);
  }

  @Post('remove')
  @ApiOperation({ summary: 'Retirer un article du panier' })
  @ApiResponse({ status: 200, description: 'Article retiré du panier' })
  @ApiResponse({ status: 404, description: 'Article non trouvé dans le panier' })
  async removeFromCart(
    @Request() req: { user: { id: string } },
    @Body() dto: RemoveFromCartDto,
  ) {
    return this.cartService.removeFromCart(req.user.id, dto.storeItemId);
  }

  @Delete('clear')
  @ApiOperation({ summary: 'Vider le panier' })
  @ApiResponse({ status: 200, description: 'Panier vidé avec succès' })
  async clearCart(@Request() req: { user: { id: string } }) {
    return this.cartService.clearCart(req.user.id);
  }

  @Get('check-status')
  @ApiOperation({ summary: 'Vérifier le statut des articles dans le panier' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retourne un objet { storeItemId: "available" | "sold" }' 
  })
  async checkItemsStatus(@Request() req: { user: { id: string } }) {
    return this.cartService.checkItemsStatus(req.user.id);
  }
}

