// src/ai-engine/ai-engine.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface ProcessFrameResponse {
  success: boolean;
  frame?: string; // Base64 encoded result
  error?: string;
  fps_hint?: string;
}

@Injectable()
export class AIEngineService implements OnModuleInit {
  private readonly logger = new Logger(AIEngineService.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private isHealthy = false;

  constructor() {
    // URL du service Python (modifiable via variable d'environnement)
    this.baseUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000, // 5 secondes max pour éviter les blocages
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async onModuleInit() {
    // Vérifier que le service Python est disponible au démarrage
    await this.checkHealth();
  }

  /**
   * Vérifie la santé du service Python
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 2000 });
      
      if (response.data.status === 'ok') {
        this.isHealthy = true;
        this.logger.log(
          `✅ Service Python VTO connecté (${response.data.cache_size} images en cache)`,
        );
        return true;
      }
      
      this.isHealthy = false;
      return false;
    } catch (error) {
      this.isHealthy = false;
      this.logger.warn(
        `⚠️  Service Python VTO indisponible sur ${this.baseUrl}. Le VTO ne sera pas disponible.`,
      );
      return false;
    }
  }

  /**
   * Traite une frame avec une liste de vêtements (objets complets)
   * Utilisé par le Gateway WebSocket
   */
  async processFrameWithClothes(
    frameBase64: string,
    clothes: Array<{
      imageURL: string;
      processedImageURL?: string;
      category: string;
    }>,
  ): Promise<ProcessFrameResponse> {
    if (!this.isHealthy) {
      await this.checkHealth();
      
      if (!this.isHealthy) {
        return {
          success: false,
          error: 'Service Python VTO non disponible',
        };
      }
    }

    try {
      const payload = {
        frame: frameBase64,
        clothes: clothes,
      };

      const response = await this.client.post<ProcessFrameResponse>(
        '/process-frame',
        payload,
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Erreur traitement frame: ${error.message}`);
      
      if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED') {
        this.isHealthy = false;
      }

      return {
        success: false,
        error: error.message || 'Erreur inconnue',
      };
    }
  }

  /**
   * Retourne l'état du service Python
   */
  getHealthStatus(): boolean {
    return this.isHealthy;
  }

  /**
   * Vide le cache du service Python
   */
  async clearCache(): Promise<boolean> {
    try {
      await this.client.post('/clear-cache');
      this.logger.log('🗑️  Cache Python vidé');
      return true;
    } catch (error) {
      this.logger.error(`Erreur vidage cache: ${error.message}`);
      return false;
    }
  }
}