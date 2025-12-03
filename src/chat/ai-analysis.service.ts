import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExtractedInfo {
  phoneNumbers?: string[];
  addresses?: string[];
  emails?: string[];
  urls?: string[];
  otherInfo?: Record<string, any>;
}

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('✅ Gemini AI initialized');
    } else {
      this.logger.warn('⚠️ GEMINI_API_KEY not configured, will use regex fallback');
    }
  }

  /**
   * Analyse un message avec Gemini AI pour extraire des informations structurées
   */
  async analyzeMessage(content: string): Promise<ExtractedInfo> {
    if (!this.genAI) {
      this.logger.debug('Gemini not available, using regex fallback');
      return this.extractInfoWithRegex(content);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `Analyse ce message et extrais les informations suivantes au format JSON strict:
{
  "phoneNumbers": ["liste des numéros de téléphone trouvés"],
  "addresses": ["liste des adresses trouvées"],
  "emails": ["liste des emails trouvés"],
  "urls": ["liste des URLs trouvées"]
}

Règles:
- Si aucune information n'est trouvée, utilise un tableau vide []
- Les numéros de téléphone peuvent être dans différents formats (international, local, etc.)
- Les adresses peuvent être complètes ou partielles (ex: "123 paris", "rue de la paix", "paris", "123 rue de paris", etc.)
- Détecte TOUTES les adresses, même simples comme "123 paris" ou juste "paris" si cela semble être une adresse
- Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire, sans markdown, sans code blocks

Message: "${content}"`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text().trim();
      
      // Nettoyer la réponse (enlever markdown si présent)
      let jsonText = text;
      if (text.startsWith('```json')) {
        jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (text.startsWith('```')) {
        jsonText = text.replace(/```\n?/g, '').trim();
      }

      // Parser le JSON
      const extracted = JSON.parse(jsonText) as ExtractedInfo;
      
      // Filtrer les tableaux vides
      const filtered: ExtractedInfo = {};
      if (extracted.phoneNumbers && extracted.phoneNumbers.length > 0) {
        filtered.phoneNumbers = extracted.phoneNumbers;
      }
      if (extracted.addresses && extracted.addresses.length > 0) {
        filtered.addresses = extracted.addresses;
      }
      if (extracted.emails && extracted.emails.length > 0) {
        filtered.emails = extracted.emails;
      }
      if (extracted.urls && extracted.urls.length > 0) {
        filtered.urls = extracted.urls;
      }

      this.logger.debug(`Extracted info: ${JSON.stringify(filtered)}`);
      return filtered;
    } catch (error) {
      this.logger.error('Error analyzing message with Gemini:', error);
      // Fallback vers regex en cas d'erreur
      return this.extractInfoWithRegex(content);
    }
  }

  /**
   * Extraction basique avec regex (fallback si Gemini n'est pas disponible)
   */
  extractInfoWithRegex(content: string): ExtractedInfo {
    const info: ExtractedInfo = {};

    // Détection téléphone (formats variés: +33 6 12 34 56 78, 06 12 34 56 78, etc.)
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
    const phoneMatches = content.match(phoneRegex);
    if (phoneMatches && phoneMatches.length > 0) {
      info.phoneNumbers = phoneMatches.filter(phone => phone.replace(/\D/g, '').length >= 8);
    }

    // Détection email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = content.match(emailRegex);
    if (emailMatches && emailMatches.length > 0) {
      info.emails = emailMatches;
    }

    // Détection URL
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urlMatches = content.match(urlRegex);
    if (urlMatches && urlMatches.length > 0) {
      info.urls = urlMatches;
    }

    // Détection adresse améliorée
    const addresses: string[] = [];
    
    // 1. Détection avec mots-clés d'adresse (rue, avenue, etc.)
    const addressKeywords = /\b(rue|avenue|boulevard|street|road|drive|way|allée|chemin|place|square|plaza)\b/gi;
    if (addressKeywords.test(content)) {
      const sentences = content.split(/[.!?,\n]\s+/);
      const addressSentences = sentences.filter(s => addressKeywords.test(s));
      if (addressSentences.length > 0) {
        addresses.push(...addressSentences.map(s => s.trim()));
      }
    }
    
    // 2. Détection pattern "numéro + nom" (ex: "123 paris", "45 rue de la paix")
    // Pattern: nombre suivi d'un ou plusieurs mots (minimum 2 caractères chacun)
    const numberAddressPattern = /\b\d{1,5}\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]{1,30}\b/gi;
    const numberAddressMatches = content.match(numberAddressPattern);
    if (numberAddressMatches) {
      // Filtrer pour éviter les faux positifs
      const validAddresses = numberAddressMatches.filter(match => {
        const trimmed = match.trim();
        const parts = trimmed.split(/\s+/);
        if (parts.length < 2) return false;
        
        const number = parseInt(parts[0]);
        // Le numéro doit être raisonnable (entre 1 et 99999)
        if (isNaN(number) || number < 1 || number > 99999) return false;
        
        // Le reste doit contenir au moins 2 caractères
        const rest = parts.slice(1).join(' ');
        if (rest.length < 2) return false;
        
        // Exclure les patterns qui ressemblent à des dates, prix, etc.
        const lowerRest = rest.toLowerCase();
        const excludePatterns = [
          /^(euros?|dollars?|€|\$|ans?|années?|jours?|heures?|minutes?|secondes?)$/,
          /^\d+$/, // Juste des chiffres
        ];
        
        if (excludePatterns.some(pattern => pattern.test(lowerRest))) {
          return false;
        }
        
        return true;
      });
      
      if (validAddresses.length > 0) {
        addresses.push(...validAddresses);
      }
    }
    
    if (addresses.length > 0) {
      info.addresses = [...new Set(addresses)]; // Supprimer les doublons
    }

    return info;
  }

  /**
   * ✨ NOUVEAU : Masquer les informations sensibles dans le contenu du message
   */
  maskSensitiveInfo(content: string, extractedInfo: ExtractedInfo): string {
    let maskedContent = content;

    // Masquer les téléphones
    if (extractedInfo.phoneNumbers) {
      extractedInfo.phoneNumbers.forEach(phone => {
        const phoneRegex = new RegExp(phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        maskedContent = maskedContent.replace(phoneRegex, '*'.repeat(Math.min(phone.length, 20)));
      });
    }

    // Masquer les emails
    if (extractedInfo.emails) {
      extractedInfo.emails.forEach(email => {
        maskedContent = maskedContent.replace(email, '*'.repeat(Math.min(email.length, 20)));
      });
    }

    // Masquer les URLs
    if (extractedInfo.urls) {
      extractedInfo.urls.forEach(url => {
        maskedContent = maskedContent.replace(url, '*'.repeat(Math.min(url.length, 20)));
      });
    }

    // Masquer les adresses (plus complexe car elles peuvent être dans une phrase)
    if (extractedInfo.addresses) {
      extractedInfo.addresses.forEach(address => {
        // Échapper les caractères spéciaux pour la regex
        const escapedAddress = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Remplacer l'adresse complète par des astérisques
        maskedContent = maskedContent.replace(
          new RegExp(escapedAddress, 'gi'),
          '*'.repeat(Math.min(address.length, 30))
        );
      });
    }

    return maskedContent;
  }
}

