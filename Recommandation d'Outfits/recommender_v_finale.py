import numpy as np
# Correction pour compatibilité (si nécessaire, mais souvent n'est plus requis)
# np.asscalar = lambda a: a.item()

from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import OneHotEncoder
import requests
from colormath.color_objects import sRGBColor, LabColor
from colormath.color_conversions import convert_color
from colormath.color_diff import delta_e_cie2000
import torch
from torchvision import models, transforms
from PIL import Image
import json
import sys
import argparse
import os
import tempfile
from urllib.parse import urlparse

# ============================================================
# UTIL / CONFIG
# ============================================================
API_CITY = "Tunis"
API_KEY = "a92f907ace22631f8af40374ae0b30b6"  # Clé OpenWeatherMap

def safe_print(*args, **kwargs):
    """ Une fonction print() simple pour un logging facile. """
    print(*args, **kwargs)

# ============================================================
# 1) API MÉTÉO
# ============================================================
def get_real_weather(city=API_CITY):
    """ Récupère la météo réelle depuis OpenWeatherMap. """
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric"
        data = requests.get(url, timeout=5).json()
        temp = data["main"]["temp"]
        cond = data["weather"][0]["main"]
        safe_print(f"🌤️ Météo réelle ({city}): {temp:.1f}°C, {cond}")
        return {"temperature": temp, "condition": cond}
    except Exception as e:
        safe_print(f"⚠️ Erreur API météo. Utilisation d'une météo par défaut (20°C, sunny). Erreur: {e}")
        return {"temperature": 20, "condition": "sunny"}

# ============================================================
# 2) EXTRACTION CNN FEATURES (ResNet50) + NORMALISATION
# ============================================================
device = torch.device("cpu") # Le CPU est suffisant pour l'inférence sur quelques images
model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
model = torch.nn.Sequential(*list(model.children())[:-1]) # On retire la dernière couche (classification)
model.eval() # Mode évaluation
model.to(device)

# Transformations standard pour ResNet
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406], [0.229,0.224,0.225])
])

def extract_features(path_or_url):
    """ Extrait un vecteur de features d'une image en utilisant ResNet50. """
    try:
        # Si c'est une URL (Cloudinary), télécharger l'image
        if path_or_url.startswith('http://') or path_or_url.startswith('https://'):
            response = requests.get(path_or_url, timeout=10)
            response.raise_for_status()
            # Créer un fichier temporaire
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
                tmp_file.write(response.content)
                tmp_path = tmp_file.name
            img = Image.open(tmp_path).convert("RGB")
            os.unlink(tmp_path)  # Supprimer le fichier temporaire
            safe_print(f"  -> Features extraites de URL: {path_or_url[:50]}...")
        else:
            # C'est un chemin local
            img = Image.open(path_or_url).convert("RGB")
            safe_print(f"  -> Features extraites de : {path_or_url}")
    except Exception as e:
        safe_print(f"⚠️ Erreur image {path_or_url}, image noire utilisée. Erreur: {e}")
        img = Image.new("RGB", (224, 224)) # Image fallback

    img = transform(img).unsqueeze(0).to(device)
    with torch.no_grad():
        feat = model(img).flatten().cpu().numpy()
    return feat

def normalize_vector(v):
    """ 
    Normalise un vecteur et gère les cas de division par zéro (vecteur nul).
    C'est la version corrigée pour éviter les RuntimeWarning.
    """
    v = np.nan_to_num(v, nan=0.0, posinf=0.0, neginf=0.0)
    norm = np.linalg.norm(v)
    epsilon = 1e-12 # Petite valeur pour éviter la division par zéro
    return v / (norm + epsilon)

# ============================================================
# 3) BASE DE DONNÉES DES VÊTEMENTS (Chargée depuis JSON ou données par défaut)
# ============================================================
clothes = []

def load_clothes_from_json(json_file_path):
    """ Charge les vêtements depuis un fichier JSON. """
    global clothes
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            clothes_data = json.load(f)
        safe_print(f"📦 {len(clothes_data)} vêtements chargés depuis {json_file_path}")
        return clothes_data
    except Exception as e:
        safe_print(f"⚠️ Erreur lors du chargement du JSON: {e}")
        return []

