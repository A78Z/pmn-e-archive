/**
 * PLAN DE CLASSEMENT — Archive PMN (v1)
 *
 * Liste des rubriques normalisées { code, libellé } utilisées pour classer
 * dossiers et documents (champ optionnel `rubrique` = code de la rubrique).
 *
 * v1 : fichier de configuration éditable par les développeurs.
 * (Une administration des rubriques en base pourra remplacer ce fichier
 * plus tard sans changer les composants qui l'utilisent.)
 */

export interface ClassificationRubrique {
    code: string;
    label: string;
}

export const CLASSIFICATION_PLAN: ClassificationRubrique[] = [
    { code: 'ADM', label: 'Administration' },
    { code: 'CPT', label: 'Comptabilité' },
    { code: 'COU', label: 'Courrier' },
    { code: 'MAR', label: 'Commande publique / Marchés' },
    { code: 'RH', label: 'Ressources humaines' },
    { code: 'JUR', label: 'Affaires juridiques' },
    { code: 'FOR', label: 'Formation' },
    { code: 'ACQ', label: 'Acquisitions' },
];

/** Libellé complet d'une rubrique à partir de son code (ex. « MAR – Commande publique / Marchés »). */
export function rubriqueLabel(code?: string | null): string | null {
    if (!code) return null;
    const rubrique = CLASSIFICATION_PLAN.find(r => r.code === code);
    return rubrique ? `${rubrique.code} – ${rubrique.label}` : code;
}
