#!/usr/bin/env python3

import sys
import argparse
import requests
import os
from dotenv import load_dotenv

# Charger variables d'environnement
load_dotenv()

API_KEY = os.getenv("REMOVE_BG_API_KEY")

def remove_background(input_path, output_path):
    try:
        if not API_KEY:
            print("❌ Erreur : Clé API manquante. Ajoute-la dans le fichier .env", file=sys.stderr)
            return False
        
        if not os.path.exists(input_path):
            print(f"❌ Erreur : Fichier introuvable : {input_path}", file=sys.stderr)
            return False
        
        print(f"🔄 Suppression du background pour : {input_path}")
        
        with open(input_path, 'rb') as image_file:
            response = requests.post(
                'https://api.remove.bg/v1.0/removebg',
                files={'image_file': image_file},
                data={'size': 'auto'},
                headers={'X-Api-Key': API_KEY},
                timeout=30
            )
        
        if response.status_code == requests.codes.ok:
            with open(output_path, 'wb') as out_file:
                out_file.write(response.content)
            
            print(f"✅ Background supprimé : {output_path}")
            
            credits_remaining = response.headers.get('X-Credits-Remaining', 'N/A')
            print(f"💰 Crédits restants : {credits_remaining}")
            
            return True
        else:
            error_data = response.json()
            errors = error_data.get('errors', [])
            if errors:
                error_title = errors[0].get('title', 'Erreur inconnue')
                error_detail = errors[0].get('detail', '')
                print(f"❌ Erreur API : {error_title}", file=sys.stderr)
                if error_detail:
                    print(f"   Détail : {error_detail}", file=sys.stderr)
            else:
                print(f"❌ Erreur HTTP {response.status_code}", file=sys.stderr)
            
            return False

    except requests.exceptions.Timeout:
        print("❌ Timeout", file=sys.stderr)
        return False
    except Exception as e:
        print(f"❌ Erreur : {str(e)}", file=sys.stderr)
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Supprime le background d\'une image via API remove.bg')
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    
    args = parser.parse_args()
    
    success = remove_background(args.input, args.output)
    sys.exit(0 if success else 1)
