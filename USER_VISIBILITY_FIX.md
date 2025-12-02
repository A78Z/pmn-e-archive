# Solution : Utilisateur Invisible dans Administration

## Probl\u00e8me

L'utilisateur `lamine.dadji@pmn.sn` a \u00e9t\u00e9 cr\u00e9\u00e9 mais n'appara\u00eet pas dans la page d'administration.

## Causes Possibles

### 1. Permissions CLP (Class-Level Permissions)

Back4App peut avoir des restrictions sur la classe `_User` qui emp\u00eachent la lecture de tous les utilisateurs.

**V\u00e9rification :**
1. Aller sur Back4App Dashboard
2. S\u00e9lectionner votre application
3. Aller dans **Core** \u2192 **Browser** \u2192 **_User**
4. V\u00e9rifier si l'utilisateur `lamine.dadji@pmn.sn` existe

### 2. Cache ou Rafra\u00eechissement

La page peut afficher des donn\u00e9es en cache.

## Solutions Appliqu\u00e9es

### \u2705 Bouton \"Actualiser\"

Ajout d'un bouton \"Actualiser\" dans la page d'administration pour forcer le rechargement de la liste des utilisateurs.

**Fichier modifi\u00e9 :** `app/dashboard/administration/page.tsx`

```typescript
<Button
  onClick={() => {
    fetchData();
    toast.success('Liste des utilisateurs actualis\u00e9e');
  }}
  variant=\"outline\"
  className=\"border-blue-600 text-blue-600 hover:bg-blue-50\"
>
  <Activity className=\"h-4 w-4 mr-2\" />
  Actualiser
</Button>
```

## Proc\u00e9dure de Test

### 1. Actualiser la Page

1. Aller sur `/dashboard/administration`
2. Cliquer sur le bouton **\"Actualiser\"**
3. V\u00e9rifier si l'utilisateur `lamine.dadji@pmn.sn` appara\u00eet

### 2. V\u00e9rifier sur Back4App

Si l'utilisateur n'appara\u00eet toujours pas :

1. **Aller sur Back4App Dashboard**
2. **Core** \u2192 **Browser** \u2192 **_User**
3. **Chercher** `lamine.dadji@pmn.sn`

**Si l'utilisateur existe sur Back4App mais pas dans l'app :**
- Probl\u00e8me de permissions CLP

**Si l'utilisateur n'existe pas sur Back4App :**
- La cr\u00e9ation a \u00e9chou\u00e9

### 3. Corriger les Permissions CLP

Si le probl\u00e8me est li\u00e9 aux permissions :

1. **Back4App Dashboard** \u2192 **Core** \u2192 **Browser** \u2192 **_User**
2. Cliquer sur **\"Security\"** (ic\u00f4ne cadenas)
3. V\u00e9rifier les permissions :
   - **Find** : Autoriser pour les r\u00f4les `admin` et `super_admin`
   - **Get** : Autoriser pour les r\u00f4les `admin` et `super_admin`

**Configuration recommand\u00e9e :**

| Permission | Public | Authenticated | Admin | Super Admin |
|------------|--------|---------------|-------|-------------|
| Find | \u274c | \u274c | \u2705 | \u2705 |
| Get | \u274c | \u2705 (own) | \u2705 | \u2705 |
| Create | \u2705 | \u274c | \u2705 | \u2705 |
| Update | \u274c | \u2705 (own) | \u2705 | \u2705 |
| Delete | \u274c | \u274c | \u2705 | \u2705 |

### 4. V\u00e9rifier le R\u00f4le de l'Utilisateur Connect\u00e9

Assurez-vous que vous \u00eates connect\u00e9 en tant que `admin` ou `super_admin` :

1. Ouvrir la console du navigateur
2. Taper : `Parse.User.current().get('role')`
3. V\u00e9rifier que le r\u00f4le est `admin` ou `super_admin`

## Solution Alternative : Query Directe

Si le probl\u00e8me persiste, vous pouvez utiliser une query directe avec `useMasterKey` (n\u00e9cessite Cloud Code) :

**Cloud Function \u00e0 ajouter dans `cloud/main.js` :**

```javascript
Parse.Cloud.define('getAllUsers', async (request) => {
  // V\u00e9rifier que l'utilisateur est admin
  const currentUser = request.user;
  if (!currentUser) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'Utilisateur non authentifi\u00e9');
  }
  
  const role = currentUser.get('role');
  if (!['admin', 'super_admin'].includes(role)) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Permission refus\u00e9e');
  }
  
  // Query avec Master Key
  const query = new Parse.Query(Parse.User);
  query.descending('createdAt');
  
  const results = await query.find({ useMasterKey: true });
  
  return results.map(user => ({
    id: user.id,
    full_name: user.get('full_name'),
    email: user.get('email'),
    role: user.get('role'),
    department: user.get('department'),
    is_active: user.get('is_active'),
    is_verified: user.get('is_verified'),
    createdAt: user.get('createdAt'),
    last_login: user.get('last_login')
  }));
});
```

**Modifier `UserHelpers.getAll()` :**

```typescript
async getAll() {
  try {
    // Essayer d'utiliser la Cloud Function
    const results = await Parse.Cloud.run('getAllUsers');
    return results;
  } catch (error) {
    console.error('Cloud function failed, falling back to direct query:', error);
    // Fallback vers query directe
    const query = new Parse.Query(Parse.User);
    query.descending('createdAt');
    const results = await query.find();
    return results.map(parseObjectToJSON);
  }
}
```

## R\u00e9sum\u00e9

\u2705 **Bouton \"Actualiser\" ajout\u00e9** pour forcer le rechargement  
\u23f3 **Tester** : Cliquer sur \"Actualiser\" dans la page d'administration  
\u23f3 **V\u00e9rifier** : Back4App Dashboard \u2192 _User \u2192 Chercher `lamine.dadji@pmn.sn`  
\u23f3 **Corriger CLP** si n\u00e9cessaire  