def process_clothes_data(clothes_data):
    """ Traite les données des vêtements et extrait les features. """
    global clothes
    clothes = clothes_data.copy()

# --- ETL (Extract, Transform, Load) ---
    safe_print("--- Extraction des features (ETL) ---", file=sys.stderr)
    safe_print(f"📦 Traitement de {len(clothes)} vêtements...", file=sys.stderr)
    
    for idx, c in enumerate(clothes, 1):
        image_url = c.get('image', '')
        if not image_url:
            safe_print(f"⚠️ [{idx}/{len(clothes)}] Pas d'image pour {c.get('id', 'unknown')}, utilisation d'une image noire", file=sys.stderr)
            c["features"] = normalize_vector(np.zeros(2048))  # ResNet50 features size
        else:
            safe_print(f"🔄 [{idx}/{len(clothes)}] Extraction features pour {c.get('id', 'unknown')}...", file=sys.stderr)
            try:
                raw = extract_features(image_url)
                c["features"] = normalize_vector(raw) # Normalisation
                safe_print(f"✅ [{idx}/{len(clothes)}] Features extraites avec succès", file=sys.stderr)
            except Exception as e:
                safe_print(f"❌ [{idx}/{len(clothes)}] Erreur lors de l'extraction: {e}", file=sys.stderr)
                c["features"] = normalize_vector(np.zeros(2048))  # Fallback
    
    safe_print(f"✅ {len(clothes)} vêtements traités avec features extraites", file=sys.stderr)
    
    # Initialiser les encoders après le chargement des données
    initialize_encoders()

# ============================================================
# 4) ONE-HOT ENCODING (Gestion des styles et couleurs)
# ============================================================
# Cette partie n'est pas utilisée dans la logique finale, mais
# elle est utile si vous voulez un vecteur global (ML avancé).
# Nous la gardons pour référence future.
# NOTE: L'initialisation est déplacée dans process_clothes_data
# car elle nécessite que les données soient chargées.

# Variables globales pour les encoders (initialisées après chargement des données)
style_encoder = None
color_encoder = None
style_vecs = None
color_vecs = None

def initialize_encoders():
    """ Initialise les encoders OneHot après le chargement des données. """
    global style_encoder, color_encoder, style_vecs, color_vecs
    if len(clothes) == 0:
        # Pas de données à encoder, on crée des encoders vides
        style_encoder = OneHotEncoder(sparse_output=False)
        color_encoder = OneHotEncoder(sparse_output=False)
        style_vecs = np.array([])
        color_vecs = np.array([])
        return

    style_encoder = OneHotEncoder(sparse_output=False)
    color_encoder = OneHotEncoder(sparse_output=False)

    styles = np.array([c.get("style", "casual") for c in clothes]).reshape(-1, 1)
    colors = np.array([c.get("color", "unknown") for c in clothes]).reshape(-1, 1)

    if len(styles) > 0 and len(colors) > 0:
        style_vecs = style_encoder.fit_transform(styles)
        color_vecs = color_encoder.fit_transform(colors)
    else:
        style_vecs = np.array([])
        color_vecs = np.array([])


# ============================================================
# 5) FONCTIONS DE SÉLECTION (ML)
# ============================================================

def find_best_starter_item(candidates):
    """
    Trouve le meilleur vêtement de départ (ex: top)
    en se basant PUREMENT sur le score historique.
    """
    if not candidates:
        return None
    
    # Trie les candidats par leur 'score' (le plus haut en premier)
    sorted_candidates = sorted(candidates, key=lambda x: x['score'], reverse=True)
    
    return sorted_candidates[0] # Retourne le meilleur

