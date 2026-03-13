# ◈ Webtoon Studio

Éditeur de webtoon en ligne — interface visuelle pour créer des planches avec bulles, images, flèches et typographies BD.

---

## 📁 Structure du projet

```
webtoon-studio/
├── index.html       ✅ À mettre sur GitHub
├── style.css        ✅ À mettre sur GitHub
├── script.js        ✅ À mettre sur GitHub
├── .gitignore       ✅ À mettre sur GitHub
├── README.md        ✅ À mettre sur GitHub
└── config.js        ❌ NE PAS mettre sur GitHub — contient le mot de passe
```

---

## 🚀 Déploiement — étape par étape

### Étape 1 — Préparer GitHub

1. Va sur [github.com](https://github.com) et connecte-toi
2. Clique sur **"New repository"** (bouton vert)
3. Donne un nom : `webtoon-studio`
4. Laisse le dépôt en **Public** ou **Private** (au choix)
5. Clique **"Create repository"**

**Ajoute tes fichiers :**
- Clique sur **"uploading an existing file"**
- Glisse-dépose ces fichiers uniquement :
  - `index.html`
  - `style.css`
  - `script.js`
  - `.gitignore`
  - `README.md`
- ⚠️ **Ne jamais uploader `config.js`**
- Clique **"Commit changes"**

---

### Étape 2 — Déployer sur Netlify

1. Va sur [netlify.com](https://netlify.com) et connecte-toi avec GitHub
2. Clique **"Add new site"** → **"Import an existing project"**
3. Choisis **GitHub** → sélectionne ton dépôt `webtoon-studio`
4. Laisse tous les paramètres par défaut (pas de build command)
5. Clique **"Deploy site"**

✅ Ton site est en ligne ! Mais il manque encore `config.js`...

---

### Étape 3 — Ajouter config.js sur Netlify (sans passer par GitHub)

C'est l'étape clé pour que le mot de passe fonctionne sans jamais apparaître sur GitHub.

**Méthode — via Netlify CLI (recommandée) :**

1. Installe Netlify CLI sur ton ordinateur :
   ```
   npm install -g netlify-cli
   ```
2. Dans le dossier de ton projet, connecte-toi :
   ```
   netlify login
   ```
3. Associe ton projet local au site Netlify :
   ```
   netlify link
   ```
4. Déploie `config.js` séparément :
   ```
   netlify deploy --dir=. --prod
   ```
   Quand il te demande les fichiers, inclus `config.js`

**Méthode alternative — drag & drop Netlify :**

1. Dans ton dashboard Netlify → ton site → onglet **"Deploys"**
2. Tout en bas, il y a une zone **"drag and drop your site folder here"**
3. Glisse-dépose le **dossier complet** de ton projet (avec `config.js` cette fois)
4. Netlify mettra à jour le site sans toucher à GitHub

---

### Étape 4 — Connecter Supabase (plus tard)

Quand tu seras prêt à connecter la base de données :

1. Va sur [supabase.com](https://supabase.com) → crée un projet
2. Dans **Settings → API**, copie :
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public key** → longue chaîne de caractères
3. Ouvre ton `config.js` et renseigne :
   ```js
   SUPABASE_URL:  'https://xxxxx.supabase.co',
   SUPABASE_KEY:  'ta_clé_anon_publique',
   ```
4. Dans **Storage**, crée un bucket nommé `webtoon-images` (public)
5. Re-déploie `config.js` sur Netlify via drag & drop

---

## 🔐 Changer le mot de passe

Le mot de passe actuel est : **`WebtoonStudio2025`**

Pour le changer :

1. Ouvre ton navigateur → F12 → onglet **Console**
2. Colle cette commande avec ton nouveau mot de passe :
   ```js
   crypto.subtle.digest('SHA-256', new TextEncoder().encode('NOUVEAU_MOT_DE_PASSE'))
     .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
   ```
3. Copie le résultat (longue chaîne de lettres et chiffres)
4. Dans `config.js`, remplace la valeur de `PASSWORD_HASH`
5. Re-déploie `config.js` sur Netlify

---

## ✨ Fonctionnalités

- 6 styles de bulles SVG avec queue rotative (8 directions)
- 3 styles de flèches de cheminement (droite, courbe, manga)
- 8 typographies BD open source (Bangers, Comic Neue, Caveat…)
- Undo / Redo (Ctrl+Z / Ctrl+Y)
- Grille magnétique avec snapping
- Export PNG et PDF
- Gestion multi-pages
- Sélection multiple par rectangle
- Panneau de propriétés contextuel
- Canvas extensible en hauteur
- Protection par mot de passe (hash SHA-256)
- Structure Supabase prête à brancher

---

## 📄 Licence

Projet personnel — tous droits réservés.
