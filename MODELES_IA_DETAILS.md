# 🤖 Détails Techniques - Modèles IA Backend Labasni

## 📋 Vue d'Ensemble

Le backend utilise **3 systèmes IA différents** :

1. **YOLO + MobileNetV2** : Détection et classification de vêtements
2. **ResNet50** : Recommandation d'outfits (similarité visuelle)
3. **Gemini Pro** : Modération de chat (analyse de texte)

---

## 1. 🔍 Détection de Vêtements (`detect.py`)

### Architecture

```
Image Upload
    ↓
Remove Background (remove_bg_api.py)
    ↓
YOLO Detection (best.pt)
    ↓
Crop Image → Extract Dominant Color (K-Means)
    ↓
Style/Season Classification (MobileNetV2)
    ↓
Upload to Cloudinary
    ↓
Return JSON Results
```

### Modèles Utilisés

#### 1.1 YOLO (`best.pt`)
- **Type**: Object Detection
- **Framework**: Ultralytics YOLO
- **Usage**: Détecter et localiser le vêtement dans l'image
- **Output**: 
  - Bounding box (x1, y1, x2, y2)
  - Type de vêtement (classe)
  - Confidence score

**Code de lancement**:
```python
from ultralytics import YOLO
yolo_model = YOLO("best.pt")
results = yolo_model(image_path, verbose=False)[0]
```

#### 1.2 MobileNetV2 (`style_season_model.h5`)
- **Type**: Classification Multi-Tâche
- **Framework**: TensorFlow/Keras
- **Usage**: Classifier le style et la saison
- **Architecture**:
  - Base: MobileNetV2 (sans top)
  - GlobalAveragePooling2D
  - Dense(4) pour style → softmax
  - Dense(4) pour saison → softmax

**Styles possibles**: casual, formal, sport, chic
**Saisons possibles**: summer, winter, fall, spring

**Code de chargement**:
```python
from tensorflow.keras.models import Model
from tensorflow.keras.applications import MobileNetV2

base_model = MobileNetV2(input_shape=(224, 224, 3), include_top=False)
x = GlobalAveragePooling2D()(base_model.output)
style_output = Dense(4, activation='softmax', name='style_output')(x)
season_output = Dense(4, activation='softmax', name='season_output')(x)
style_model = Model(inputs=base_model.input, outputs=[style_output, season_output])
style_model.load_weights("style_season_model.h5")
```

