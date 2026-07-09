# Back4App Configuration
# Remplacez ces valeurs par vos clés Back4App réelles

NEXT_PUBLIC_PARSE_APP_ID=your_app_id_here
NEXT_PUBLIC_PARSE_JS_KEY=your_javascript_key_here
NEXT_PUBLIC_PARSE_SERVER_URL=https://parseapi.back4app.com

# Pour les opérations admin (optionnel, à utiliser côté serveur uniquement)
# PARSE_MASTER_KEY=your_master_key_here

# Recherche intelligente (IA) — CLÉ SERVEUR UNIQUEMENT
# ⚠️ JAMAIS de préfixe NEXT_PUBLIC_ (une clé exposée au navigateur = clé volée)
# En local : .env.local · En prod : Vercel → Settings → Environment Variables (Production)
# Obtenir une clé : https://console.anthropic.com/
# ANTHROPIC_API_KEY=sk-ant-...

# Envoi des accès utilisateurs par E-MAIL (Resend) — CLÉ SERVEUR UNIQUEMENT
# ⚠️ JAMAIS NEXT_PUBLIC_. Obtenir : https://resend.com/
# RESEND_API_KEY=re_...
# RESEND_FROM_EMAIL=Archive PMN <no-reply@votre-domaine.sn>

# Envoi des accès par SMS (OPTIONNEL) — passerelle HTTP générique, CLÉ SERVEUR UNIQUEMENT
# Si non renseigné, l'option SMS est automatiquement désactivée dans l'interface.
# La passerelle doit accepter POST JSON { to, from, message } avec Authorization: Bearer <clé>
# SMS_API_URL=https://api.votre-passerelle-sms.com/send
# SMS_API_KEY=...
# SMS_SENDER=ArchivePMN

# URL publique du site (liens dans les e-mails)
# NEXT_PUBLIC_SITE_URL=https://pmn-e-archive.vercel.app
