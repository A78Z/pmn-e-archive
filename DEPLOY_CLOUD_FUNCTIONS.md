# Déploiement des Cloud Functions sur Back4App

## ⚠️ IMPORTANT

Les Cloud Functions doivent être déployées sur Back4App pour que la liste des utilisateurs fonctionne correctement.

## 📋 Méthode Rapide (Interface Web)

1. **Connectez-vous à Back4App**
   - Allez sur https://www.back4app.com/apps
   - Sélectionnez votre application **e-archive-pmn-master**

2. **Accédez au Cloud Code**
   - Dans le menu de gauche, cliquez sur **Cloud Code**
   - Puis cliquez sur **Functions**

3. **Déployez le Code**
   - Copiez tout le contenu du fichier `cloud/main.js`
   - Collez-le dans l'éditeur Back4App
   - Cliquez sur **Deploy** (bouton bleu en haut à droite)

4. **Vérifiez le Déploiement**
   - Attendez quelques secondes
   - Vous devriez voir un message de succès
   - Les fonctions `getAllUsers`, `verifyUser`, et `updateUserRole` devraient apparaître dans la liste

## 🧪 Test

Après le déploiement :

1. Rafraîchissez la page `/dashboard/users`
2. Vous devriez maintenant voir **2 utilisateurs** :
   - Harouna Sylla
   - Lamine Badji

## 🔧 Dépannage

Si vous ne voyez toujours qu'un seul utilisateur :

1. Vérifiez que les Cloud Functions sont bien déployées
2. Ouvrez la console du navigateur (F12)
3. Regardez s'il y a des erreurs
4. Essayez de vous déconnecter et reconnecter

## 📝 Fichier à Déployer

Le fichier à déployer est : `cloud/main.js`

Il contient maintenant :
- ✅ Fonctions de validation de fichiers (déjà présentes)
- ✅ Fonctions de gestion des utilisateurs (nouvellement ajoutées)
