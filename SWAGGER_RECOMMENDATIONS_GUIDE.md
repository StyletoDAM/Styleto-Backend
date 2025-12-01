# 📚 Guide Swagger - Endpoint Recommendations

## 🎯 Endpoint de Recommandation d'Outfits

### **URL de Base**
```
http://localhost:3000/docs
```

### **Endpoint**
```
POST /recommendations/outfit
```

---

## 🔐 Authentification

Cet endpoint nécessite une authentification JWT.

### **Étape 1 : Obtenir un Token**

1. Allez sur Swagger UI : `http://localhost:3000/docs`
2. Trouvez l'endpoint `POST /auth/signin`
3. Cliquez sur "Try it out"
4. Entrez vos credentials :
   ```json
   {
     "email": "votre@email.com",
     "password": "votreMotDePasse"
   }
   ```
5. Cliquez sur "Execute"
6. Copiez le `accessToken` de la réponse

### **Étape 2 : Configurer l'Authentification**

1. En haut de la page Swagger, cliquez sur le bouton **"Authorize"** 🔒
2. Dans le champ "Value", collez votre token (sans le préfixe "Bearer ")
3. Cliquez sur "Authorize"
4. Cliquez sur "Close"

Maintenant, tous les endpoints protégés utiliseront automatiquement ce token.

---

## 📝 Tester l'Endpoint Recommendations

### **Étape 1 : Accéder à l'Endpoint**

1. Dans Swagger UI, trouvez la section **"Recommendations"**
2. Cliquez sur `POST /recommendations/outfit`
3. Cliquez sur "Try it out"

### **Étape 2 : Remplir le Body**

Exemple de requête :

```json
{
  "preference": "casual",
  "city": "Tunis",
  "temperature": null
}
```

**Paramètres :**
- `preference` (requis) : Style préféré
  - Valeurs possibles : `"casual"`, `"formal"`, `"sport"`
  - Exemple : `"casual"`

- `city` (optionnel) : Ville pour la météo
  - Défaut : `"Tunis"`
  - Exemple : `"Paris"`, `"New York"`

- `temperature` (optionnel) : Température simulée en °C
  - Si fourni, utilise cette température au lieu de l'API météo
  - Exemple : `25` pour 25°C

### **Étape 3 : Exécuter**

