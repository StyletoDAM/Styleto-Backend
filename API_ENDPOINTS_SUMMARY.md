# 📋 Résumé des Endpoints API - Labasni

## 🔐 Authentification (`/auth`)

| Endpoint | Méthode | iOS | Android | Description |
|----------|---------|-----|---------|-------------|
| `/auth/signup` | POST | ✅ | ✅ | Inscription |
| `/auth/signin` | POST | ✅ | ✅ | Connexion |
| `/auth/google` | POST | ✅ | ✅ | Auth Google |
| `/auth/apple` | POST | ✅ | ✅ | Auth Apple |
| `/auth/verify-email` | POST | ✅ | ✅ | Vérification email |
| `/auth/forgot-password` | POST | ✅ | ✅ | OTP SMS |
| `/auth/verify-otp` | POST | ✅ | ✅ | Validation OTP |
| `/auth/reset-password` | POST | ✅ | ✅ | Reset password |
| `/auth/profile` | GET | ✅ | ✅ | Profil utilisateur |
| `/auth/profile` | PATCH | ✅ | ✅ | Mettre à jour profil |
| `/auth/profile/photo` | PATCH | ✅ | ✅ | Photo profil |
| `/auth/profile/photo/remove` | DELETE | ✅ | ✅ | Supprimer photo |
| `/auth/profile` | DELETE | ✅ | ✅ | Supprimer compte |
| `/auth/balance/topup` | POST | ✅ | ✅ | Recharger solde |

---

## 👕 Vêtements (`/cloth`)

| Endpoint | Méthode | iOS | Android | Description |
|----------|---------|-----|---------|-------------|
| `/cloth/my` | GET | ✅ | ✅ | Mes vêtements |
| `/cloth` | POST | ✅ | ✅ | Créer vêtement |
| `/cloth/:id` | DELETE | ✅ | ✅ | Supprimer |
| `/cloth/:id` | GET | ❌ | ❌ | Détail |
| `/cloth/:id` | PATCH | ❌ | ❌ | Modifier |
| `/cloth/stats/me` | GET | ❌ | ❌ | Mes stats |

---

## 🤖 Détection IA (`/detect`)

| Endpoint | Méthode | iOS | Android | Description |
|----------|---------|-----|---------|-------------|
| `/detect` | POST | ✅ | ✅ | Détection vêtements (multipart) |

---

## 👔 Tenues (`/outfits`)

| Endpoint | Méthode | iOS | Android | Description |
|----------|---------|-----|---------|-------------|
| `/outfits/my` | GET | ✅ | ✅ | Mes tenues |
| `/outfits` | POST | ✅ | ✅ | Créer tenue |
| `/outfits/generate` | POST | ✅ | ❌ | Générer aléatoire |
| `/outfits/:id` | DELETE | ✅ | ✅ | Supprimer |
| `/outfits/:id` | GET | ❌ | ❌ | Détail |
| `/outfits/:id` | PATCH | ❌ | ❌ | Modifier |

---

## 🛍️ Boutique (`/store`)

| Endpoint | Méthode | iOS | Android | Description |
|----------|---------|-----|---------|-------------|
| `/store` | GET | ✅ | ✅ | Tous les articles |
| `/store/my` | GET | ✅ | ✅ | Mes articles |
| `/store` | POST | ✅ | ✅ | Mettre en vente |
| `/store/:id` | PATCH | ❌ | ✅ | Modifier article |
| `/store/:id` | DELETE | ✅ | ✅ | Supprimer |
| `/store/:id` | GET | ❌ | ❌ | Détail article |
| `/store/payment-intent` | POST | ✅ | ✅ | Créer payment intent |
| `/store/purchase/:id` | POST | ✅ | ✅ | Confirmer achat |

---

## 💳 Abonnements (`/subscriptions`)

| Endpoint | Méthode | iOS | Android | Description |
|----------|---------|-----|---------|-------------|
| `/subscriptions/me` | GET | ✅ | ✅ | Mon abonnement |
| `/subscriptions/me/stats` | GET | ✅ | ✅ | Mes stats |
| `/subscriptions/plans` | GET | ❌ | ❌ | Liste des plans |
| `/subscriptions/quota/clothes-detection` | GET | ✅ | ❌ | Quota détection |
| `/subscriptions/quota/outfit-generation` | GET | ✅ | ❌ | Quota génération |
| `/subscriptions/quota/store-selling` | GET | ✅ | ✅ | Quota vente |
| `/subscriptions/purchase/:plan` | POST | ✅ | ❌ | Acheter plan |
| `/subscriptions/me` | PATCH | ✅ | ✅ | Mettre à jour plan |

---

## 📦 Commandes (`/orders`)

| Endpoint | Méthode | iOS | Android | Description |
|----------|---------|-----|---------|-------------|
| `/orders` | POST | ✅ | ✅ | Créer commande |
| `/orders` | GET | ✅ | ✅ | Mes commandes |

---

## 💬 Chat (`/chat`)

### REST

| Endpoint | Méthode | iOS | Android | Description |
|----------|---------|-----|---------|-------------|
| `/chat/conversations` | POST | ✅ | ✅ | Créer conversation |
| `/chat/conversations` | GET | ✅ | ✅ | Mes conversations |
| `/chat/conversations/:id/messages` | GET | ✅ | ✅ | Messages |
| `/chat/messages` | POST | ✅ | ✅ | Envoyer message |

### WebSocket (`/chat` namespace)

| Event | Direction | iOS | Android | Description |
|-------|-----------|-----|---------|-------------|
| `connected` | Server → Client | ✅ | ✅ | Connexion réussie |
| `join-conversation` | Client → Server | ✅ | ✅ | Rejoindre conversation |
| `send-message` | Client → Server | ✅ | ✅ | Envoyer message |
| `new-message` | Server → Client | ✅ | ✅ | Nouveau message |
| `typing` | Client → Server | ✅ | ✅ | Indicateur frappe |

---

## 📊 Statistiques Globales

### Endpoints Implémentés
- **iOS**: 35 endpoints
- **Android**: 32 endpoints
- **Backend**: 50+ endpoints

### Gaps Principaux

#### iOS Manque
- `GET /subscriptions/plans`
- `PATCH /store/:id`
- Endpoints de détail (`/store/:id`, `/outfits/:id`, `/cloth/:id`)

#### Android Manque
- `POST /outfits/generate`
- `GET /subscriptions/quota/clothes-detection`
- `GET /subscriptions/quota/outfit-generation`
- `GET /subscriptions/plans`
- `POST /subscriptions/purchase/:plan`
- Endpoints de détail

### Modules Backend Non Utilisés
- `/avatar` (Avatars)
- `/events` (Événements)
- `/suitcases` (Valises)

---

## 🎯 Actions Prioritaires

1. **Android**: Ajouter génération d'outfits (`POST /outfits/generate`)
2. **Android**: Ajouter vérification quotas (`/subscriptions/quota/*`)
3. **iOS**: Ajouter modification store (`PATCH /store/:id`)
4. **Les deux**: Implémenter endpoints de détail
5. **Les deux**: Ajouter `GET /subscriptions/plans`

---

**Document complet**: Voir `COMPLETE_API_ANALYSIS.md`