def find_best_match(candidates, reference_item):
    """
    Trouve le vêtement (parmi les candidats) qui matche le mieux
    avec un vêtement de référence (ex: le top choisi).
    """
    if not candidates:
        return None

    best_item = None
    best_score = -float('inf') # Commencer avec un score très bas

    # 1. Récupérer les features du vêtement de référence
    ref_features = reference_item['features']
    ref_color = reference_item['color']

    for item in candidates:
        item_features = item['features']
        item_color = item['color']
        
        # 2. Calculer les scores (ML Hybride)
        
        # Score de similarité visuelle (ResNet)
        score_visual = cosine_similarity([ref_features], [item_features])[0][0]
        
        # Score de compatibilité couleur (Delta E)
        delta = color_delta(ref_color, item_color)
        score_color = 1 / (1 + delta) # Un score élevé pour un delta bas
        
        # Score de l'historique (feedback utilisateur)
        score_history = item['score']
        
        # 3. Score Final (Pondéré)
        # Vous pouvez changer ces poids (ex: 0.5, 0.3, 0.2)
        total_score = (score_visual * 0.4) + (score_color * 0.4) + (score_history * 0.2)

        if total_score > best_score:
            best_score = total_score
            best_item = item
            
            # Stocker les scores pour l'explication (XAI)
            best_item['_sim_visual'] = float(score_visual)
            best_item['_sim_color'] = float(score_color)
            best_item['_total_score'] = float(total_score)

    return best_item

def update_cloth_score(cloth_id, accept=True):
    """ Met à jour le score d'un vêtement après feedback. """
    for c in clothes:
        if c["id"] == cloth_id:
            c["accepts"] += int(accept)
            c["rejects"] += int(not accept)
            total = max(c["accepts"] + c["rejects"], 1) # Évite division par zéro
            c["score"] = (c["accepts"] - c["rejects"]) / total
            safe_print(f"  -> Score de {cloth_id} mis à jour : {c['score']:.2f}")
            return

# ============================================================
# 6) COULEURS COMPATIBLES & DELTA
# ============================================================
def color_delta(color1, color2):
    """ Calcule la différence perçue (Delta E) entre deux noms de couleur. """
    # Map des noms de couleur vers RGB.
    # IDÉALEMENT : extraire ces RGB de l'image (via K-Means)
    color_map = {
        "blanc":(255,255,255), "noir":(0,0,0), "bleu":(0,0,255),
        "gris":(128,128,128), "rouge":(255,0,0), "vert":(0,255,0)
    }
    
    # Utilise (0,0,0) (noir) si la couleur n'est pas dans la map
    rgb1 = sRGBColor(*color_map.get(color1,(0,0,0)))
    rgb2 = sRGBColor(*color_map.get(color2,(0,0,0)))
    
    # Conversion en espace colorimétrique LAB (perceptuel)
    lab1 = convert_color(rgb1, LabColor)
    lab2 = convert_color(rgb2, LabColor)
    
    try:
        # Calcul de la différence
        d = float(delta_e_cie2000(lab1, lab2))
    except Exception:
        d = 9999.0 # Si erreur (ex: division par zéro dans la lib)
    return d

def is_compatible(color1, color2):
    """ Vérifie si deux couleurs sont compatibles (logique manuelle). """
    # Cette fonction n'est pas utilisée dans la recommandation finale,
    # mais est utile pour d'autres logiques.
    manual = {
        "blanc":["bleu","noir","gris","rouge","vert"],
        "noir":["blanc","gris","rouge","bleu","vert"],
        "bleu":["blanc","gris","noir","rouge"],
        "gris":["blanc","noir","bleu","rouge"],
        "rouge":["blanc","noir","gris","bleu"],
        "vert":["blanc","noir","gris"]
    }
    if color2 in manual.get(color1, []):
        return True
    
    # On peut aussi utiliser Delta E
    d = color_delta(color1, color2)
    return d < 100 # Seuil arbitraire

# ============================================================
# 7) SAISON
# ============================================================
def get_season_from_weather(temp):
    """ Traduit une température en saison. """
    if temp > 20: return "summer"
    elif temp > 10: return "spring" # (spring et fall partagent souvent les mêmes vêtements)
    elif temp > 0: return "fall"
    return "winter"

# ============================================================
# 8) RECOMMANDATION (Logique Corrigée : Filtrer -> Trier)
# ============================================================