1. Cliquez sur "Execute"
2. Attendez la réponse (peut prendre quelques secondes car le script Python doit s'exécuter)

---

## ✅ Réponse Succès (200 OK)

```json
{
  "success": true,
  "outfit": {
    "top": {
      "_id": "507f1f77bcf86cd799439011",
      "imageURL": "https://res.cloudinary.com/.../top.jpg",
      "category": "top",
      "color": "blanc",
      "style": "casual",
      "season": "summer",
      "userId": "507f1f77bcf86cd799439012",
      "acceptedCount": 4,
      "rejectedCount": 2
    },
    "bottom": {
      "_id": "507f1f77bcf86cd799439013",
      "imageURL": "https://res.cloudinary.com/.../bottom.jpg",
      "category": "bottom",
      "color": "bleu",
      "style": "casual",
      "season": "summer",
      "userId": "507f1f77bcf86cd799439012",
      "acceptedCount": 2,
      "rejectedCount": 1
    },
    "footwear": {
      "_id": "507f1f77bcf86cd799439014",
      "imageURL": "https://res.cloudinary.com/.../footwear.jpg",
      "category": "footwear",
      "color": "noir",
      "style": "casual",
      "season": "summer",
      "userId": "507f1f77bcf86cd799439012",
      "acceptedCount": 3,
      "rejectedCount": 0
    }
  },
  "metadata": {
    "weather": {
      "temperature": 25.5,
      "condition": "sunny",
      "city": "Tunis"
    },
    "season": "summer",
    "preference": "casual",
    "explanation": {
      "top": {
        "reason": "Best rated item (Score: 2.00) among 2 filtered candidates",
        "score": 2.0
      },
      "bottom": {
        "reason": "Best match for top (Total Score: 0.85)",
        "score": 1.0,
        "visualSimilarity": 0.75,
        "colorCompatibility": 0.90,
        "totalScore": 0.85
      },
      "footwear": {
        "reason": "Best match for top (Total Score: 0.92)",
        "score": 3.0,
        "visualSimilarity": 0.80,
        "colorCompatibility": 0.95,
        "totalScore": 0.92
      }
    }
  },
  "clothesIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439013",
    "507f1f77bcf86cd799439014"
  ]
}
```

---

## ❌ Réponses d'Erreur

### **400 Bad Request - Pas assez de vêtements**

```json
{
  "statusCode": 400,
  "message": "Vous avez seulement 2 vêtement(s). Ajoutez-en au moins 3 pour une recommandation.",
  "error": "Bad Request"
}
```

**Solution** : Ajoutez au moins 3 vêtements dans votre garde-robe via `POST /cloth`

---

### **400 Bad Request - Préférence invalide**

```json
{
  "statusCode": 400,
  "message": ["preference must be one of the following values: casual, formal, sport"],
  "error": "Bad Request"
}
```

**Solution** : Utilisez une des valeurs valides : `"casual"`, `"formal"`, ou `"sport"`

---

### **401 Unauthorized**

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solution** : 
1. Vérifiez que vous avez cliqué sur "Authorize" dans Swagger
2. Vérifiez que votre token est valide (pas expiré)
3. Reconnectez-vous via `POST /auth/signin` pour obtenir un nouveau token

---

### **500 Internal Server Error - Script Python introuvable**

```json
{
  "statusCode": 500,
  "message": "Script de recommandation introuvable. Vérifiez que le fichier recommender_v_finale.py existe dans le dossier \"Recommandation d'Outfits\"",
  "error": "Internal Server Error"
}
```

**Solution** : 
1. Vérifiez que le fichier `recommender_v_finale.py` existe dans `Recommandation d'Outfits/`
2. Vérifiez que Python 3 est installé : `python3 --version`
3. Vérifiez que les dépendances Python sont installées (voir section Installation)

---

## 🛠️ Installation des Dépendances Python

Avant de pouvoir utiliser l'endpoint, assurez-vous que les dépendances Python sont installées :

```bash
cd /Users/mac/Documents/GitHub/Labasni-Backend
pip3 install numpy scikit-learn torch torchvision Pillow colormath requests
```

Ou créez un fichier `requirements.txt` dans le dossier `Recommandation d'Outfits/` :

```txt
numpy
scikit-learn
torch
torchvision
Pillow
colormath
requests
```

Puis installez avec :
```bash
pip3 install -r "Recommandation d'Outfits/requirements.txt"
```

---

## 📋 Exemples de Requêtes

### **Exemple 1 : Style Casual avec météo réelle**

```json
{
  "preference": "casual",
  "city": "Tunis"
}
```

### **Exemple 2 : Style Formal avec température simulée**

```json
{
  "preference": "formal",
  "temperature": 15
}
```

### **Exemple 3 : Style Sport avec ville personnalisée**

```json
{
  "preference": "sport",
  "city": "Paris"
}
```

---

## 🔍 Vérification du Fonctionnement

### **Test Rapide**

1. Démarrez le backend : `npm run start:dev`
2. Ouvrez Swagger : `http://localhost:3000/docs`
3. Authentifiez-vous (voir section Authentification)
4. Testez l'endpoint avec :
   ```json
   {
     "preference": "casual"
   }
   ```

### **Logs à Surveiller**

Dans la console du backend, vous devriez voir :
```
🎽 [Recommendations] Début de la recommandation...
   User ID: 507f1f77bcf86cd799439012
   Préférence: casual
   Ville: Tunis
   📦 5 vêtements trouvés pour l'utilisateur
   💾 Données sauvegardées dans: temp_uploads/clothes_1234567890.json
   🔄 Exécution du script Python...
   ✅ Script Python exécuté avec succès
   ✅ Recommandation terminée avec succès
```

---

## 🐛 Dépannage

### **Le script Python ne s'exécute pas**

1. Vérifiez que Python 3 est installé : `python3 --version`
2. Vérifiez que le chemin du script est correct
3. Vérifiez les permissions d'exécution

### **Erreur "Module not found"**

Installez les dépendances Python (voir section Installation)

### **Aucun outfit retourné**

1. Vérifiez que vous avez au moins 3 vêtements dans votre garde-robe
2. Vérifiez que les vêtements ont les bonnes catégories (`top`, `bottom`, `footwear`)
3. Vérifiez que les styles et saisons correspondent à votre préférence

---

## 📱 Intégration iOS/Android

Le format de réponse est conçu pour être facilement utilisable dans les apps mobiles :

- **outfit.top.imageURL** → Afficher l'image du haut
- **outfit.bottom.imageURL** → Afficher l'image du bas
- **outfit.footwear.imageURL** → Afficher l'image des chaussures
- **metadata.explanation** → Afficher les explications à l'utilisateur
- **clothesIds** → IDs pour créer un outfit si l'utilisateur accepte

---

## ✅ Checklist de Test

- [ ] Backend démarré (`npm run start:dev`)
- [ ] Swagger accessible (`http://localhost:3000/docs`)
- [ ] Token JWT obtenu et configuré
- [ ] Au moins 3 vêtements dans la garde-robe
- [ ] Dépendances Python installées
- [ ] Script Python accessible
- [ ] Test avec `preference: "casual"` réussi
- [ ] Réponse JSON valide reçue

---

**Bon test ! 🚀**

