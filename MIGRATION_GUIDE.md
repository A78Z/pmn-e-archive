# Guide de Migration Supabase → Back4App

## ✅ Travail Complété

### Pages Migrées
- ✅ `app/login/page.tsx` - Authentification Parse
- ✅ `app/register/page.tsx` - Inscription Parse
- ✅ `app/forgot-password/page.tsx` - Réinitialisation Parse
- ✅ `app/dashboard/documents/page.tsx` - Gestion documents Parse
- ✅ `app/dashboard/upload/page.tsx` - Upload Parse Files
- ✅ `app/dashboard/messages/page.tsx` - Messagerie Parse (polling)
- ✅ `app/dashboard/shares/page.tsx` - Partages Parse
- ✅ `app/dashboard/access-requests/page.tsx` - Demandes d'accès Parse
- ✅ `app/dashboard/administration/page.tsx` - Administration Parse
- ✅ `app/dashboard/users/page.tsx` - Gestion utilisateurs Parse
- ✅ `app/shared/[token]/page.tsx` - Partage public Parse

### Infrastructure Migrée
- ✅ `lib/parse.ts` - Configuration Parse SDK
- ✅ `lib/parse-auth.tsx` - Contexte d'authentification Parse
- ✅ `lib/parse-helpers.ts` - Helpers pour toutes les opérations Parse
- ✅ `middleware.ts` - Protection des routes avec Parse session
- ✅ `app/layout.tsx` - Provider Parse Auth

### Fichiers Supprimés
- ✅ `lib/supabase.ts` - Supprimé
- ✅ `lib/auth-context.tsx` - Remplacé par `parse-auth.tsx`
- ✅ `app/api/share/[token]/route.ts` - Supprimé (logique déplacée côté client)
- ✅ `app/api/share-folder/[token]/route.ts` - Supprimé

### Dépendances
- ✅ Supprimé : `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`
- ✅ Ajouté : `parse`, `@types/parse`

## 🔧 Configuration Requise

### 1. Variables d'Environnement

Créez `.env.local` avec :

```env
NEXT_PUBLIC_PARSE_APP_ID=your_app_id_here
NEXT_PUBLIC_PARSE_JS_KEY=your_javascript_key_here
NEXT_PUBLIC_PARSE_SERVER_URL=https://parseapi.back4app.com
```

### 2. Classes Parse à Créer

Dans votre dashboard Back4App, créez les classes suivantes avec leurs champs :

#### User (classe existante - ajouter champs personnalisés)
```
full_name: String
role: String (valeurs: super_admin, admin, user, guest)
department: String
is_active: Boolean (défaut: true)
is_verified: Boolean (défaut: false)
fonction: String
assigned_zone: String
last_login: Date
admin_notes: String
```

#### Document
```
name: String
category: String
file: File
size: Number
uploaded_by: String (ou Pointer<User>)
folder_id: String
```

#### Folder
```
name: String
created_by: String (ou Pointer<User>)
parent_id: String
```

#### Share
```
document_id: String
folder_id: String
shared_by: String
shared_with: String
token: String (pour partages publics)
can_read: Boolean
can_write: Boolean
can_delete: Boolean
can_share: Boolean
is_link_share: Boolean
expires_at: Date
```

#### Message
```
sender_id: String
receiver_id: String
content: String
type: String (défaut: "text")
read: Boolean (défaut: false)
```

#### Channel
```
name: String
description: String
type: String (public/private)
created_by: String
```

#### ChannelMember
```
channel_id: String
user_id: String
role: String (admin/member)
```

#### AccessRequest
```
document_id: String
requested_by: String
status: String (pending/approved/rejected)
reviewed_by: String
reviewed_at: Date
reason: String
requested_permissions: Object
rejection_reason: String
```

### 3. Cloud Functions Requises

Ajoutez ces Cloud Functions dans Back4App (Cloud Code) :

