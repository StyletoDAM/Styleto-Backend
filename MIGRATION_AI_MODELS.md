# 🔄 Migration des Modèles IA vers AI-Models/

## 📋 Résumé

Tous les fichiers Python et modèles IA ont été déplacés dans le dossier `AI-Models/` pour une meilleure organisation. Ce document décrit tous les changements effectués dans le code.

---

## 📁 Structure des Fichiers

### Avant
```
Labasni-Backend/
├── detect.py
├── remove_bg_api.py
├── best.pt
├── style_season_model.h5
└── Recommandation d'Outfits/
    └── recommender_v_finale.py
```

### Après
```
Labasni-Backend/
└── AI-Models/
    ├── detect.py
    ├── remove_bg_api.py
    ├── recommender_v_finale.py
    ├── best.pt
    ├── style_season_model.h5
    └── requirements.txt
```

---

## 🔧 Modifications du Code

### 1. **detect.controller.ts**

#### Changements effectués :

**Étape 1 - Suppression du background :**
```typescript
// Avant
`python3 remove_bg_api.py --input "${tempPath}" --output "${noBgPath}"`

// Après
const removeBgScriptPath = join(process.cwd(), 'AI-Models', 'remove_bg_api.py');
const tempPathAbs = join(process.cwd(), tempPath);
const noBgPathAbs = join(process.cwd(), noBgPath);
`python3 "${removeBgScriptPath}" --input "${tempPathAbs}" --output "${noBgPathAbs}"`
```

**Étape 2 - Détection IA :**
```typescript
// Avant
`python3 detect.py --image "${tempPath}"`

// Après
const aiModelsDir = join(process.cwd(), 'AI-Models');
`cd "${aiModelsDir}" && python3 detect.py --image "${tempPathAbs}"`
```

**Note importante :** Le script `detect.py` est exécuté depuis le répertoire `AI-Models/` pour qu'il puisse trouver les modèles `best.pt` et `style_season_model.h5` dans le répertoire courant.

---

### 2. **recommendations.service.ts**

#### Changements effectués :

**Chemin du script :**
```typescript
// Avant
private readonly pythonScriptPath = join(
  process.cwd(),
  'Recommandation d\'Outfits',
  'recommender_v_finale.py',
);

// Après
private readonly pythonScriptPath = join(
  process.cwd(),
  'AI-Models',
  'recommender_v_finale.py',
);
```

**Working Directory :**
```typescript
// Avant
const pythonProcess = spawn('python3', args, {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe'],
});

// Après
const aiModelsDir = join(process.cwd(), 'AI-Models');
const pythonProcess = spawn('python3', args, {
  cwd: aiModelsDir,
  stdio: ['pipe', 'pipe', 'pipe'],
});
```

**Arguments du script :**
```typescript
// Avant
const args = [
  this.pythonScriptPath,  // Chemin absolu
  '--preference', normalizedPreference,
  ...
];

// Après
const args = [
  'recommender_v_finale.py',  // Chemin relatif (car cwd = AI-Models)
  '--preference', normalizedPreference,
  ...
];
```

**Messages d'erreur :**
```typescript
// Avant
'Script de recommandation introuvable. Vérifiez que le fichier recommender_v_finale.py existe dans le dossier "Recommandation d\'Outfits"'

// Après
'Script de recommandation introuvable. Vérifiez que le fichier recommender_v_finale.py existe dans le dossier "AI-Models"'
```

**Dépendances Python :**
```typescript
// Avant
pip3 install -r "Recommandation d'Outfits/requirements.txt"

// Après
pip3 install -r "AI-Models/requirements.txt"
```

---

### 3. **recommendations.controller.ts**

#### Changements effectués :

**Message d'erreur dans la documentation Swagger :**
```typescript
// Avant
message: 'Script de recommandation introuvable. Vérifiez que le fichier recommender_v_finale.py existe dans le dossier "Recommandation d\'Outfits"'

// Après
message: 'Script de recommandation introuvable. Vérifiez que le fichier recommender_v_finale.py existe dans le dossier "AI-Models"'
```

---

## ✅ Points Importants

### 1. **Working Directory pour detect.py**

Le script `detect.py` doit être exécuté depuis `AI-Models/` car il cherche les modèles dans le répertoire courant :
- `best.pt` (modèle YOLO)
- `style_season_model.h5` (modèle MobileNetV2)

**Solution :** Utiliser `cd "${aiModelsDir}" && python3 detect.py ...` pour changer le working directory avant l'exécution.

### 2. **Chemins Absolus pour les Images**

Les images temporaires (`temp_uploads/`) sont dans le répertoire racine, donc on utilise des chemins absolus pour que le script Python (exécuté depuis `AI-Models/`) puisse les trouver.

**Solution :** Construire des chemins absolus avec `join(process.cwd(), tempPath)`.

### 3. **Script de Recommandation**

Le script `recommender_v_finale.py` n'a pas besoin de modèles locaux (il charge ResNet50 depuis torchvision), mais il est quand même exécuté depuis `AI-Models/` pour la cohérence.

---

## 🧪 Tests à Effectuer

Après ces modifications, tester les endpoints suivants :

1. **POST /detect**
   - Vérifier que la détection fonctionne
   - Vérifier que les modèles sont trouvés
   - Vérifier que le background removal fonctionne

2. **POST /recommendations/outfit**
   - Vérifier que la recommandation fonctionne
   - Vérifier que le script Python est trouvé
   - Vérifier que les dépendances sont installées

---

## 📝 Commandes Utiles

### Vérifier que les fichiers sont présents
```bash
ls -la AI-Models/
```

### Installer les dépendances Python
```bash
cd AI-Models
pip3 install -r requirements.txt
```

### Tester manuellement detect.py
```bash
cd AI-Models
python3 detect.py --image "../temp_uploads/test.jpg"
```

### Tester manuellement recommender_v_finale.py
```bash
cd AI-Models
echo '[...JSON...]' | python3 recommender_v_finale.py --preference casual --city Tunis --temperature 25 --stdin
```

---

## 🐛 Dépannage

### Erreur : "can't open file 'detect.py'"
**Cause :** Le chemin n'est pas correct.
**Solution :** Vérifier que le fichier existe dans `AI-Models/detect.py`

### Erreur : "best.pt not found"
**Cause :** Le modèle n'est pas trouvé car le working directory n'est pas `AI-Models/`.
**Solution :** S'assurer que le script est exécuté depuis `AI-Models/` avec `cd`.

### Erreur : "Module Python manquant"
**Cause :** Les dépendances ne sont pas installées.
**Solution :** `pip3 install -r AI-Models/requirements.txt`

---

## 📌 Checklist de Migration

- [x] Déplacer tous les fichiers Python dans `AI-Models/`
- [x] Déplacer tous les modèles (`best.pt`, `style_season_model.h5`) dans `AI-Models/`
- [x] Mettre à jour les chemins dans `detect.controller.ts`
- [x] Mettre à jour les chemins dans `recommendations.service.ts`
- [x] Mettre à jour les messages d'erreur
- [x] Mettre à jour le working directory pour les scripts Python
- [x] Tester les endpoints `/detect` et `/recommendations/outfit`

---

**Date de migration :** 2025-01-27
**Fichiers modifiés :**
- `src/clothes/detect.controller.ts`
- `src/recommendations/recommendations.service.ts`
- `src/recommendations/recommendations.controller.ts`
