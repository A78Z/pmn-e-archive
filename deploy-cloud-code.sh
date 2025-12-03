#!/bin/bash

# Script de déploiement automatique des Cloud Functions sur Back4App
# Usage: ./deploy-cloud-code.sh

echo "🚀 Déploiement des Cloud Functions sur Back4App..."
echo ""

# Vérifier que le fichier cloud/main.js existe
if [ ! -f "cloud/main.js" ]; then
    echo "❌ Erreur: Le fichier cloud/main.js n'existe pas"
    exit 1
fi

echo "✅ Fichier cloud/main.js trouvé"
echo ""

# Vérifier si parse-cli est installé
if ! command -v parse &> /dev/null; then
    echo "📦 Installation de parse-cli..."
    npm install -g parse-cli
    echo "✅ parse-cli installé"
    echo ""
fi

# Vérifier si .parse.local existe
if [ ! -f ".parse.local" ]; then
    echo "⚙️  Configuration de Parse CLI..."
    echo ""
    echo "Veuillez entrer les informations suivantes:"
    echo ""
    
    # Lire les variables d'environnement
    if [ -f ".env.local" ]; then
        source .env.local
        echo "Application ID: $NEXT_PUBLIC_PARSE_APP_ID"
    else
        read -p "Application ID: " APP_ID
        NEXT_PUBLIC_PARSE_APP_ID=$APP_ID
    fi
    
    read -p "Master Key: " MASTER_KEY
    
    # Créer le fichier de configuration
    cat > .parse.local << EOF
{
  "applications": {
    "_default": {
      "link": "e-archive-pmn"
    },
    "e-archive-pmn": {
      "applicationId": "${NEXT_PUBLIC_PARSE_APP_ID}",
      "masterKey": "${MASTER_KEY}"
    }
  },
  "global": {
    "parseVersion": "1.11.0"
  }
}
EOF
    
    echo ""
    echo "✅ Configuration créée"
fi

echo ""
echo "📤 Déploiement en cours..."
echo ""

# Déployer
parse deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ✅ ✅ DÉPLOIEMENT RÉUSSI ! ✅ ✅ ✅"
    echo ""
    echo "Les Cloud Functions sont maintenant disponibles:"
    echo "  - getAllUsers"
    echo "  - verifyUser"
    echo "  - updateUserRole"
    echo ""
    echo "🎉 Vous pouvez maintenant rafraîchir /dashboard/users"
    echo ""
else
    echo ""
    echo "❌ Erreur lors du déploiement"
    echo ""
    echo "Essayez la méthode manuelle via l'interface Back4App:"
    echo "https://www.back4app.com/apps → Cloud Code → Files"
    echo ""
fi