def recommend_outfit(user_preference, simulated_weather, return_explanation=True):
    
    # 🌤️ MÉTÉO
    season = get_season_from_weather(simulated_weather["temperature"])
    safe_print(f"🌤️ Saison déduite de la météo : {season} (temp: {simulated_weather['temperature']:.1f}°C)")

    # 👔 Préférence utilisateur
    pref = user_preference.lower()
    safe_print(f"🎯 Préférence utilisateur : {pref}")

    # ============================
    # ÉTAPE 1 : FILTRER (La correction CLÉ)
    # ============================
    # On ne garde que les articles qui matchent le STYLE et la SAISON
    # Si pas de match exact pour la saison, on accepte "all" ou toutes saisons
    
    safe_print("\n--- 1. Filtrage des candidats ---")

    def matches_season(item_season, target_season):
        """ Vérifie si la saison de l'item correspond à la saison cible. """
        item_season = item_season.lower() if item_season else ""
        target_season = target_season.lower()
        # Accepte si correspond exactement, ou si "all"/"toutes"/"all seasons"
        return (item_season == target_season or 
                item_season in ["all", "toutes", "all seasons", "toutes saisons", ""])

    tops_candidats = [
        item for item in clothes 
        if item.get("category", "").lower() == "top" 
        and item.get("style", "").lower() == pref 
        and matches_season(item.get("season", ""), season)
    ]
    safe_print(f"  -> {len(tops_candidats)} 'top' trouvés pour '{pref}' et '{season}'.")

    bottoms_candidats = [
        item for item in clothes 
        if item.get("category", "").lower() == "bottom" 
        and item.get("style", "").lower() == pref 
        and matches_season(item.get("season", ""), season)
    ]
    safe_print(f"  -> {len(bottoms_candidats)} 'bottom' trouvés.")

    footwear_candidats = [
        item for item in clothes 
        if item.get("category", "").lower() in ["footwear", "shoes", "shoe"] 
        and item.get("style", "").lower() == pref 
        and matches_season(item.get("season", ""), season)
    ]
    safe_print(f"  -> {len(footwear_candidats)} 'footwear' trouvés.")
    
    # Si pas assez de candidats avec le style exact, assouplir le filtrage du style
    if len(tops_candidats) == 0 or len(bottoms_candidats) == 0 or len(footwear_candidats) == 0:
        safe_print("  ⚠️ Pas assez de candidats avec le style exact, assouplissement du filtrage...", file=sys.stderr)
        
        if len(tops_candidats) == 0:
            # Essayer d'abord sans le style mais avec la saison
            tops_candidats = [
                item for item in clothes 
                if item.get("category", "").lower() == "top" 
                and matches_season(item.get("season", ""), season)
            ]
            # Si toujours rien, enlever aussi le filtre de saison
            if len(tops_candidats) == 0:
                tops_candidats = [
                    item for item in clothes 
                    if item.get("category", "").lower() == "top"
                ]
                safe_print(f"  -> {len(tops_candidats)} 'top' trouvés (style et saison assouplis).", file=sys.stderr)
            else:
                safe_print(f"  -> {len(tops_candidats)} 'top' trouvés (style assoupli).", file=sys.stderr)
        
        if len(bottoms_candidats) == 0:
            # Chercher d'abord les bottoms classiques avec la saison
            bottoms_candidats = [
                item for item in clothes 
                if item.get("category", "").lower() == "bottom" 
                and matches_season(item.get("season", ""), season)
            ]
            # Si toujours rien, enlever le filtre de saison
            if len(bottoms_candidats) == 0:
                bottoms_candidats = [
                    item for item in clothes 
                    if item.get("category", "").lower() == "bottom"
                ]
            # Si toujours rien, utiliser les tops comme bottom (fallback)
            if len(bottoms_candidats) == 0:
                # Chercher tous les tops disponibles
                potential_bottoms = [
                    item for item in clothes 
                    if item.get("category", "").lower() == "top"
                ]
                # Si on a des tops, utiliser un top différent comme bottom
                if len(tops_candidats) > 0 and len(potential_bottoms) > 1:
                    # Prendre un item qui n'est pas le premier top sélectionné
                    bottoms_candidats = [item for item in potential_bottoms if item.get('id') != tops_candidats[0].get('id')][:1]
                    if len(bottoms_candidats) > 0:
                        safe_print(f"  -> {len(bottoms_candidats)} 'bottom' trouvés (utilisant un autre top comme fallback).", file=sys.stderr)
                elif len(potential_bottoms) > 0:
                    # Si on n'a qu'un seul item disponible, l'utiliser quand même (cas extrême)
                    bottoms_candidats = potential_bottoms[:1]
                    safe_print(f"  -> {len(bottoms_candidats)} 'bottom' trouvés (utilisant le même top comme fallback - cas extrême).", file=sys.stderr)
            else:
                safe_print(f"  -> {len(bottoms_candidats)} 'bottom' trouvés (style assoupli).", file=sys.stderr)
        
        if len(footwear_candidats) == 0:
            # Essayer d'abord sans le style mais avec la saison
            footwear_candidats = [
                item for item in clothes 
                if item.get("category", "").lower() in ["footwear", "shoes", "shoe"] 
                and matches_season(item.get("season", ""), season)
            ]
            # Si toujours rien, enlever aussi le filtre de saison
            if len(footwear_candidats) == 0:
                footwear_candidats = [
                    item for item in clothes 
                    if item.get("category", "").lower() in ["footwear", "shoes", "shoe"]
                ]
                safe_print(f"  -> {len(footwear_candidats)} 'footwear' trouvés (style et saison assouplis).", file=sys.stderr)
            else:
                safe_print(f"  -> {len(footwear_candidats)} 'footwear' trouvés (style assoupli).", file=sys.stderr)

    # ============================
    # ÉTAPE 2 : TRIER & SÉLECTIONNER (Le "Ranking" ML)
    # ============================
    
    safe_print("\n--- 2. Sélection intelligente (Ranking) ---")

    # A. Choisir le meilleur TOP (basé sur le score historique)
    top = find_best_starter_item(tops_candidats)
    if not top:
        safe_print("⚠️ Aucun top trouvé pour ce contexte. Impossible de continuer.")
        return None

    safe_print(f"🎽 Top choisi : {top['id']} (Meilleur score: {top['score']:.2f})")

    # B. Choisir le meilleur BOTTOM (qui matche le TOP)
    # Si bottoms_candidats contient le même item que top, le retirer d'abord
    bottoms_filtered = [item for item in bottoms_candidats if item.get('id') != top.get('id')]
    if len(bottoms_filtered) == 0 and len(bottoms_candidats) > 0:
        # Cas extrême : utiliser le même item (on permet cela pour générer un outfit)
        safe_print("⚠️ Utilisation du même item pour top et bottom (cas extrême - peu de vêtements disponibles)", file=sys.stderr)
        bottoms_filtered = bottoms_candidats
    
    bottom = find_best_match(bottoms_filtered, top) if len(bottoms_filtered) > 0 else find_best_starter_item(bottoms_candidats) if len(bottoms_candidats) > 0 else None
    if not bottom:
        safe_print("⚠️ Aucun bottom trouvé pour ce contexte. Impossible de continuer.")
        return None
        
    safe_print(f"👖 Bottom choisi : {bottom['id']} (Meilleur match: {bottom.get('_total_score', 0):.2f})")
        
    # C. Choisir les meilleures CHAUSSURES (qui matchent le TOP)
    shoe = find_best_match(footwear_candidats, top)
    if not shoe:
        safe_print("⚠️ Aucune chaussure trouvée. Impossible de continuer.")
        return None

    safe_print(f"👟 Chaussures choisies : {shoe['id']} (Meilleur match: {shoe.get('_total_score', 0):.2f})")

    # ============================
    # ÉTAPE 3 : RÉSULTAT & EXPLICATION
    # ============================
    outfit = {
        "top": top["id"],
        "bottom": bottom["id"],
        "footwear": shoe["id"]
    }

    # Construire l'explication pour le JSON
    explanation = {
        "top": {
            "reason": f"Best rated item (Score: {top['score']:.2f}) among {len(tops_candidats)} filtered candidates",
            "score": float(top['score']),
        },
        "bottom": {
            "reason": f"Best match for top (Total Score: {bottom.get('_total_score', 0):.2f})",
            "score": float(bottom['score']),
            "visualSimilarity": float(bottom.get('_sim_visual', 0)),
            "colorCompatibility": float(bottom.get('_sim_color', 0)),
            "totalScore": float(bottom.get('_total_score', 0)),
        },
        "footwear": {
            "reason": f"Best match for top (Total Score: {shoe.get('_total_score', 0):.2f})",
            "score": float(shoe['score']),
            "visualSimilarity": float(shoe.get('_sim_visual', 0)),
            "colorCompatibility": float(shoe.get('_sim_color', 0)),
            "totalScore": float(shoe.get('_total_score', 0)),
        }
    }

    if return_explanation:
        return {
            "outfit": outfit,
            "explanation": explanation,
            "season": season,
            "weather": simulated_weather
        }
    else:
        return outfit

