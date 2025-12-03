import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExtractedInfo {
  phoneNumbers?: string[];
  addresses?: string[];
  emails?: string[];
  urls?: string[];
  socialMedia?: string[];
  externalContacts?: string[];
  profanity?: string[];
  obfuscatedContacts?: string[];
}

export interface ModerationResult {
  isAllowed: boolean;
  violations: string[];
  extractedInfo: ExtractedInfo;
  maskedContent?: string;
}

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('✅ Gemini AI initialized');
    } else {
      this.logger.warn('⚠️ GEMINI_API_KEY not configured, will use regex fallback');
    }
  }

  /**
   * 🚨 MAIN MODERATION FUNCTION - Blocks messages with prohibited content
   */
  async moderateMessage(content: string, hasCompletedPurchase: boolean = false): Promise<ModerationResult> {
    const extractedInfo = await this.analyzeMessage(content);
    const violations: string[] = [];

    // If user hasn't completed a purchase, strict moderation
    if (!hasCompletedPurchase) {
      // Check for phone numbers (any format)
      if (extractedInfo.phoneNumbers && extractedInfo.phoneNumbers.length > 0) {
        violations.push('Phone numbers are not allowed before completing a purchase');
      }

      // Check for requests for contact info
      if (extractedInfo.externalContacts && extractedInfo.externalContacts.length > 0) {
        violations.push('Requesting contact information is not allowed before completing a purchase');
      }

      // Check for obfuscated contacts (written numbers, etc.)
      if (extractedInfo.obfuscatedContacts && extractedInfo.obfuscatedContacts.length > 0) {
        violations.push('Obfuscated contact information is not allowed');
      }

      // Check for addresses
      if (extractedInfo.addresses && extractedInfo.addresses.length > 0) {
        violations.push('Physical addresses are not allowed before completing a purchase');
      }

      // Check for emails
      if (extractedInfo.emails && extractedInfo.emails.length > 0) {
        violations.push('Email addresses are not allowed before completing a purchase');
      }

      // Check for external URLs
      if (extractedInfo.urls && extractedInfo.urls.length > 0) {
        violations.push('External links are not allowed before completing a purchase');
      }

      // Check for social media handles
      if (extractedInfo.socialMedia && extractedInfo.socialMedia.length > 0) {
        violations.push('Social media handles are not allowed before completing a purchase');
      }
    }

    // Check for profanity (always blocked, regardless of purchase status)
    if (extractedInfo.profanity && extractedInfo.profanity.length > 0) {
      violations.push('Profanity and offensive language are not allowed');
    }

    return {
      isAllowed: violations.length === 0,
      violations,
      extractedInfo,
      maskedContent: violations.length > 0 ? this.maskSensitiveInfo(content, extractedInfo) : undefined
    };
  }

  /**
   * Analyze message with Gemini AI to extract structured information
   */
  async analyzeMessage(content: string): Promise<ExtractedInfo> {
    if (!this.genAI) {
      this.logger.debug('Gemini not available, using regex fallback');
      return this.extractInfoWithRegex(content);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `Tu es un système de modération EXTREMEMENT strict pour un chat de marketplace en Tunisie. 
Ton objectif unique : EMPÊCHER à 100% toute tentative de transaction ou contact en dehors de la plateforme.

Tu dois détecter :
- Tout numéro de téléphone (quel que soit le format, même éclaté sur plusieurs messages)
- Toute demande ou proposition de contact externe (WhatsApp, Telegram, Instagram, appel, SMS, etc.)
- Toute proposition de rencontre physique ("on se voit où", "je passe te livrer", "rdv à...", "viens chez moi", etc.)
- Toute adresse, même partielle
- Tout email, lien, pseudo réseau social
- TOUT gros mot, insulte, harcèlement sexuel, langage vulgaire ou offensant dans N'IMPORTE QUELLE LANGUE ou dialecte (arabe tunisien, français, anglais, arabe standard, italien, espagnol, etc.)
- Toute obfuscation créative (espaces, points, émoticônes, mots séparés, chiffres en toutes lettres dans n'importe quelle langue, censuré avec *, chiffres arabes orientaux ٠١٢٣٤٥٦٧٨٩, etc.)

RÈGLES ULTRA-STRICTES :

1. Numéros de téléphone → flag TOUT ce qui peut en être une partie :
   - Chiffres seuls : "59859", "123", "898 123", "06", "71", "22" (même 2-3 chiffres si dans un contexte suspect)
   - Toutes lettres : "zéro six douze trente quatre cinquante six soixante dix huit", "six un deux trois...", "setta tlet wahed...", "sittah wahed ithnan..."
   - Mélangé : "zero six 12 34 56 78", "06.12.34.56.78", "+216 suivi de..."
   - Continuation explicite : "la suite", "le reste", "les derniers chiffres", "comme je t'ai dit avant", "tu te rappelles le début"
   - Si le message contient seulement des chiffres ou presque → c'est forcément une partie de numéro

2. Demande de contact externe / sortie de plateforme :
   Flagger TOUT ce qui ressemble à :
   - "donne ton num", "3tini numrek", "ektebli numrek", "passe-moi ton WhatsApp", "on continue sur Insta ?", "tu as Telegram ?", "add me", "je t'appelle", "appelle-moi", "contacte-moi en privé", "on peut parler ailleurs", "sortons d'ici", "passe en DM", "je t'envoie mon numéro en privé", etc.
   - Toute mention de WhatsApp/Telegram/Signal/Viber/Snapchat/Instagram/Facebook/TikTok en contexte de contact

3. Rencontre physique :
   Flagger immédiatement :
   - "on se voit où", "je peux passer", "tu peux venir", "rdv à", "je te livre en main propre", "main à main", "je suis à [ville/quarter]", "près de Carrefour/Monoprix/la mosquée/le souk", "viens chez moi", "je viens chez toi", "on se capte à...", etc.

4. Gros mots / insultes / harcèlement → TOUTES les langues :
   Tu DOIS détecter tout langage vulgaire, sexuel, insultant, menace, harcèlement, même censuré, même avec émoticônes.
   Exemples particulièrement graves en tunisien (flag à 100%) : kahba/ka7ba/9ahba/9a7ba, zebi/zbi/zeb, kess/kiss/kes, omek/ommak/emmek, khra/5ra/khra, 7mar/7mar, etc. + toutes les variantes avec chiffres.
   Mais aussi : putain, fils de pute, enculé, salope, fuck, motherfucker, bitch, hijo de puta, figlio di puttana, sharmouta, etc.
   → Si tu as le moindre doute → flag.

SORTIE JSON OBLIGATOIRE (exactement ce format, rien d'autre, pas de markdown) :

{
  "phoneNumbers": ["+216 98 123 456", "zero six douze trente quatre..."],
  "addresses": ["près de Carrefour La Marsa", "Avenue Habib Bourguiba"],
  "emails": ["test@gmail.com"],
  "urls": ["https://t.me/xxx"],
  "socialMedia": ["@insta.handle", "mon Snap : xxx"],
  "externalContacts": ["donne-moi ton numéro", "on continue sur WhatsApp", "ektebli numrek", "rdv à Monoprix"],
  "profanity": ["kahba", "fils de pute", "putain", "fuck you"],
  "obfuscatedContacts": ["06 12 34 56 78", "59859", "la suite c'est 898 123", "zéro six douze..."]
}

MESSAGE À ANALYSER :
"${content.replace(/"/g, '\\"')}"
`;
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text().trim();

      // Clean markdown if present
      let jsonText = text;
      if (text.startsWith('```json')) {
        jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (text.startsWith('```')) {
        jsonText = text.replace(/```\n?/g, '').trim();
      }

      // Parse JSON
      const extracted = JSON.parse(jsonText) as ExtractedInfo;

      // Filter empty arrays
      const filtered: ExtractedInfo = {};
      if (extracted.phoneNumbers?.length) filtered.phoneNumbers = extracted.phoneNumbers;
      if (extracted.addresses?.length) filtered.addresses = extracted.addresses;
      if (extracted.emails?.length) filtered.emails = extracted.emails;
      if (extracted.urls?.length) filtered.urls = extracted.urls;
      if (extracted.socialMedia?.length) filtered.socialMedia = extracted.socialMedia;
      if (extracted.externalContacts?.length) filtered.externalContacts = extracted.externalContacts;
      if (extracted.profanity?.length) filtered.profanity = extracted.profanity;
      if (extracted.obfuscatedContacts?.length) filtered.obfuscatedContacts = extracted.obfuscatedContacts;

      this.logger.debug(`Extracted info: ${JSON.stringify(filtered)}`);
      return filtered;

    } catch (error) {
      this.logger.error('Error analyzing message with Gemini:', error);
      // Fallback to regex
      return this.extractInfoWithRegex(content);
    }
  }

  /**
   * Enhanced regex-based extraction (fallback)
   */
  extractInfoWithRegex(content: string): ExtractedInfo {
    const info: ExtractedInfo = {};
    const lowerContent = content.toLowerCase();

    // 1. Phone numbers (various formats)
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
    const phoneMatches = content.match(phoneRegex);
    if (phoneMatches?.length) {
      info.phoneNumbers = phoneMatches.filter(phone => phone.replace(/\D/g, '').length >= 8);
    }

    // 2. Written numbers (English/French)
    const writtenNumberPatterns = [
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+(zero|one|two|three|four|five|six|seven|eight|nine|ten)/gi,
      /\b(zéro|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\s+(zéro|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)/gi,
    ];
    const obfuscated: string[] = [];
    writtenNumberPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) obfuscated.push(...matches);
    });
    if (obfuscated.length) info.obfuscatedContacts = obfuscated;

    // 3. Email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = content.match(emailRegex);
    if (emailMatches?.length) info.emails = emailMatches;

    // 4. URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urlMatches = content.match(urlRegex);
    if (urlMatches?.length) info.urls = urlMatches;

    // 5. Social media handles
    const socialRegex = /@[\w.]+|(?:instagram|facebook|snapchat|telegram|whatsapp|twitter)[\s:]+[\w.]+/gi;
    const socialMatches = content.match(socialRegex);
    if (socialMatches?.length) info.socialMedia = socialMatches;

    // 6. Requests for contact
    const contactRequestPatterns = [
      /\b(give|send|share|what'?s|whats)\s+(me\s+)?(your|ton|ta)\s+(number|phone|contact|numéro|téléphone)/gi,
      /\b(call|text|message|appelle|contacte)[\s-]+(me|moi)/gi,
      /\b(how|comment)\s+(can\s+)?(i|je)\s+(reach|contact|joindre)/gi,
    ];
    const externalContacts: string[] = [];
    contactRequestPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        const matches = content.match(pattern);
        if (matches) externalContacts.push(...matches);
      }
    });
    if (externalContacts.length) info.externalContacts = externalContacts;

    // 7. Addresses
    const addresses: string[] = [];
    const addressKeywords = /\b(rue|avenue|boulevard|street|road|drive|place|square|meet\s+at|near|behind|chez)\b/gi;
    if (addressKeywords.test(content)) {
      const sentences = content.split(/[.!?,\n]\s+/);
      const addressSentences = sentences.filter(s => addressKeywords.test(s));
      if (addressSentences.length) addresses.push(...addressSentences.map(s => s.trim()));
    }
    
    const numberAddressPattern = /\b\d{1,5}\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]{2,30}\b/gi;
    const numberAddressMatches = content.match(numberAddressPattern);
    if (numberAddressMatches) {
      addresses.push(...numberAddressMatches);
    }
    if (addresses.length) info.addresses = [...new Set(addresses)];

    // 8. Profanity (basic detection - Gemini is better for this)
    const profanityPatterns = [
      /\b(fuck|shit|bitch|ass|damn|bastard|cunt|dick)\w*/gi,
      /\b(merde|putain|connard|salaud|enculé|fils de pute)\w*/gi,
      /\b(f\*+k|sh\*+t|b\*+ch|a\*+)\w*/gi,
    ];
    const profanity: string[] = [];
    profanityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) profanity.push(...matches);
    });
    if (profanity.length) info.profanity = [...new Set(profanity)];

    return info;
  }

  /**
   * Mask sensitive information in content
   */
  maskSensitiveInfo(content: string, extractedInfo: ExtractedInfo): string {
    let maskedContent = content;

    // Helper function to safely mask
    const maskItem = (item: string, maxLength: number = 20) => {
      const escapedItem = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      maskedContent = maskedContent.replace(
        new RegExp(escapedItem, 'gi'),
        '*'.repeat(Math.min(item.length, maxLength))
      );
    };

    // Mask all detected information
    extractedInfo.phoneNumbers?.forEach(phone => maskItem(phone));
    extractedInfo.emails?.forEach(email => maskItem(email));
    extractedInfo.urls?.forEach(url => maskItem(url, 30));
    extractedInfo.addresses?.forEach(addr => maskItem(addr, 30));
    extractedInfo.socialMedia?.forEach(social => maskItem(social));
    extractedInfo.externalContacts?.forEach(contact => maskItem(contact, 25));
    extractedInfo.profanity?.forEach(word => maskItem(word, 10));
    extractedInfo.obfuscatedContacts?.forEach(obf => maskItem(obf, 25));

    return maskedContent;
  }
}