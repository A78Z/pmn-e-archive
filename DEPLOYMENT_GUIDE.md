# Guide de Déploiement : Correction Upload en Masse

## Déploiement Rapide

### 1. Frontend (Vercel)

```bash
# Staging
git checkout -b fix/bulk-upload-validation
git add .
git commit -m "fix: Add filename validation and resilient bulk upload"
git push origin fix/bulk-upload-validation
```

Vercel déploiera automatiquement. URL de preview fournie dans les commentaires GitHub/Vercel.

### 2. Backend (Back4App Cloud Code)

#### Via Dashboard

1. Se connecter à [Back4App Dashboard](https://dashboard.back4app.com)
2. Sélectionner l'application **PMN Archive**
3. Aller dans **Cloud Code** → **Functions**
4. Cliquer sur **Deploy**
5. Uploader le fichier `cloud/main.js`
6. Cliquer sur **Deploy** et attendre confirmation

#### Vérification

Dans Cloud Code → Logs, vérifier :
```
Cloud Code loaded: Filename validation and upload functions ready
```

### 3. Tests de Validation

#### Test Rapide

1. Accéder à l'URL de staging Vercel
2. Se connecter
3. Aller sur `/dashboard/upload`
4. Uploader les fichiers de la capture d'écran :
   - `000-Autorisation d'acquisition de véhicules.pdf`
   - `001-AOO VEHICULE 4X4 STATION WAGON DAO CORRIGE.docx`

**Résultat attendu :**
- ⚠️ Avertissement de renommage automatique
- Upload réussi
- Fichiers visibles dans `/dashboard/documents`

#### Test Cloud Function

Dans la console Back4App ou via code :

```javascript
const result = await Parse.Cloud.run('testFilenameSanitization');
console.log(result);
```

### 4. Déploiement Production

Une fois validé sur staging :

```bash
git checkout main
git merge fix/bulk-upload-validation
git push origin main
```

Déploiement automatique sur Vercel production.

---

## Fichiers Modifiés

- ✅ `lib/filename-utils.ts` (NEW)
- ✅ `app/dashboard/upload/page.tsx` (MODIFY)
- ✅ `lib/parse-helpers.ts` (MODIFY)
- ✅ `cloud/main.js` (NEW - à déployer sur Back4App)

---

## Checklist de Déploiement

- [ ] Code committé et pushé vers branche staging
- [ ] Vercel a déployé la preview
- [ ] Cloud Code déployé sur Back4App
- [ ] Tests manuels effectués sur staging
- [ ] Validation par l'équipe
- [ ] Merge vers main
- [ ] Déploiement production vérifié
- [ ] Tests de smoke en production

---

## Support

En cas de problème, vérifier :
1. Logs Vercel (pour erreurs frontend)
2. Logs Back4App Cloud Code (pour erreurs backend)
3. Console navigateur (pour erreurs client)