def explain_outfit(outfit, weather, season, pref, top, bottom, shoe, tops_candidats, bottoms_candidats, footwear_candidats):
    """ Affiche une explication détaillée du choix. """
    
    print("\n==================== 🧠 MODE EXPLICATION ====================\n")
    print(f"CONTEXTE : Météo {season}, Préférence {pref}")

    print("\n--- 🎽 TOP CHOISI ---")
    print(f"ID : {top['id']} (Style: {top['style']}, Saison: {top['season']})")
    print(f"➡️ Raison : C'est le vêtement le mieux noté (Score: {top['score']:.2f}) parmi les {len(tops_candidats)} candidats filtrés.")

    print("\n--- 👖 BOTTOM CHOISI ---")
    print(f"ID : {bottom['id']} (Style: {bottom['style']}, Saison: {bottom['season']})")
    print(f"➡️ Raison : C'est le meilleur 'match' pour le top (Score Total: {bottom['_total_score']:.2f}) parmi les {len(bottoms_candidats)} candidats.")
    print(f"   (Simil. Visuelle: {bottom['_sim_visual']:.2f}, Compat. Couleur: {bottom['_sim_color']:.2f}, Score Historique: {bottom['score']:.2f})")

    print("\n--- 👟 CHAUSSURES CHOISIES ---")
    print(f"ID : {shoe['id']} (Style: {shoe['style']}, Saison: {shoe['season']})")
    print(f"➡️ Raison : C'est le meilleur 'match' pour le top (Score Total: {shoe['_total_score']:.2f}) parmi les {len(footwear_candidats)} candidats.")
    print(f"   (Simil. Visuelle: {shoe['_sim_visual']:.2f}, Compat. Couleur: {shoe['_sim_color']:.2f}, Score Historique: {shoe['score']:.2f})")
    
    print("\n==============================================================\n")