```javascript
// main.js dans Cloud Code

// Fonction pour inviter un utilisateur (utilisée par administration)
Parse.Cloud.define("inviteUser", async (request) => {
  const { full_name, email, department, role, is_active } = request.params;
  
  // Vérifier que l'utilisateur appelant est admin
  if (!request.user) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Authentification requise");
  }
  
  const currentUser = await new Parse.Query(Parse.User).get(request.user.id, { useMasterKey: true });
  if (!['admin', 'super_admin'].includes(currentUser.get('role'))) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, "Permissions insuffisantes");
  }
  
  // Créer l'utilisateur
  const user = new Parse.User();
  user.set("username", email);
  user.set("email", email);
  user.set("password", Math.random().toString(36).slice(-8) + "Aa1!"); // Mot de passe temporaire
  user.set("full_name", full_name);
  user.set("department", department || "");
  user.set("role", role);
  user.set("is_active", is_active);
  user.set("is_verified", false);
  
  await user.signUp(null, { useMasterKey: true });
  
  // TODO: Envoyer email avec mot de passe temporaire
  
  return { 
    success: true, 
    userId: user.id,
    message: "Utilisateur créé avec succès"
  };
});

// Fonction pour vérifier/valider un utilisateur
Parse.Cloud.define("verifyUser", async (request) => {
  const { userId, approved, notes } = request.params;
  
  // Vérifier permissions
  if (!request.user) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Authentification requise");
  }
  
  const currentUser = await new Parse.Query(Parse.User).get(request.user.id, { useMasterKey: true });
  if (!['admin', 'super_admin'].includes(currentUser.get('role'))) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, "Permissions insuffisantes");
  }
  
  // Mettre à jour l'utilisateur
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

### 4. Permissions (CLPs)

Configurez les Class Level Permissions pour chaque classe :

#### User
- **Find**: Public Read (pour recherche utilisateurs)
- **Get**: Authenticated users
- **Create**: Public (pour inscription)
- **Update**: Authenticated users (own records only)
- **Delete**: Master Key only

#### Document, Folder, Share, Message, etc.
- **Find/Get**: Authenticated users
- **Create/Update/Delete**: Authenticated users (avec logique métier)

> **Note** : Pour une sécurité optimale, utilisez des Cloud Functions avec `useMasterKey: true` pour les opérations sensibles.

## 🚀 Démarrage

1. **Installer les dépendances**
```bash
npm install
```

2. **Configurer `.env.local`**
```bash
cp ENV_TEMPLATE.md .env.local
# Éditer .env.local avec vos identifiants Back4App
```

3. **Lancer en développement**
```bash
npm run dev
```

4. **Créer le premier utilisateur admin**

Utilisez le dashboard Back4App pour créer manuellement le premier utilisateur :
- Username: admin@example.com
- Email: admin@example.com
- Password: (votre mot de passe)
- role: super_admin
- is_active: true
- is_verified: true

## ⚠️ Points d'Attention

### Fonctionnalités Temporaires

1. **Realtime → Polling**
   - Les notifications et messages utilisent du polling (10s)
   - Pour améliorer : implémenter Parse Live Query

2. **User Preferences**
   - Actuellement stockées dans `localStorage`
   - Pour améliorer : créer classe `UserPreference` dans Parse

3. **Suppression d'utilisateurs**
   - Nécessite Master Key ou Cloud Function
   - Actuellement peut échouer côté client

### Fonctionnalités à Tester

- [ ] Connexion/Déconnexion
- [ ] Inscription et validation admin
- [ ] Upload de documents
- [ ] Partage de documents
- [ ] Messagerie
- [ ] Demandes d'accès
- [ ] Administration utilisateurs

## 📊 Différences Supabase vs Parse

| Fonctionnalité | Supabase | Parse (Back4App) |
|----------------|----------|------------------|
| Auth | `supabase.auth` | `Parse.User` |
| Query | `supabase.from('table')` | `new Parse.Query('Class')` |
| Insert | `.insert()` | `object.save()` |
| Update | `.update()` | `object.set() + save()` |
| Delete | `.delete()` | `object.destroy()` |
| Files | `supabase.storage` | `Parse.File` |
| Realtime | Channels | Live Query ou Polling |
| RPC | `.rpc()` | `Parse.Cloud.run()` |

## 🔍 Debugging

### Erreurs courantes

1. **"User creation requires Cloud Code"**
   - Solution : Implémenter la Cloud Function `inviteUser`

2. **"Permission denied"**
   - Solution : Vérifier les CLPs de la classe
   - Ou utiliser Cloud Function avec `useMasterKey: true`

3. **"Session token invalid"**
   - Solution : Vérifier que le cookie `parse-session-token` est présent
   - Reconnecter l'utilisateur

4. **Upload échoue**
   - Solution : Vérifier que Parse Files est activé dans Back4App
   - Vérifier la taille maximale des fichiers

## 📝 TODO

- [ ] Implémenter Parse Live Query pour le realtime
- [ ] Créer classe UserPreference et migrer depuis localStorage
- [ ] Ajouter gestion des erreurs plus robuste
- [ ] Implémenter pagination pour grandes listes
- [ ] Ajouter tests unitaires
- [ ] Optimiser les requêtes Parse (includes, select)
- [ ] Ajouter compression d'images avant upload
- [ ] Implémenter recherche full-text avec Parse

## ✅ Migration Terminée

La migration de Supabase vers Back4App est **complète** ! 🎉

Toutes les pages et fonctionnalités ont été migrées pour utiliser Parse SDK.
Suivez les étapes de configuration ci-dessus pour finaliser le déploiement.
