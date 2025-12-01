# 📊 Analyse Complète des Routes Backend et Implémentations Frontend

## 📋 Table des Matières
1. [Backend - Routes et Endpoints](#backend-routes-et-endpoints)
2. [Backend - WebSocket (Chat)](#backend-websocket-chat)
3. [Frontend iOS - Implémentations](#frontend-ios-implémentations)
4. [Frontend Android - Implémentations](#frontend-android-implémentations)
5. [Comparaison et Gaps](#comparaison-et-gaps)
6. [Recommandations](#recommandations)

---

## 🔧 Backend - Routes et Endpoints

### **1. Authentification (`/auth`)**

#### Routes Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `POST` | `/auth/signup` | Inscription nouvel utilisateur | ❌ | ✅ | ✅ |
| `POST` | `/auth/signin` | Connexion email/password | ❌ | ✅ | ✅ |
| `POST` | `/auth/google` | Authentification Google | ❌ | ✅ | ✅ |
| `POST` | `/auth/apple` | Authentification Apple | ❌ | ✅ | ✅ |
| `GET` | `/auth/google/callback` | Callback OAuth Google | ❌ | ❌ | ❌ |
| `POST` | `/auth/verify-email` | Vérification email | ❌ | ✅ | ✅ |
| `POST` | `/auth/forgot-password` | Demande OTP SMS | ❌ | ✅ | ✅ |
| `POST` | `/auth/verify-otp` | Validation OTP | ❌ | ✅ | ✅ |
| `POST` | `/auth/reset-password` | Réinitialisation mot de passe | ❌ | ✅ | ✅ |
| `GET` | `/auth/profile` | Récupérer profil utilisateur | ✅ | ✅ | ✅ |
| `PATCH` | `/auth/profile` | Mettre à jour profil (texte) | ✅ | ✅ | ✅ |
| `PATCH` | `/auth/profile/photo` | Mettre à jour photo profil | ✅ | ✅ | ✅ |
| `DELETE` | `/auth/profile/photo/remove` | Supprimer photo profil | ✅ | ✅ | ✅ |
| `DELETE` | `/auth/profile` | Supprimer compte | ✅ | ✅ | ✅ |
| `POST` | `/auth/balance/topup` | Recharger solde | ✅ | ✅ | ✅ |

#### Détails d'Implémentation Backend

**Controller**: `src/auth/auth.controller.ts`

**Fonctionnalités clés**:
- JWT Authentication avec `JwtAuthGuard`
- Google OAuth avec Passport
- Apple Sign In
- Email verification avec codes
- OTP SMS via Twilio
- Upload photo via Cloudinary (multipart/form-data)
- Gestion du solde en centimes (backend) / TND (frontend)

---

### **2. Vêtements (`/cloth`)**

#### Routes Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `GET` | `/cloth` | Liste tous les vêtements (admin) | ✅ | ❌ | ❌ |
| `GET` | `/cloth/my` | Mes vêtements | ✅ | ✅ | ✅ |
| `GET` | `/cloth/:id` | Détail d'un vêtement | ✅ | ❌ | ❌ |
| `POST` | `/cloth` | Créer un vêtement | ✅ | ✅ | ✅ |
| `PATCH` | `/cloth/:id` | Modifier un vêtement | ✅ | ❌ | ❌ |
| `DELETE` | `/cloth/:id` | Supprimer un vêtement | ✅ | ✅ | ✅ |
| `GET` | `/cloth/corrections` | Exporter corrections (fine-tuning) | ❌ | ❌ | ❌ |
| `GET` | `/cloth/stats/global` | Stats globales corrections | ❌ | ❌ | ❌ |
| `GET` | `/cloth/stats/me` | Mes stats corrections | ✅ | ❌ | ❌ |

#### Détails d'Implémentation Backend

**Controller**: `src/clothes/clothes.controller.ts`

**Fonctionnalités clés**:
- Gestion des corrections utilisateur (`originalDetection`)
- Système de fine-tuning pour améliorer le modèle IA
- Statistiques de corrections
- Sécurité: suppression uniquement de ses propres vêtements

---

### **3. Détection IA (`/detect`)**

#### Routes Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `POST` | `/detect` | Détection vêtements (multipart) | ❌ | ✅ | ✅ |

#### Détails d'Implémentation Backend

**Controller**: `src/clothes/detect.controller.ts`

**Fonctionnalités clés**:
- Upload image multipart/form-data
- Suppression background via API remove.bg (Python)
- Upload image sans background sur Cloudinary
- Détection IA via script Python (`detect.py`)
- Retour: `image_url`, `detection_result`, `public_id`

**Processus**:
1. Réception image → `temp_uploads/`
2. Suppression background → `_nobg.png`
3. Upload Cloudinary (format PNG transparent)
4. Détection IA sur image originale
5. Nettoyage fichiers temporaires

---

### **4. Tenues/Outfits (`/outfits`)**

#### Routes Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `GET` | `/outfits` | Liste toutes les tenues (admin) | ✅ | ❌ | ❌ |
| `GET` | `/outfits/my` | Mes tenues | ✅ | ✅ | ✅ |
| `GET` | `/outfits/:id` | Détail d'une tenue | ✅ | ❌ | ❌ |
| `POST` | `/outfits` | Créer une tenue | ✅ | ✅ | ✅ |
| `POST` | `/outfits/generate` | Générer tenue aléatoire | ✅ | ✅ | ❌ |
| `PATCH` | `/outfits/:id` | Modifier une tenue | ✅ | ❌ | ❌ |
| `DELETE` | `/outfits/:id` | Supprimer une tenue | ✅ | ✅ | ✅ |

#### Détails d'Implémentation Backend

**Controller**: `src/outfits/outfits.controller.ts`

**Fonctionnalités clés**:
- Génération aléatoire d'outfits (minimum 3 vêtements requis)
- Association avec événements (`eventType`)
- Gestion du statut (`pending`, `approved`, etc.)

---

### **5. Boutique/Store (`/store`)**

#### Routes Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `GET` | `/store` | Tous les articles en vente | ✅ | ✅ | ✅ |
| `GET` | `/store/my` | Mes articles en vente | ✅ | ✅ | ✅ |
| `GET` | `/store/:id` | Détail d'un article | ✅ | ❌ | ❌ |
| `POST` | `/store` | Mettre en vente un vêtement | ✅ | ✅ | ✅ |
| `PATCH` | `/store/:id` | Modifier un article | ✅ | ❌ | ✅ |
| `DELETE` | `/store/:id` | Supprimer un article | ✅ | ✅ | ✅ |
| `POST` | `/store/payment-intent` | Créer payment intent Stripe | ✅ | ✅ | ✅ |
| `POST` | `/store/purchase/:id` | Confirmer achat | ✅ | ✅ | ✅ |

#### Détails d'Implémentation Backend

**Controller**: `src/store/store.controller.ts`

**Fonctionnalités clés**:
- Intégration Stripe pour paiements
- Achat via balance utilisateur ou carte bancaire
- Mise à jour automatique du solde vendeur
- Gestion des transactions

---

### **6. Abonnements (`/subscriptions`)**

#### Routes Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `GET` | `/subscriptions/me` | Mon abonnement actuel | ✅ | ✅ | ✅ |
| `GET` | `/subscriptions/me/stats` | Mes statistiques d'usage | ✅ | ✅ | ✅ |
| `GET` | `/subscriptions/plans` | Liste des plans disponibles | ❌ | ❌ | ❌ |
| `GET` | `/subscriptions/quota/clothes-detection` | Vérifier quota détection | ✅ | ✅ | ❌ |
| `GET` | `/subscriptions/quota/outfit-generation` | Vérifier quota génération | ✅ | ✅ | ❌ |
| `GET` | `/subscriptions/quota/store-selling` | Vérifier quota vente | ✅ | ✅ | ✅ |
| `POST` | `/subscriptions/purchase/:plan` | Acheter un plan (simulation) | ✅ | ✅ | ❌ |
| `PATCH` | `/subscriptions/me` | Mettre à jour plan | ✅ | ✅ | ✅ |

#### Détails d'Implémentation Backend

**Controller**: `src/subscriptions/subscriptions.controller.ts`

**Plans disponibles**:
- **FREE**: 5 détections, 3 suggestions, 3 ventes
- **PREMIUM**: Détections/suggestions illimitées, 3 ventes (30 TND/mois)
- **PRO_SELLER**: Tout illimité (90 TND/mois)

**Fonctionnalités clés**:
- Système de quotas mensuels
- Réinitialisation automatique chaque mois
- Validation avant actions (détection, génération, vente)
- Paiement simulé pour projet académique (carte test: 4242...)

---

### **7. Commandes (`/orders`)**

#### Routes Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `POST` | `/orders` | Créer une commande | ✅ | ✅ | ✅ |
| `GET` | `/orders` | Mes commandes | ✅ | ✅ | ✅ |

#### Détails d'Implémentation Backend

**Controller**: `src/orders/orders.controller.ts`

**Fonctionnalités clés**:
- Création de commande avec `clothesId` et `price`
- Récupération avec population des données (`clothesId`, `userId`)
- Tri par date (plus récentes en premier)

---

### **8. Chat (`/chat`)**

#### Routes REST Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `POST` | `/chat/conversations` | Créer/récupérer conversation | ✅ | ✅ | ✅ |
| `GET` | `/chat/conversations` | Mes conversations | ✅ | ✅ | ✅ |
| `GET` | `/chat/conversations/:id/messages` | Messages d'une conversation | ✅ | ✅ | ✅ |
| `POST` | `/chat/messages` | Envoyer un message (REST) | ✅ | ✅ | ✅ |

#### Détails d'Implémentation Backend

**Controller**: `src/chat/chat.controller.ts`

**Fonctionnalités clés**:
- Création automatique de conversation si n'existe pas
- Envoi message via REST + broadcast WebSocket
- Support conversations 1-à-1

---

### **9. Avatars (`/avatar`)**

#### Routes Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `POST` | `/avatar` | Créer un avatar | ✅ | ❌ | ❌ |
| `GET` | `/avatar` | Liste tous les avatars | ✅ | ❌ | ❌ |
| `GET` | `/avatar/:id` | Détail d'un avatar | ✅ | ❌ | ❌ |
| `PATCH` | `/avatar/:id` | Modifier un avatar | ✅ | ❌ | ❌ |
| `DELETE` | `/avatar/:id` | Supprimer un avatar | ✅ | ❌ | ❌ |

#### Détails d'Implémentation Backend

**Controller**: `src/avatars/avatars.controller.ts`

**Note**: Module non utilisé dans les frontends actuellement.

---

### **10. Événements (`/events`)**

#### Routes Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `POST` | `/events` | Créer un événement | ✅ | ❌ | ❌ |
| `GET` | `/events` | Liste tous les événements | ✅ | ❌ | ❌ |
| `GET` | `/events/:id` | Détail d'un événement | ✅ | ❌ | ❌ |
| `PATCH` | `/events/:id` | Modifier un événement | ✅ | ❌ | ❌ |
| `DELETE` | `/events/:id` | Supprimer un événement | ✅ | ❌ | ❌ |

#### Détails d'Implémentation Backend

**Controller**: `src/events/events.controller.ts`

**Note**: Module non utilisé dans les frontends actuellement.

---

### **11. Valises (`/suitcases`)**

#### Routes Disponibles

| Méthode | Route | Description | Auth Requise | Implémenté iOS | Implémenté Android |
|---------|-------|-------------|--------------|----------------|-------------------|
| `POST` | `/suitcases` | Créer une valise | ✅ | ❌ | ❌ |
| `GET` | `/suitcases` | Liste toutes les valises | ✅ | ❌ | ❌ |
| `GET` | `/suitcases/:id` | Détail d'une valise | ✅ | ❌ | ❌ |
| `PUT` | `/suitcases/:id` | Modifier une valise | ✅ | ❌ | ❌ |
| `DELETE` | `/suitcases/:id` | Supprimer une valise | ✅ | ❌ | ❌ |

#### Détails d'Implémentation Backend

**Controller**: `src/suitcases/suitcases.controller.ts`

**Note**: Module non utilisé dans les frontends actuellement.

---

## 🔌 Backend - WebSocket (Chat)

### **Gateway WebSocket**

**Namespace**: `/chat`

**Events Disponibles**:

| Event | Direction | Description | Implémenté iOS | Implémenté Android |
|-------|-----------|-------------|----------------|-------------------|
| `connected` | Server → Client | Connexion réussie | ✅ | ✅ |
| `error` | Server → Client | Erreur de connexion | ✅ | ✅ |
| `join-conversation` | Client → Server | Rejoindre une conversation | ✅ | ✅ |
| `conversation-history` | Server → Client | Historique messages | ✅ | ✅ |
| `send-message` | Client → Server | Envoyer un message | ✅ | ✅ |
| `new-message` | Server → Client | Nouveau message reçu | ✅ | ✅ |
| `conversation-updated` | Server → Client | Conversation mise à jour | ✅ | ✅ |
| `typing` | Client → Server | Indicateur de frappe | ✅ | ✅ |
| `user-typing` | Server → Client | Utilisateur en train de taper | ✅ | ✅ |

#### Détails d'Implémentation Backend

**Gateway**: `src/chat/chat.gateway.ts`

**Fonctionnalités clés**:
- Authentification JWT via query/auth/header
- Rooms par utilisateur: `user:{userId}`
- Rooms par conversation: `conversation:{conversationId}`
- Auto-join des conversations de l'utilisateur à la connexion
- Broadcast automatique des nouveaux messages
- Notifications aux autres participants

**Authentification**:
- Token via `query.token`, `auth.token`, ou header `Authorization: Bearer {token}`
- Vérification avec `JwtService`
- Déconnexion si token invalide

---

## 📱 Frontend iOS - Implémentations

### **Structure des Services**

```
Labasniios/Services/
├── Auth/
│   ├── AuthService.swift
│   ├── AppleSignInHelper.swift
│   └── GoogleSignInHelper.swift
├── Clothes/
│   └── ClothesService.swift
├── Outfits/
│   ├── OutfitsService.swift
│   └── FavoritesService.swift
├── Store/
│   ├── StoreService.swift
│   ├── PaymentService.swift
│   └── ChatService.swift
├── Profile/
│   └── ProfileService.swift
├── Subscriptions/
│   └── SubscriptionService.swift
└── Orders/
    └── OrdersService.swift
```

### **Endpoints Implémentés iOS**

#### ✅ **AuthService**
- `POST /auth/signup`
- `POST /auth/signin`
- `POST /auth/google`
- `POST /auth/apple`
- `POST /auth/verify-email`
- `POST /auth/forgot-password`
- `POST /auth/verify-otp`
- `POST /auth/reset-password`

#### ✅ **ProfileService**
- `GET /auth/profile`
- `PATCH /auth/profile` (texte)
- `PATCH /auth/profile/photo` (multipart)
- `DELETE /auth/profile/photo/remove`
- `DELETE /auth/profile`
- `POST /auth/balance/topup`

#### ✅ **ClothesService**
- `GET /cloth/my`
- `POST /cloth`
- `DELETE /cloth/:id`

#### ✅ **Détection IA** (via URLSession direct)
- `POST /detect` (multipart/form-data)

#### ✅ **OutfitsService**
- `GET /outfits/my`
- `POST /outfits`
- `POST /outfits/generate`
- `DELETE /outfits/:id`

#### ✅ **StoreService**
- `GET /store`
- `GET /store/my`
- `POST /store`
- `DELETE /store/:id`

#### ✅ **PaymentService**
- `POST /store/payment-intent`
- `POST /store/purchase/:id`

#### ✅ **ChatService**
- `POST /chat/conversations`
- `GET /chat/conversations`
- `GET /chat/conversations/:id/messages`
- `POST /chat/messages`
- WebSocket: `SocketManager.swift`

#### ✅ **SubscriptionService**
- `GET /subscriptions/me`
- `GET /subscriptions/me/stats`
- `GET /subscriptions/quota/clothes-detection`
- `GET /subscriptions/quota/outfit-generation`
- `GET /subscriptions/quota/store-selling`
- `POST /subscriptions/purchase/:plan`
- `PATCH /subscriptions/me`

#### ✅ **OrdersService**
- `POST /orders`
- `GET /orders`

### **Technologies iOS**
- **Networking**: `URLSession` avec async/await
- **WebSocket**: `SocketManager` (probablement Starscream)
- **JSON**: `JSONDecoder` / `JSONEncoder`
- **Multipart**: Construction manuelle du body

---

## 🤖 Frontend Android - Implémentations

### **Structure des APIs**

```
app/src/main/java/tn/esprit/labasniandroid/api/
├── AuthApi.kt
├── ClothesApi.kt
├── OutfitsApi.kt
├── StoreApi.kt
├── ChatApi.kt
├── SubscriptionApi.kt
├── OrdersApi.kt
└── RetrofitClient.kt
```

### **Endpoints Implémentés Android**

#### ✅ **AuthApi**
- `POST /auth/signup`
- `POST /auth/signin`
- `POST /auth/google`
- `POST /auth/apple`
- `GET /auth/profile`
- `PATCH /auth/profile`
- `PATCH /auth/profile/photo` (multipart)
- `POST /auth/verify-email`
- `POST /auth/forgot-password`
- `POST /auth/verify-otp`
- `POST /auth/reset-password`
- `DELETE /auth/profile`
- `GET /users/{userId}`
- `POST /auth/balance/topup`

#### ✅ **ClothesApi**
- `GET /cloth/my`
- `POST /cloth`
- `DELETE /cloth/:id`
- `POST /detect` (multipart)

#### ✅ **OutfitsApi**
- `GET /outfits/my`
- `POST /outfits`
- `DELETE /outfits/:id`

#### ⚠️ **OutfitsApi - Manquant**
- `POST /outfits/generate` ❌

#### ✅ **StoreApi**
- `GET /store`
- `GET /store/my`
- `POST /store`
- `PATCH /store/:id`
- `DELETE /store/:id`
- `POST /store/payment-intent`
- `POST /store/purchase/:id`

#### ✅ **ChatApi**
- `POST /chat/conversations`
- `GET /chat/conversations`
- `GET /chat/conversations/:id/messages`
- `POST /chat/messages`
- WebSocket: Implémentation via Socket.IO

#### ✅ **SubscriptionApi**
- `GET /subscriptions/me`
- `GET /subscriptions/me/stats`
- `GET /subscriptions/quota/store-selling`
- `PATCH /subscriptions/me`

#### ⚠️ **SubscriptionApi - Manquants**
- `GET /subscriptions/quota/clothes-detection` ❌
- `GET /subscriptions/quota/outfit-generation` ❌
- `GET /subscriptions/plans` ❌
- `POST /subscriptions/purchase/:plan` ❌

#### ✅ **OrdersApi**
- `POST /orders`
- `GET /orders`

### **Technologies Android**
- **Networking**: Retrofit 2 avec Coroutines
- **WebSocket**: Socket.IO client
- **JSON**: Gson
- **Multipart**: `MultipartBody` d'OkHttp

---

## 📊 Comparaison et Gaps

### **Endpoints Manquants par Plateforme**

#### **iOS - Manquants**
- ❌ `GET /subscriptions/plans` (liste des plans)
- ❌ `GET /cloth/stats/me` (stats corrections)
- ❌ `GET /store/:id` (détail article)
- ❌ `PATCH /store/:id` (modifier article)
- ❌ `PATCH /outfits/:id` (modifier tenue)
- ❌ `GET /outfits/:id` (détail tenue)
- ❌ `GET /cloth/:id` (détail vêtement)

#### **Android - Manquants**
- ❌ `POST /outfits/generate` (génération aléatoire)
- ❌ `GET /subscriptions/quota/clothes-detection`
- ❌ `GET /subscriptions/quota/outfit-generation`
- ❌ `GET /subscriptions/plans`
- ❌ `POST /subscriptions/purchase/:plan`
- ❌ `GET /store/:id` (détail article)
- ❌ `GET /outfits/:id` (détail tenue)
- ❌ `GET /cloth/:id` (détail vêtement)
- ❌ `PATCH /outfits/:id` (modifier tenue)
- ❌ `PATCH /cloth/:id` (modifier vêtement)

### **Modules Backend Non Utilisés**

Les modules suivants existent dans le backend mais ne sont pas utilisés par les frontends:
- ❌ **Avatars** (`/avatar`)
- ❌ **Événements** (`/events`)
- ❌ **Valises** (`/suitcases`)

### **Différences d'Implémentation**

#### **1. Génération d'Outfits**
- ✅ **iOS**: Implémenté (`POST /outfits/generate`)
- ❌ **Android**: Non implémenté

#### **2. Quotas Subscriptions**
- ✅ **iOS**: Tous les quotas vérifiés
- ⚠️ **Android**: Seulement `store-selling`, manque `clothes-detection` et `outfit-generation`

#### **3. Mise à jour Store**
- ✅ **Android**: `PATCH /store/:id` implémenté
- ❌ **iOS**: Non implémenté

#### **4. Détails d'Items**
- ❌ **iOS & Android**: Aucun endpoint de détail implémenté (`/store/:id`, `/outfits/:id`, `/cloth/:id`)

---

## 🎯 Recommandations

### **Priorité Haute**

1. **Android - Génération d'Outfits**
   - Ajouter `POST /outfits/generate` dans `OutfitsApi.kt`
   - Implémenter dans le repository et ViewModel

2. **Android - Quotas Subscriptions**
   - Ajouter `GET /subscriptions/quota/clothes-detection`
   - Ajouter `GET /subscriptions/quota/outfit-generation`
   - Utiliser avant les actions correspondantes

3. **iOS - Mise à jour Store**
   - Ajouter `PATCH /store/:id` dans `StoreService.swift`
   - Permettre la modification des articles en vente

4. **Les Deux - Endpoints de Détail**
   - Implémenter les endpoints de détail pour une meilleure UX
   - `GET /store/:id`, `GET /outfits/:id`, `GET /cloth/:id`

### **Priorité Moyenne**

5. **iOS - Liste des Plans**
   - Ajouter `GET /subscriptions/plans` pour afficher les plans disponibles

6. **Android - Achat de Plan**
   - Ajouter `POST /subscriptions/purchase/:plan` pour l'achat initial

7. **Les Deux - Stats Corrections**
   - Implémenter `GET /cloth/stats/me` pour afficher les contributions utilisateur

### **Priorité Basse**

8. **Modules Non Utilisés**
   - Décider si les modules Avatars, Événements, Valises doivent être intégrés
   - Sinon, documenter leur exclusion ou les retirer du backend

9. **Uniformisation**
   - Aligner les implémentations iOS et Android sur les mêmes endpoints
   - Créer une documentation API partagée

### **Améliorations Techniques**

10. **Gestion d'Erreurs**
    - Standardiser les codes d'erreur entre iOS et Android
    - Améliorer les messages d'erreur utilisateur

11. **Documentation API**
    - Utiliser Swagger (déjà configuré: `/docs`)
    - Générer une documentation OpenAPI complète

12. **Tests**
    - Ajouter des tests d'intégration pour les endpoints critiques
    - Tests de charge pour les endpoints IA (`/detect`)

---

## 📝 Notes Techniques

### **Authentification**
- **Backend**: JWT avec Bearer token
- **iOS**: Token stocké via `TokenManager.shared`
- **Android**: Token passé dans header `Authorization: Bearer {token}`

### **Upload d'Images**
- **Backend**: Multipart/form-data avec `FileInterceptor`
- **iOS**: Construction manuelle du body multipart
- **Android**: `MultipartBody` d'OkHttp

### **WebSocket**
- **Backend**: Socket.IO avec namespace `/chat`
- **iOS**: `SocketManager` (probablement Starscream)
- **Android**: Client Socket.IO

### **Gestion du Solde**
- **Backend**: Stockage en centimes (integer)
- **Frontend**: Affichage en TND (conversion backend → frontend)
- **Top-up**: Montant envoyé en centimes, réponse en TND

### **Quotas Subscriptions**
- Réinitialisation mensuelle automatique
- Vérification avant chaque action (détection, génération, vente)
- Retour: `{ allowed: boolean, remaining: number|"unlimited", limit: number|"unlimited" }`

---

## 🔗 Liens Utiles

- **Swagger UI**: `http://localhost:3000/docs`
- **Base URL iOS**: `http://192.168.1.14:3000` (configurable)
- **Base URL Android**: `http://10.0.2.2:3000` (émulateur) ou IP Mac (appareil réel)

---

**Date de génération**: 2025-01-27
**Version Backend**: 1.0
**Dernière mise à jour**: Analyse complète des routes et implémentations

