/* ══════════════════════════════════════════════════════════════
   WEBTOON STUDIO — config.js
   ⚠️  CE FICHIER NE DOIT PAS ÊTRE PARTAGÉ NI COMMITÉ SUR GIT
   Ajoute "config.js" dans ton .gitignore si tu utilises Git.
   ══════════════════════════════════════════════════════════════

   ── COMMENT CHANGER TON MOT DE PASSE ──────────────────────────
   1. Ouvre ton navigateur
   2. Appuie sur F12 → onglet "Console"
   3. Colle cette commande avec TON mot de passe :

      crypto.subtle.digest('SHA-256', new TextEncoder().encode('TON_MOT_DE_PASSE'))
        .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))

   4. Copie le résultat (longue chaîne de lettres/chiffres)
   5. Remplace la valeur de PASSWORD_HASH ci-dessous
   ────────────────────────────────────────────────────────────── */

const CONFIG = {

  // ── MOT DE PASSE ──────────────────────────────────────────────
  // Hash SHA-256 du mot de passe (mot de passe actuel : WebtoonStudio2025)
  // Remplace cette valeur par le hash de ton propre mot de passe.
  PASSWORD_HASH: '55ba43ab05dd8b83027761adff561ad8e4f2ca4790d315e038ab55b83f39186d',

  // ── SUPABASE ──────────────────────────────────────────────────
  // Renseigne ces deux valeurs depuis ton dashboard Supabase :
  // https://app.supabase.com → Settings → API
  SUPABASE_URL:  'https://rlspxgjjrnxwxydufep.supabase.co',
  SUPABASE_KEY:  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3B4Z2pqcnlueHd4eWR1ZmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDI2ODAsImV4cCI6MjA4Nzg3ODY4MH0.Lr-mtfvUclaBMlk1NFQFikHbrrxwHLExZMHw37aMPgY',
  STORAGE_BUCKET: 'webtoon-images',  // nom du bucket à créer dans Supabase Storage

}

// Ne pas modifier ci-dessous
if (typeof window !== 'undefined') window.__WS_CONFIG = CONFIG