#### 1.3 Extraction Couleur Dominante
- **Algorithme**: K-Means Clustering (n_clusters=3)
- **Usage**: Identifier la couleur principale du vêtement
- **Format**: Hex color (#RRGGBB)

### Flux d'Exécution

```typescript
// 1. Upload image
POST /detect (multipart/form-data)

// 2. Suppression background
exec(`python3 remove_bg_api.py --input "${tempPath}" --output "${noBgPath}"`)

// 3. Détection IA
exec(`python3 detect.py --image "${tempPath}"`)

// 4. Parse stdout
const detectionResult = parseDetectionOutput(stdout);

// 5. Upload sans BG sur Cloudinary
cloudinary.uploader.upload(noBgPath)

// 6. Retour JSON
{
  image_url: "...",
  detection_result: "Type: tshirt\nCouleur: #FFFFFF\nStyle: casual\nSaison: summer"
}
```

### Dépendances Python

```txt
ultralytics       # YOLO
tensorflow        # MobileNetV2
Pillow            # Image processing
numpy             # Arrays
scikit-learn      # K-Means
```

### Fichiers Requis

- `best.pt` - Modèle YOLO pré-entraîné (racine du projet)
- `style_season_model.h5` - Modèle MobileNetV2 pré-entraîné (racine du projet)

---

## 2. 🎨 Recommandation d'Outfits (`recommender_v_finale.py`)

### Architecture

```
User Request (preference, city, temperature)
    ↓
Fetch User Clothes from MongoDB
    ↓
Normalize Data (categories, styles, seasons)
    ↓
Spawn Python Process
    ↓
Load ResNet50 (Pre-trained)
    ↓
For each cloth:
    Download Image from Cloudinary
    Extract Features (ResNet50)
    Normalize Vector
    ↓
Filter by Style + Season (Weather)
    ↓
Select Best TOP (historical score)
    ↓
Find Best BOTTOM (ML hybrid score)
    ↓
Find Best FOOTWEAR (ML hybrid score)
    ↓
Return JSON Outfit
```

### Modèle Utilisé

#### ResNet50 (PyTorch)
- **Type**: Feature Extraction
- **Framework**: PyTorch (torchvision)
- **Usage**: Extraire des features visuelles pour calculer la similarité
- **Architecture**: ResNet50 pré-entraîné (ImageNet)
  - On retire la dernière couche de classification
  - On utilise les features (2048 dimensions)

**Code de chargement**:
```python
import torch
from torchvision import models

device = torch.device("cpu")
model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
model = torch.nn.Sequential(*list(model.children())[:-1])
model.eval()
model.to(device)
```

### Algorithme de Sélection

#### Étape 1: Filtrage
```
Filter clothes where:
  - category == "top" | "bottom" | "footwear"
  - style == user_preference
  - season == weather_season OR season == "all"
```

#### Étape 2: Sélection TOP
```
Select TOP with:
  - Highest historical score (acceptedCount - rejectedCount)
```

#### Étape 3: Sélection BOTTOM & FOOTWEAR
```
For each candidate:
  Calculate:
    - visual_similarity = cosine_similarity(top_features, candidate_features)
    - color_compatibility = 1 / (1 + delta_e_cie2000(top_color, candidate_color))
    - historical_score = (accepts - rejects) / total
    
  total_score = (visual_similarity × 0.4) + 
                (color_compatibility × 0.4) + 
                (historical_score × 0.2)
    
Select candidate with highest total_score
```

### Compatibilité Couleurs (Delta E CIE2000)

- **Bibliothèque**: colormath
- **Méthode**: Delta E CIE2000 (perceptuelle)
- **Usage**: Calculer la compatibilité visuelle de deux couleurs

```python
from colormath.color_objects import sRGBColor, LabColor
from colormath.color_conversions import convert_color
from colormath.color_diff import delta_e_cie2000

rgb1 = sRGBColor(*color1_rgb)
rgb2 = sRGBColor(*color2_rgb)
lab1 = convert_color(rgb1, LabColor)
lab2 = convert_color(rgb2, LabColor)
delta = delta_e_cie2000(lab1, lab2)
```

### Météo & Saison

#### OpenWeatherMap API
```python
url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric"
response = requests.get(url)
temperature = response.json()["main"]["temp"]
```

#### Conversion Température → Saison
```python
def get_season_from_weather(temp):
    if temp > 25: return "summer"
    elif temp > 17: return "spring"
    elif temp > 0: return "fall"
    return "winter"
```

### Flux d'Exécution

```typescript
// 1. Récupération vêtements
const userClothes = await clothesModel.find({ userId });

// 2. Préparation JSON
const clothesData = userClothes.map(cloth => ({
  id: cloth._id,
  category: normalizeCategory(cloth.category),
  color: cloth.color,
  style: normalizeStyle(cloth.style),
  season: normalizeSeason(cloth.season),
  score: calculateScore(cloth.acceptedCount, cloth.rejectedCount),
  image: cloth.imageURL
}));

// 3. Lancement script Python
const pythonProcess = spawn('python3', [
  'Recommandation d\'Outfits/recommender_v_finale.py',
  '--preference', preference,
  '--city', city,
  '--temperature', temperature,
  '--stdin'
], { stdio: ['pipe', 'pipe', 'pipe'] });

// 4. Envoi données via stdin
pythonProcess.stdin.write(JSON.stringify(clothesData));
pythonProcess.stdin.end();

// 5. Collecte stdout
pythonProcess.stdout.on('data', (data) => {
  stdout += data.toString();
});

// 6. Parse JSON résultat
const result = JSON.parse(stdout);
```

### Dépendances Python

```txt
torch            # PyTorch
torchvision      # ResNet50
numpy            # Arrays
scikit-learn     # Cosine similarity
colormath        # Delta E color compatibility
Pillow           # Image processing
requests         # Weather API, Image download
```

### Timeout

- **Durée**: 2 minutes (120 secondes)
- **Raison**: Chargement de ResNet50 + téléchargement d'images + extraction features

### Performance

- **Feature Extraction**: ~1-2 secondes par image
- **Similarity Calculation**: Instantané
- **Total**: ~5-30 secondes selon nombre de vêtements

---

## 3. 🛡️ Modération de Chat (Gemini AI)

### Architecture

```
Message Sent
    ↓
AiAnalysisService.moderateMessage()
    ↓
Gemini Pro API (if configured)
    OR
Regex Fallback
    ↓
Extract Structured Info (JSON)
    ↓
Check Violations
    ↓
Return ModerationResult
```

### Modèle Utilisé

#### Google Gemini Pro
- **Type**: LLM (Large Language Model)
- **Provider**: Google Generative AI
- **Usage**: Analyser le texte et extraire des informations structurées
- **Format de sortie**: JSON strict

**Initialisation**:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
```

### Prompt Engineering

Le prompt est extrêmement strict et détaillé pour:
1. Détecter les numéros de téléphone (tous formats)
2. Détecter les demandes de contact externe
3. Détecter les adresses physiques
4. Détecter les gros mots (multilingue)
5. Détecter les tentatives de contournement

**Exemple de prompt**:
```
Tu es un système de modération EXTREMEMENT strict pour un chat de marketplace en Tunisie.

Tu dois détecter:
- Tout numéro de téléphone (quel que soit le format)
- Toute demande de contact externe (WhatsApp, Telegram, etc.)
- Toute proposition de rencontre physique
- TOUT gros mot dans N'IMPORTE QUELLE LANGUE

SORTIE JSON OBLIGATOIRE:
{
  "phoneNumbers": [...],
  "addresses": [...],
  "emails": [...],
  "urls": [...],
  "socialMedia": [...],
  "externalContacts": [...],
  "profanity": [...],
  "obfuscatedContacts": [...]
}
```

### Extraction Structurée

```typescript
interface ExtractedInfo {
  phoneNumbers?: string[];
  addresses?: string[];
  emails?: string[];
  urls?: string[];
  socialMedia?: string[];
  externalContacts?: string[];
  profanity?: string[];
  obfuscatedContacts?: string[];
}
```

### Règles de Modération

#### Avant Achat (Strict)
- ❌ Numéros de téléphone
- ❌ Demandes de contact externe
- ❌ Adresses
- ❌ Emails, URLs, réseaux sociaux
- ❌ Gros mots

#### Après Achat (Assoupli)
- ✅ Contact autorisé (dans certaines limites)
- ❌ Gros mots (toujours bloqué)

### Fallback Regex

Si Gemini n'est pas configuré, utilise des regex basiques:

```typescript
// Phone numbers
const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;

// Emails
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// URLs
const urlRegex = /https?:\/\/[^\s]+/g;

// Social media
const socialRegex = /@[\w.]+|(?:instagram|facebook|snapchat|telegram|whatsapp)[\s:]+[\w.]+/gi;
```

### Flux d'Exécution

```typescript
// 1. Message reçu
POST /chat/messages { conversationId, content }

// 2. Modération
const moderation = await aiAnalysisService.moderateMessage(
  content,
  user.hasCompletedPurchase
);

// 3. Vérification
if (!moderation.isAllowed) {
  throw new BadRequestException({
    violations: moderation.violations,
    maskedContent: moderation.maskedContent
  });
}

// 4. Création message (si autorisé)
const message = await chatService.createMessage(...);

// 5. Broadcast WebSocket
await chatGateway.broadcastMessage(conversationId, message);
```

### Dépendances Node.js

```json
"@google/generative-ai": "^0.24.1"
```

---

## 🔄 Comparaison des Modèles

| Modèle | Type | Framework | Usage | Temps d'exécution |
|--------|------|-----------|-------|-------------------|
| YOLO | Object Detection | Ultralytics | Détecter vêtement | ~1-2s |
| MobileNetV2 | Classification | TensorFlow | Style/Saison | ~0.5s |
| ResNet50 | Feature Extraction | PyTorch | Similarité visuelle | ~1-2s/image |
| Gemini Pro | LLM | Google AI | Modération texte | ~1-3s |

---

## 🚀 Optimisations Possibles

### 1. Cache des Features ResNet50
- Stocker les features extraites dans MongoDB
- Éviter de re-télécharger et re-extraire les images

### 2. Batch Processing
- Traiter plusieurs images en parallèle
- Utiliser GPU si disponible

### 3. Model Quantization
- Quantifier les modèles pour réduire la taille
- Accélérer l'inférence

### 4. Async Processing
- Détection de vêtements en arrière-plan
- Notification quand terminé

---

## 📦 Installation

### Python Dependencies

```bash
# Détection
pip install ultralytics tensorflow Pillow numpy scikit-learn

# Recommandations
pip install torch torchvision numpy scikit-learn colormath Pillow requests

# Ou depuis requirements.txt
pip install -r "Recommandation d'Outfits/requirements.txt"
```

### Node.js Dependencies

```bash
npm install @google/generative-ai
```

### Fichiers Modèles Requis

- `best.pt` - YOLO model (doit être à la racine)
- `style_season_model.h5` - MobileNetV2 model (doit être à la racine)

---

## 🐛 Dépannage

### Erreur: "Module Python manquant"
```bash
pip3 install -r "Recommandation d'Outfits/requirements.txt"
```

### Erreur: "Modèle introuvable"
Vérifier que `best.pt` et `style_season_model.h5` sont à la racine du projet.

### Timeout sur Recommandations
- Vérifier la connexion internet (téléchargement d'images)
- Réduire le nombre de vêtements
- Augmenter le timeout dans le code

### Gemini API non configurée
La modération utilisera automatiquement le fallback regex.

---

**Dernière mise à jour**: 2025-01-27
