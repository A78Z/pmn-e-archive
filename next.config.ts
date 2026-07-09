import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  poweredByHeader: false,

  // Dossier de sortie configurable via NEXT_DIST_DIR.
  // Par défaut ".next" (utilisé par `next dev` et par Vercel en prod).
  // Un build de VÉRIFICATION doit écrire ailleurs (ex. `.next-verify`) pour
  // ne JAMAIS écraser les chunks du serveur de dev en cours d'exécution
  // (cause des erreurs "ChunkLoadError" / "Cannot find module './N.js'").
  // Voir le script npm "verify:build".
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
