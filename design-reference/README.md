# Handoff : Refonte UI — Archive PMN

## Vue d'ensemble
Refonte de l'interface de la plateforme d'archivage numérique **Archive PMN** (Projet Mobilier National).
Le prototype couvre 4 écrans navigables au sein d'une coquille applicative unique (sidebar + barre supérieure) :
**Tableau de bord**, **Documents (arborescence)**, **Uploader**, **Messages**. Deux écrans placeholder
(Partages / Administration / Demandes d'accès / Gestion Utilisateurs) partagent la même charte.

## À propos des fichiers de design
Le fichier de ce paquet (`Archive PMN.dc.html`) est une **référence de design réalisée en HTML** — un prototype
qui montre l'apparence et le comportement voulus, **pas du code de production à copier tel quel**.
La tâche consiste à **recréer ce design dans l'environnement du codebase cible** (ici : très probablement
**React + Next.js**, hébergé sur Vercel — voir l'URL de prod `pmn-e-archive.vercel.app`) en réutilisant ses
patterns, sa librairie de composants et son système de styles existants. Le prototype utilise un moteur de
composants maison (`.dc.html`) et des styles inline : ne pas reprendre cette mécanique — reprendre les
**valeurs visuelles, la structure et les comportements** décrits ci-dessous.

## Fidélité
**Haute fidélité (hifi).** Couleurs, typographie, espacements et interactions sont définitifs.
Recréer l'UI au pixel près avec les librairies/patterns du codebase.

---

## Système de design (tokens)

### Couleurs
| Rôle | Hex |
|---|---|
| Vert forêt (sidebar, dégradé) | `#0C3327` → `#0F3D2E` → `#0B2C22` |
| Vert primaire (boutons, actif) | `#15654B` |
| Vert primaire foncé (dégradé CTA) | `#0E3B2E` / `#124F3B` |
| Vert clair (accent graphes) | `#1F8A63` |
| Or PMN (accent) | `#E4B429` |
| Or foncé (texte sur fond clair) | `#B8871A` / `#C7961A` |
| Fond application | `#F6F5F0` |
| Fond survol de ligne | `#FAFAF7` |
| Carte / surface | `#FFFFFF` |
| Bordure | `rgba(20,33,28,.08)` |
| Texte principal (encre) | `#16231E` / titres `#12211B` |
| Texte secondaire | `#66746E` / `#3E4B45` |
| Texte atténué | `#93A099` / `#8A948F` |
| Vert « en ligne » | `#22A06B` |
| Rouge (fichier PDF) | `#C63131` |
| Bleu (fichier DOC) | `#2B6FDB` |

Note accent : dans la sidebar, l'état **actif** = fond `rgba(228,180,41,.16)` + liseré gauche `3px #E4B429`
(texte reste clair `#E7F1EB`). État survol = `rgba(255,255,255,.06)`.

### Typographie
- **Titres de page (display)** : `Spectral` (serif), weight 600. *Option runtime : bascule possible vers sans.*
- **UI / corps** : `Public Sans`, weights 400/500/600/700/800.
- Chiffres de stats et donut : `Spectral` 600.
- Identifiants dossier (D-0001) : `ui-monospace, Menlo, monospace`, 11px.
- Tailles clés : H1 34–38px (letter-spacing -.4/-.5px) ; titres de carte 16px/700 ; corps 14–15px ;
  labels/méta 12–13px ; eyebrow 11px/700 letter-spacing .1em.

### Rayons & ombres
- Rayon cartes : `16px` · champs/boutons : `11px` · petites tuiles : `9–12px` · pastilles : `20px`.
- Ombre carte : `0 1px 2px rgba(20,33,28,.04)`.
- Ombre CTA vert : `0 2px 8px rgba(14,59,46,.25)`.
- Ombre survol carte grille : `0 6px 18px rgba(20,33,28,.08)`.

### Espacements
- Contenu principal : padding `34px 40px 48px`, max-width `1320px` (Uploader `960px`).
- Gap grille stats/cartes : `18px` · gap toolbar : `12px`.
- Sidebar largeur `270px` · topbar hauteur `64px`.

### Animations
- Entrée d'écran : `fadeUp .35s ease` (`opacity 0→1`, `translateY(8px)→0`).
- Chevron dossier : `transform .2s` (`rotate(0)`→`rotate(90deg)` à l'ouverture).
- Survols : `background .15s`.

---

## Coquille applicative (présente sur tous les écrans)

### Sidebar (270px, dégradé vert vertical)
- Overlay radial doré discret en haut à droite : `radial-gradient(120% 40% at 100% 0%, rgba(228,180,41,.10), transparent 60%)`.
- **Marque** : logo PMN dans une pastille blanche 46px (rayon 12px, ombre), titre `Archive PMN` (Spectral 600, 19px),
  sous-titre `Plateforme numérique` (or `#E4B429`, 11.5px/600).
- **Nav** : intitulé de section `MENU PRINCIPAL` puis items : Tableau de bord, Documents, Uploader, Messages,
  Partages, Demandes d'accès (badge or « 1 »). Section `ADMINISTRATION` : Administration, Gestion Utilisateurs.
  Chaque item : icône 19px (stroke 1.9), padding `11px 13px`, rayon 11px.
- **Pied** : avatar dégradé or `HS`, nom `Harouna Sylla`, rôle `Super Administrateur`, bouton déconnexion.

### Barre supérieure (64px, blanc translucide + blur)
- Fil d'Ariane à gauche : `Espace de travail › <écran courant>`.
- À droite : bouton cloche (point or de notification) + séparateur + avatar rond dégradé vert `HS`.

---

## Écrans

### 1. Tableau de bord
- Eyebrow `VUE D'ENSEMBLE` (pastille verte pâle), H1 `Tableau de bord`, sous-titre `Bienvenue, Harouna Sylla`.
- **4 cartes stats** (grille 4 col, gap 18px) : Documents `3 894` (+128 ce mois), Partages `0`, Messages non lus `0`,
  Utilisateurs actifs `1` (point vert « En ligne maintenant »). Chaque carte : valeur Spectral 34px, tuile icône 44px
  (vert ou or selon l'item), pied de carte avec micro-tendance.
- **Ligne graphes** (grille 1.7fr / 1fr) :
  - *Activité récente (7 jours)* : histogramme, valeurs `[0,0,0,0,6,0,0]` sur labels `02/07…08/07`, axes pointillés,
    barres dégradé vert (`#1F8A63→#15654B`), légende (Documents ajoutés = vert, Partages effectués = or).
  - *Répartition par catégorie* : donut `conic-gradient` (Administration 62% `#15654B`, Comptabilité 20% `#E4B429`,
    Courrier 12% `#1F8A63`, Marchés 6% `#C7961A`), centre blanc `3 894 documents`, légende détaillée.
- **Derniers documents ajoutés** : liste (icône doc, nom, dossier parent, pastille catégorie or, date), lien « Tout voir » → Documents.

### 2. Documents (arborescence) — écran principal
- H1 `Arborescence des documents`, sous-titre `Organisez vos documents en dossiers et sous-dossiers`.
- **Toolbar** (carte) : champ recherche (fond `#F6F5F0`, icône loupe), sélecteur `Toutes catégories`,
  bouton secondaire `Nouveau dossier` (contour vert), bascule vue **liste/grille** (segment actif = fond blanc, icône verte),
  CTA primaire `Nouveau document` (dégradé vert + ombre).
- **Vue liste** : lignes pliables. Chaque ligne = poignée drag (6 points), chevron (visible si enfants, rotation à l'ouverture),
  **icône dossier = image dorée `folder.png` 36px** (fichiers = icône doc verte 18px dans tuile grise), badge ID monospace
  (`D-0282`…), nom (14.5px/600), date (12px atténué), pastille `Archivé` (or : texte `#B8871A`, fond `rgba(228,180,41,.14)`,
  bordure `rgba(228,180,41,.3)`), bouton kebab. Indentation enfants = `depth × 26px`. Densité réglable (padding vertical `15px`
  confortable / `9px` compact).
- **Vue grille** : cartes dossier (auto-fill minmax 230px) avec **icône dorée `folder.png` 48px**, pastille Archivé,
  badge ID, nom, méta `date · N éléments`. Survol : bordure verte + ombre.
- **Arborescence de démo** (à remplacer par les vraies données) :
  - D-0282 Archives → (Rapports annuels, Note de service 2025.pdf)
  - D-0160 Dossier Passation des marchés → (Appels d'offres, PV attribution.pdf)
  - D-0223 PMN COMPTABILITE 2024 → (Grand livre.xlsx)
  - D-0001 archive courrier 2025 *(ouvert par défaut)* → COURRIER 2024 (Courrier arrivée.pdf, Courrier départ.pdf), COURRIER 2025

### 3. Uploader (max-width 960px)
- H1 `Uploader des documents`, sous-titre.
- **Zone de dépôt** : bordure pointillée verte, fond dégradé très pâle vert/or, tuile icône upload 72px,
  titre `Glissez vos fichiers ici`, aide `PDF, Word, Excel, images (max 50 Mo)`, CTA `Parcourir les fichiers`.
- **2 sélecteurs** : Catégorie (`Administration`), Dossier de destination (`archive courrier 2025`).
- **Fichiers en cours** : liste avec badge extension coloré (PDF rouge, XLS vert, DOC bleu), nom, taille,
  **barre de progression** (dégradé vert) + pourcentage (100% / 72% / 38%).

### 4. Messages (2 colonnes, pleine hauteur)
- **Colonne gauche (340px)** : H1 `Messages`, champ recherche, liste de conversations. Chaque item : avatar rond initiales
  (couleur par service), nom, aperçu, heure, point or si non lu. Item actif = fond `rgba(21,101,75,.08)`.
- **Colonne droite (fil)** : en-tête (avatar, nom, statut vert « en ligne », bouton recherche), zone de bulles
  (séparateur `Aujourd'hui`), bulles **reçues** = blanc / **envoyées** = dégradé vert (rayons asymétriques, heure en pied),
  **composeur** : bouton trombone, champ texte, bouton envoi (dégradé vert, icône avion).
- Conversations de démo : Direction Générale, Service Comptabilité, Bureau du Courrier, Affaires Juridiques, Ressources Humaines.

---

## Interactions & comportement
- **Navigation** : clic sur item de sidebar → change l'écran actif, met à jour le fil d'Ariane, remonte le scroll.
- **Arborescence** : clic chevron/dossier → plie/déplie (rotation chevron, insertion des enfants indentés).
- **Bascule liste/grille** : met à jour l'affichage et l'état actif du segment.
- **Messages** : clic conversation → charge le fil correspondant, met en surbrillance l'item.
- **Options de style** (exposées comme réglages runtime dans le prototype, à traiter comme préférences/props) :
  `titleStyle` (serif|sans, défaut **sans**), `density` (comfortable|compact, défaut **compact**),
  `showFolderId` (bool, défaut true) qui masque/affiche les badges `D-xxxx`.

## Gestion d'état (côté app cible)
- `screen` : écran actif (dashboard | documents | upload | messages | shares | access | admin | users).
- `expanded` : map des dossiers ouverts dans l'arborescence.
- `view` : liste | grille.
- `activeThread` : index de la conversation sélectionnée.
- Données à connecter au back : liste documents/dossiers (arborescence), stats du dashboard, activité 7 jours,
  répartition catégories, fichiers en upload (+ progression réelle), conversations & messages.

## Assets
- `assets/pmn-logo.png` — logo du Projet Mobilier National (fourni par le client).
- `assets/folder.png` — icône dossier dorée (fournie par le client) utilisée pour tous les dossiers en liste et grille.
- Toutes les autres icônes sont des SVG inline (stroke `currentColor`, largeur 1.7–2). Remplacer par la librairie d'icônes
  du codebase (ex. lucide-react — les tracés utilisés correspondent à Lucide).
- Polices : Google Fonts `Spectral` et `Public Sans`.

## Fichiers de ce paquet
- `Archive PMN.dc.html` — prototype complet (référence visuelle et comportementale).
- `assets/pmn-logo.png`, `assets/folder.png` — images à réutiliser.
- `screenshots/` — captures HD des 4 écrans :
  - `01-tableau-de-bord.png`
  - `02-documents.png`
  - `03-uploader.png`
  - `04-messages.png`