# ============================================================
# 9) EXÉCUTION PRINCIPALE
# ============================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Recommandation d\'outfit basée sur ML')
    parser.add_argument('--preference', type=str, default='casual',
                       choices=['casual', 'formal', 'sport' ,'elegant','bohemian','vintage','modern'],
                       help='Style préféré de l\'utilisateur')
    parser.add_argument('--city', type=str, default='Tunis',
                       help='Ville pour la météo')
    parser.add_argument('--temperature', type=float, default=None,
                       help='Température simulée (optionnel, si non fourni, utilise API météo)')
    parser.add_argument('--data', type=str, default=None,
                       help='Chemin vers le fichier JSON contenant les données des vêtements (déprécié, utilisez --stdin)')
    parser.add_argument('--stdin', action='store_true',
                       help='Lire les données depuis stdin au lieu d\'un fichier')
    
    args = parser.parse_args()
    
    safe_print("\n===== 🎽 SUGGESTION OUTFIT LABASNI (vFinale) =====\n", file=sys.stderr)

    # Charger les données depuis stdin ou fichier
    if args.stdin:
        # Lire depuis stdin
        safe_print("📥 Lecture des données depuis stdin...", file=sys.stderr)
        try:
            input_data = sys.stdin.read()
            clothes_data = json.loads(input_data)
            safe_print(f"✅ {len(clothes_data)} vêtements chargés depuis stdin", file=sys.stderr)
            if clothes_data:
                process_clothes_data(clothes_data)
            else:
                safe_print("⚠️ Aucune donnée reçue depuis stdin", file=sys.stderr)
                sys.exit(1)
        except json.JSONDecodeError as e:
            safe_print(f"❌ Erreur de parsing JSON depuis stdin: {e}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            safe_print(f"❌ Erreur lors de la lecture depuis stdin: {e}", file=sys.stderr)
            sys.exit(1)
    elif args.data and os.path.exists(args.data):
        # Ancien mode: fichier (pour compatibilité)
        clothes_data = load_clothes_from_json(args.data)
        if clothes_data:
            process_clothes_data(clothes_data)
        else:
            safe_print("⚠️ Aucune donnée chargée depuis le fichier JSON", file=sys.stderr)
            sys.exit(1)
    else:
        # Mode test avec données par défaut (si pas de fichier JSON)
        safe_print("⚠️ Mode test: utilisation de données par défaut")
        clothes = [
            {"id":"top1","category":"top","color":"blanc","style":"casual","score":2.0,"season":"summer","image":"top1.jpg","accepts":4,"rejects":2},
            {"id":"top2","category":"top","color":"noir","style":"formal","score":0.5,"season":"winter","image":"top2.jpg","accepts":1,"rejects":1},
            {"id":"bottom1","category":"bottom","color":"bleu","style":"casual","score":1.0,"season":"summer","image":"bottom1.jpg","accepts":2,"rejects":1},
            {"id":"bottom2","category":"bottom","color":"gris","style":"sport","score":0.6,"season":"fall","image":"bottom2.jpg","accepts":1,"rejects":0},
            {"id":"footwear1","category":"footwear","color":"noir","style":"casual","score":3.0,"season":"summer","image":"footwear1.jpg","accepts":3,"rejects":0},
            {"id":"bottom3","category":"bottom","color":"noir","style":"formal","score":1.5,"season":"summer","image":"bottom3.jpg","accepts":3,"rejects":1},
            {"id":"top3","category":"top","color":"gris","style":"sport","score":1.0,"season":"fall","image":"top3.jpg","accepts":2,"rejects":1},
        ]
        # Pour les données de test, on utilise des features nulles
        for c in clothes:
            c["features"] = normalize_vector(np.zeros(2048))

    # 🌤️ MÉTÉO
    if args.temperature is not None:
        weather = {"temperature": args.temperature, "condition": "sunny"}
        safe_print(f"🌤️ Température simulée : {args.temperature}°C")
    else:
        weather = get_real_weather(args.city)
        safe_print(f"🌤️ Météo réelle ({args.city}): {weather['temperature']:.1f}°C, {weather['condition']}")

    try:
        # Lancement de la recommandation
        result = recommend_outfit(args.preference, weather, return_explanation=True)

        if result and result.get("outfit"):
            # Retourner en JSON pour que NestJS puisse le parser
            output = {
                "success": True,
                "outfit": result["outfit"],
                "weather": result["weather"],
                "season": result["season"],
                "preference": args.preference,
                "explanation": result["explanation"]
            }
            # IMPORTANT: Écrire le JSON dans stdout (pas stderr)
            print(json.dumps(output))
            sys.stdout.flush()  # Forcer l'écriture immédiate
            safe_print("\n✅ Recommandation terminée avec succès", file=sys.stderr)
        else:
            # Analyser pourquoi aucun outfit n'a été généré
            categories_found = set()
            for item in clothes:
                cat = item.get("category", "").lower()
                categories_found.add(cat)
            
            missing = []
            if "top" not in categories_found:
                missing.append("top (haut: t-shirt, chemise, etc.)")
            if "bottom" not in categories_found:
                missing.append("bottom (bas: pantalon, jean, etc.)")
            if "footwear" not in categories_found and "shoes" not in categories_found:
                missing.append("footwear (chaussures)")
            
            # Analyser plus en détail pourquoi ça n'a pas fonctionné
            tops_count = len([c for c in clothes if c.get("category", "").lower() == "top"])
            bottoms_count = len([c for c in clothes if c.get("category", "").lower() == "bottom"])
            footwear_count = len([c for c in clothes if c.get("category", "").lower() in ["footwear", "shoes", "shoe"]])
            
            message = "Aucun outfit complet n'a pu être généré."
            if missing:
                message += f" Il manque: {', '.join(missing)}. "
                message += f"Vous avez actuellement: {tops_count} top(s), {bottoms_count} bottom(s), {footwear_count} chaussure(s). "
                message += "Ajoutez au moins un vêtement de chaque catégorie manquante."
            else:
                message += f" Vous avez {tops_count} top(s), {bottoms_count} bottom(s), {footwear_count} chaussure(s). "
                message += "Vérifiez que vos vêtements correspondent au style et à la saison demandés."
            
            output = {
                "success": False,
                "message": message,
                "categories_found": list(categories_found),
                "missing_categories": missing
            }
            print(json.dumps(output))
            sys.stdout.flush()
            sys.exit(1)

    except Exception as e:
        safe_print(f"⚠️ ERREUR FATALE pendant l'exécution : {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        output = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(output))
        sys.stdout.flush()
        sys.exit(1)