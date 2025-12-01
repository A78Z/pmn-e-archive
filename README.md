# E-Archive PMN - Système de Gestion Documentaire

Application de gestion documentaire pour le Mobilier National, migrée vers Back4App (Parse Platform).

## 🚀 Technologies

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Back4App (Parse Platform)
- **Styling**: Tailwind CSS, Radix UI
- **Authentification**: Parse SDK
- **Stockage**: Parse Files (Back4App)

## 📋 Prérequis

- Node.js 18+ 
- Compte Back4App
- npm ou yarn

## 🔧 Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd e-archive-pmn-master
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration de l'environnement**

Créer un fichier `.env.local` à la racine du projet :

```env
# Back4App Configuration
NEXT_PUBLIC_PARSE_APP_ID=your_app_id
NEXT_PUBLIC_PARSE_JS_KEY=your_javascript_key
NEXT_PUBLIC_PARSE_SERVER_URL=https://parseapi.back4app.com
```

Pour obtenir ces identifiants :
1. Connectez-vous à [Back4App](https://www.back4app.com/)
2. Créez une nouvelle application ou sélectionnez une existante
3. Allez dans **App Settings > Security & Keys**
4. Copiez l'Application ID et le JavaScript Key

4. **Configuration de la base de données Back4App**

Créez les classes Parse suivantes dans votre dashboard Back4App :

### Classes requises :

- **User** (classe par défaut Parse)
  - Champs personnalisés : `full_name`, `role`, `department`, `is_active`, `is_verified`, `fonction`, `assigned_zone`, `last_login`

- **Document**
  - `name` (String)
  - `category` (String)
  - `file` (File)
  - `size` (Number)
  - `uploaded_by` (Pointer to User)
  - `folder_id` (String, optional)

- **Folder**
  - `name` (String)
  - `created_by` (Pointer to User)
  - `parent_id` (String, optional)

- **Share**
  - `document_id` (String)
  - `folder_id` (String, optional)
  - `shared_by` (String)
  - `shared_with` (String, optional)
  - `token` (String)
  - `can_read` (Boolean)
  - `can_write` (Boolean)
  - `can_delete` (Boolean)
  - `can_share` (Boolean)
  - `is_link_share` (Boolean)
  - `expires_at` (Date, optional)

- **Message**
  - `sender_id` (String)
  - `receiver_id` (String)
  - `content` (String)
  - `type` (String)
  - `read` (Boolean)

- **Channel**
  - `name` (String)
  - `description` (String)
  - `type` (String)
  - `created_by` (String)

- **ChannelMember**
  - `channel_id` (String)
  - `user_id` (String)
  - `role` (String)

- **AccessRequest**
  - `document_id` (String)
  - `requested_by` (String)
  - `status` (String)
  - `reviewed_by` (String, optional)
  - `reviewed_at` (Date, optional)
  - `reason` (String)
  - `requested_permissions` (Object)
  - `rejection_reason` (String, optional)

5. **Cloud Functions requises**

Certaines fonctionnalités nécessitent des Cloud Functions Parse. Créez les fonctions suivantes dans **Cloud Code** :

```javascript
// Cloud Function pour inviter un utilisateur
Parse.Cloud.define("inviteUser", async (request) => {
  const { full_name, email, department, role, is_active } = request.params;
  
  const user = new Parse.User();
  user.set("username", email);
  user.set("email", email);
  user.set("password", Math.random().toString(36).slice(-8)); // Mot de passe temporaire
  user.set("full_name", full_name);
  user.set("department", department);
  user.set("role", role);
  user.set("is_active", is_active);
  user.set("is_verified", false);
  
  await user.signUp(null, { useMasterKey: true });
  return { success: true, userId: user.id };
});

// Cloud Function pour vérifier un utilisateur
Parse.Cloud.define("verifyUser", async (request) => {
  const { userId, approved, notes } = request.params;
  
  const query = new Parse.Query(Parse.User);
  const user = await query.get(userId, { useMasterKey: true });
  
  user.set("is_verified", approved);
  user.set("is_active", approved);
  if (notes) user.set("admin_notes", notes);
  
  await user.save(null, { useMasterKey: true });
  return { success: true };
});
```

## 🏃 Démarrage

```bash
# Mode développement
npm run dev

# Build production
npm run build

# Démarrer en production
npm start
```

L'application sera accessible sur `http://localhost:3000`

## 📁 Structure du projet

```
e-archive-pmn-master/
├── app/
│   ├── dashboard/          # Pages du tableau de bord
│   │   ├── documents/      # Gestion des documents
│   │   ├── upload/         # Upload de fichiers
│   │   ├── messages/       # Messagerie
│   │   ├── shares/         # Partages
│   │   ├── access-requests/# Demandes d'accès
│   │   ├── administration/ # Administration
│   │   └── users/          # Gestion des utilisateurs
│   ├── shared/[token]/     # Pages de partage public
│   ├── login/              # Connexion
│   ├── register/           # Inscription
│   └── forgot-password/    # Réinitialisation
├── components/             # Composants réutilisables
│   └── ui/                 # Composants UI (Radix)
├── lib/
│   ├── parse.ts            # Configuration Parse
│   ├── parse-auth.tsx      # Contexte d'authentification
│   └── parse-helpers.ts    # Helpers pour Parse
└── public/                 # Fichiers statiques
```

## 🔐 Authentification

L'application utilise Parse SDK pour l'authentification :
- Connexion avec email/mot de passe
- Inscription avec validation admin
- Réinitialisation de mot de passe
- Gestion de session avec cookies

## 📝 Fonctionnalités principales

### Gestion des documents
- Upload de fichiers
- Organisation en dossiers
- Catégorisation
- Recherche et filtrage

### Partage
- Partage avec utilisateurs spécifiques
- Liens de partage publics avec token
- Permissions granulaires (lecture, écriture, suppression, partage)
- Expiration des partages

### Messagerie
- Messages directs entre utilisateurs
- Canaux de discussion
- Notifications en temps réel (polling)

### Administration
- Gestion des utilisateurs
- Validation des comptes
- Gestion des rôles et permissions
- Demandes d'accès aux documents

## 🔄 Migration depuis Supabase

Ce projet a été migré de Supabase vers Back4App. Les principales différences :

- **Authentification** : `supabase.auth` → `Parse.User`
- **Base de données** : `supabase.from()` → `Parse.Query`
- **Stockage** : `supabase.storage` → `Parse.File`
- **Realtime** : Supabase Realtime → Polling (ou Parse Live Query)

## 🛠️ Développement

### Helpers disponibles

Le fichier `lib/parse-helpers.ts` contient des helpers pour :
- `DocumentHelpers` : CRUD documents
- `FolderHelpers` : CRUD dossiers
- `UserHelpers` : Gestion utilisateurs
- `MessageHelpers` : Messagerie
- `ChannelHelpers` : Canaux de discussion
- `ShareHelpers` : Partages
- `AccessRequestHelpers` : Demandes d'accès
- `FileHelpers` : Upload de fichiers

### Ajout d'une nouvelle fonctionnalité

1. Créer la classe Parse dans Back4App
2. Ajouter les helpers dans `parse-helpers.ts`
3. Créer les composants UI
4. Ajouter les routes si nécessaire

## 🐛 Dépannage

### Erreur de connexion à Back4App
- Vérifiez vos identifiants dans `.env.local`
- Assurez-vous que l'URL du serveur est correcte

### Erreur lors de l'upload de fichiers
- Vérifiez les permissions de la classe `Document`
- Assurez-vous que Parse Files est activé

### Erreur "User creation requires Cloud Code"
- Implémentez la Cloud Function `inviteUser`
- Ou configurez les CLPs pour permettre la création d'utilisateurs

## 📄 Licence

Propriété du Mobilier National - Tous droits réservés

## 👥 Support

Pour toute question ou problème, contactez l'équipe de développement.
