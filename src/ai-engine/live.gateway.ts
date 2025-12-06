// src/ai-engine/live.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { AIEngineService } from './ai-engine.service';
import { ClothesService } from '../clothes/clothes.service';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

interface ProcessFramePayload {
  frame: string; // Base64 JPEG
  clothingIds: string[]; // IDs MongoDB des vêtements sélectionnés
}

interface ClothingItem {
  imageURL: string;
  processedImageURL?: string;
  category: string;
}

@WebSocketGateway({
  cors: {
    origin: '*', // ⚠️ En production, restreindre à ton domaine
    credentials: true,
  },
  namespace: '/vto',
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveGateway.name);
  private activeConnections = new Map<string, { userId: string; connectedAt: number }>();

  constructor(
    private readonly aiService: AIEngineService,
    private readonly clothesService: ClothesService,
    private readonly jwtService: JwtService,
  ) {}

  // ==========================================
  // AUTHENTIFICATION
  // ==========================================
  
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extraire le token JWT depuis les query params ou headers
      const token = 
        client.handshake.auth?.token || 
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`❌ Connexion VTO refusée: pas de token`);
        client.emit('error', {
          message: 'Token JWT requis',
          code: 'NO_TOKEN',
        });
        client.disconnect();
        return;
      }

      // Vérifier le token
      const decoded = this.jwtService.verify(token);
      const userId = decoded.id || decoded.sub;

      if (!userId) {
        throw new UnauthorizedException('Token invalide');
      }

      // Stocker l'userId dans le socket
      client.userId = userId;

      // Enregistrer la connexion
      this.activeConnections.set(client.id, {
        userId,
        connectedAt: Date.now(),
      });

      this.logger.log(
        `🔌 Client VTO connecté: ${client.id} (User: ${userId}) - Total: ${this.activeConnections.size}`,
      );

      // Vérifier que le service Python est disponible
      if (!this.aiService.getHealthStatus()) {
        client.emit('error', {
          message: 'Service VTO temporairement indisponible',
          code: 'SERVICE_UNAVAILABLE',
        });
      } else {
        client.emit('connected', {
          message: 'Connexion VTO établie avec succès',
          status: 'ready',
          userId,
        });
      }
    } catch (error) {
      this.logger.error(`Erreur authentification VTO: ${error.message}`);
      client.emit('error', {
        message: 'Authentification échouée',
        code: 'AUTH_FAILED',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const connectionData = this.activeConnections.get(client.id);
    this.activeConnections.delete(client.id);

    if (connectionData) {
      const duration = Math.round((Date.now() - connectionData.connectedAt) / 1000);
      this.logger.log(
        `🔌 Client VTO déconnecté: ${client.id} (User: ${connectionData.userId}, Durée: ${duration}s) - Restants: ${this.activeConnections.size}`,
      );
    }
  }

  // ==========================================
  // ÉVÉNEMENTS WEBSOCKET
  // ==========================================

  /**
   * Événement principal: traiter une frame avec les vêtements de l'utilisateur
   */
  @SubscribeMessage('process_frame')
  async handleProcessFrame(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ProcessFramePayload,
  ) {
    const startTime = Date.now();

    try {
      if (!client.userId) {
        client.emit('frame_error', {
          error: 'Non authentifié',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      // Validation
      if (!payload.frame) {
        client.emit('frame_error', {
          error: 'Frame manquante',
          code: 'INVALID_PAYLOAD',
        });
        return;
      }

      if (!payload.clothingIds || payload.clothingIds.length === 0) {
        // Pas de vêtements sélectionnés → renvoyer la frame originale
        client.emit('frame_processed', {
          frame: payload.frame,
          processingTime: Date.now() - startTime,
          fps: 0,
          message: 'Aucun vêtement sélectionné',
        });
        return;
      }

      // Récupérer les vêtements depuis MongoDB
      const clothes = await this.clothesService.findManyByIds(
        payload.clothingIds,
        client.userId,
      );

      if (clothes.length === 0) {
        client.emit('frame_error', {
          error: 'Aucun vêtement valide trouvé',
          code: 'NO_CLOTHES_FOUND',
        });
        return;
      }

      // Préparer les données pour Python
      const clothingItems: ClothingItem[] = clothes.map((cloth) => ({
        imageURL: cloth.imageURL,
        processedImageURL: cloth.processedImageURL || undefined,
        category: cloth.category,
      }));

      // Appel au service Python
      const result = await this.aiService.processFrameWithClothes(
        payload.frame,
        clothingItems,
      );

      if (result.success) {
        const processingTime = Date.now() - startTime;

        client.emit('frame_processed', {
          frame: result.frame,
          processingTime,
          fps: Math.round(1000 / processingTime),
        });

        // Log si lent
        if (processingTime > 300) {
          this.logger.warn(
            `⚠️  Traitement lent: ${processingTime}ms pour user ${client.userId}`,
          );
        }
      } else {
        client.emit('frame_error', {
          error: result.error || 'Erreur inconnue',
          code: 'PROCESSING_FAILED',
        });
      }
    } catch (error) {
      this.logger.error(`Erreur traitement frame: ${error.message}`);
      client.emit('frame_error', {
        error: 'Erreur serveur',
        code: 'INTERNAL_ERROR',
        details: error.message,
      });
    }
  }

  /**
   * Événement: tester la connexion (ping/pong)
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    const connectionData = this.activeConnections.get(client.id);
    const uptime = connectionData
      ? Date.now() - connectionData.connectedAt
      : 0;

    client.emit('pong', {
      timestamp: Date.now(),
      uptime,
      userId: client.userId,
      aiServiceStatus: this.aiService.getHealthStatus() ? 'ok' : 'down',
    });
  }

  /**
   * Événement: obtenir les stats de connexion
   */
  @SubscribeMessage('get_stats')
  handleGetStats(@ConnectedSocket() client: AuthenticatedSocket) {
    const connectionData = this.activeConnections.get(client.id);

    client.emit('stats', {
      totalConnections: this.activeConnections.size,
      yourConnectionTime: connectionData
        ? Math.round((Date.now() - connectionData.connectedAt) / 1000)
        : 0,
      aiServiceStatus: this.aiService.getHealthStatus(),
    });
  }

  // ==========================================
  // MÉTHODES UTILITAIRES
  // ==========================================

  /**
   * Envoie un message à tous les clients connectés
   */
  broadcastMessage(event: string, data: any) {
    this.server.emit(event, data);
  }

  /**
   * Nombre de clients actuellement connectés
   */
  getActiveConnectionsCount(): number {
    return this.activeConnections.size;
  }

  /**
   * Déconnecte tous les clients (pour maintenance)
   */
  disconnectAll(reason: string) {
    this.logger.warn(`🔌 Déconnexion de tous les clients VTO: ${reason}`);
    this.server.emit('maintenance', {
      message: reason,
      code: 'MAINTENANCE',
    });
    this.server.disconnectSockets();
  }
}