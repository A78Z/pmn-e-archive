/**
 * Catégories officielles E-ARCHIVE-PMN
 * Liste complète et définitive des catégories de documents
 */

export const OFFICIAL_CATEGORIES = [
    'Archives',
    'Administration',
    'Comptabilité',
    'Ressources Humaines',
    'Logistique',
    'Communication',
    'Planification / Suivi-Évaluation',
    'Procédures & Marchés Publics',
    'Rapports & Études',
    'Correspondances',
    'Documents Techniques',
    'Partenariats',
    'Ateliers & Formations',
    'Patrimoine / Inventaire',
    'Photos & Multimédia',
    'Autres Documents'
] as const;

export type Category = typeof OFFICIAL_CATEGORIES[number];

/**
 * Couleurs associées aux catégories (pour badges et affichage)
 */
export const CATEGORY_COLORS: Record<string, string> = {
    'Archives': 'bg-purple-100 text-purple-800 border-purple-200',
    'Administration': 'bg-blue-100 text-blue-800 border-blue-200',
    'Comptabilité': 'bg-green-100 text-green-800 border-green-200',
    'Ressources Humaines': 'bg-pink-100 text-pink-800 border-pink-200',
    'Logistique': 'bg-orange-100 text-orange-800 border-orange-200',
    'Communication': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Planification / Suivi-Évaluation': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Procédures & Marchés Publics': 'bg-violet-100 text-violet-800 border-violet-200',
    'Rapports & Études': 'bg-teal-100 text-teal-800 border-teal-200',
    'Correspondances': 'bg-amber-100 text-amber-800 border-amber-200',
    'Documents Techniques': 'bg-lime-100 text-lime-800 border-lime-200',
    'Partenariats': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Ateliers & Formations': 'bg-rose-100 text-rose-800 border-rose-200',
    'Patrimoine / Inventaire': 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
    'Photos & Multimédia': 'bg-sky-100 text-sky-800 border-sky-200',
    'Autres Documents': 'bg-gray-100 text-gray-800 border-gray-200',
};
