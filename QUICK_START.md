# 🚀 Guide de Démarrage Rapide

## ✅ Configuration Complétée

Vos clés Back4App ont été configurées avec succès dans `.env.local` !

```
Application ID: kJIx0REXZJo3a4WA91EqKKjHvav6LgGusv94cyxF
JavaScript Key: 3NsaHXkgyehFtgauTCkqHAD8O2Vh2cb5QvlRZPuE
Server URL: https://parseapi.back4app.com
```

## 📋 Étapes Suivantes (Dans l'ordre)

### 1. Créer les Classes dans Back4App (15 min)

Allez sur votre dashboard Back4App : https://dashboard.back4app.com/

#### Classes à créer :

**a) User (classe existante - ajouter colonnes)**
- Allez dans Database > Browser > User
- Cliquez sur "Add a new column" pour chaque champ :
  - `full_name` (String)
  - `role` (String)
  - `department` (String)
  - `is_active` (Boolean)
  - `is_verified` (Boolean)
  - `fonction` (String)
  - `assigned_zone` (String)
  - `last_login` (Date)
  - `admin_notes` (String)

**b) Document**
- Cliquez sur "Create a class" > Nom: `Document`
- Ajoutez les colonnes :
  - `name` (String)
  - `category` (String)
  - `file` (File)
  - `size` (Number)
  - `uploaded_by` (String)
  - `folder_id` (String)

**c) Folder**
- Créez la classe `Folder`
- Colonnes :
  - `name` (String)
  - `created_by` (String)
  - `parent_id` (String)

**d) Share**
- Créez la classe `Share`
- Colonnes :
  - `document_id` (String)
  - `folder_id` (String)
  - `shared_by` (String)
  - `shared_with` (String)
  - `token` (String)
  - `can_read` (Boolean)
  - `can_write` (Boolean)
  - `can_delete` (Boolean)
  - `can_share` (Boolean)
  - `is_link_share` (Boolean)
  - `expires_at` (Date)

**e) Message**
- Créez la classe `Message`
- Colonnes :
  - `sender_id` (String)
  - `receiver_id` (String)
  - `content` (String)
  - `type` (String)
  - `read` (Boolean)

**f) Channel**
- Créez la classe `Channel`
- Colonnes :
  - `name` (String)
  - `description` (String)
  - `type` (String)
  - `created_by` (String)

**g) ChannelMember**
- Créez la classe `ChannelMember`
- Colonnes :
  - `channel_id` (String)
  - `user_id` (String)
  - `role` (String)

**h) AccessRequest**
- Créez la classe `AccessRequest`
- Colonnes :
  - `document_id` (String)
  - `requested_by` (String)
  - `status` (String)
  - `reviewed_by` (String)
  - `reviewed_at` (Date)
  - `reason` (String)
  - `requested_permissions` (Object)
  - `rejection_reason` (String)

> 💡 **Astuce** : Le fichier `back4app-schema.js` contient tous les schémas détaillés

### 2. Ajouter les Cloud Functions (5 min)

Dans votre dashboard Back4App :
1. Allez dans **Cloud Code** > **Functions**
2. Cliquez sur **Edit** sur `main.js`
3. Copiez-collez ce code :

```javascript
// Cloud Function pour inviter un utilisateur
Parse.Cloud.define("inviteUser", async (request) => {
  const { full_name, email, department, role, is_active } = request.params;
  
  if (!request.user) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Authentification requise");
  }
  
  const currentUser = await new Parse.Query(Parse.User).get(request.user.id, { useMasterKey: true });
  if (!['admin', 'super_admin'].includes(currentUser.get('role'))) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, "Permissions insuffisantes");
  }
  
  const user = new Parse.User();
  user.set("username", email);
  user.set("email", email);
  user.set("password", Math.random().toString(36).slice(-8) + "Aa1!");
  user.set("full_name", full_name);
  user.set("department", department || "");
  user.set("role", role);
  user.set("is_active", is_active);
  user.set("is_verified", false);
  
  await user.signUp(null, { useMasterKey: true });
  
  return { 
    success: true, 
    userId: user.id,
    message: "Utilisateur créé avec succès"
  };
});

// Cloud Function pour vérifier un utilisateur
Parse.Cloud.define("verifyUser", async (request) => {
  const { userId, approved, notes } = request.params;
  
  if (!request.user) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Authentification requise");
  }
  
  const currentUser = await new Parse.Query(Parse.User).get(request.user.id, { useMasterKey: true });
  if (!['admin', 'super_admin'].includes(currentUser.get('role'))) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, "Permissions insuffisantes");
  }
  
  const query = new Parse.Query(Parse.User);
  const user = await query.get(userId, { useMasterKey: true });
  
  user.set("is_verified", approved);
  user.set("is_active", approved);
  if (notes) {
    user.set("admin_notes", notes);
  }
  
  await user.save(null, { useMasterKey: true });
  
  return { success: true };
});
```

4. Cliquez sur **Deploy**

### 3. Créer le Premier Utilisateur Admin (2 min)

Dans le dashboard Back4App :
1. Allez dans **Database** > **Browser** > **User**
2. Cliquez sur **+ Row**
3. Remplissez :
   - `username`: admin@example.com
   - `email`: admin@example.com
   - `password`: (votre mot de passe sécurisé)
   - `full_name`: Administrateur
   - `role`: super_admin
   - `is_active`: true
   - `is_verified`: true
4. Cliquez sur **Create**

### 4. Lancer l'Application (1 min)

```bash
npm run dev
```

Ouvrez http://localhost:3000

### 5. Tester la Connexion

1. Allez sur http://localhost:3000/login
2. Connectez-vous avec :
   - Email: admin@example.com
   - Mot de passe: (celui que vous avez créé)
3. Vous devriez être redirigé vers le dashboard !

## ✅ Checklist de Vérification

- [ ] Classes créées dans Back4App
- [ ] Cloud Functions déployées
- [ ] Premier admin créé
- [ ] Application lancée (`npm run dev`)
- [ ] Connexion réussie
- [ ] Upload d'un document de test
- [ ] Création d'un utilisateur de test
- [ ] Envoi d'un message de test

## 🎯 Prochaines Fonctionnalités à Tester

1. **Documents**
   - Upload de fichiers
   - Création de dossiers
   - Recherche

2. **Partage**
   - Partager avec un utilisateur
   - Créer un lien de partage public
   - Tester les permissions

3. **Messagerie**
   - Envoyer un message
   - Créer un canal
   - Vérifier les notifications

4. **Administration**
   - Inviter un utilisateur
   - Valider un compte
   - Gérer les rôles

## 🐛 Problèmes Courants

### "Session token invalid"
- Reconnectez-vous
- Vérifiez que le cookie est bien créé

### "Permission denied"
- Vérifiez les CLPs dans Back4App
- Assurez-vous que les Cloud Functions sont déployées

### Upload échoue
- Vérifiez que Parse Files est activé
- Vérifiez la taille maximale des fichiers (Settings > General)

## 📚 Documentation

- **README.md** - Documentation complète
- **MIGRATION_GUIDE.md** - Guide détaillé
- **back4app-schema.js** - Schémas des classes

## 🎉 Vous êtes Prêt !

Une fois ces étapes complétées, votre application sera entièrement fonctionnelle avec Back4App !

---

**Temps estimé total** : ~25 minutes  
**Difficulté** : Facile  
**Support** : Consultez MIGRATION_GUIDE.md pour plus de détails
