/**
 * Tokenisation de requête de recherche — Archive PMN
 *
 * Module PUR (utilisable côté client ET serveur) : découpe une requête en
 * langage naturel en mots-clés significatifs, en retirant les mots vides
 * français courants, pour qu'une phrase ne renvoie plus 0 résultat.
 *
 * Ex. : « chercher moi la facture prestataire » → ['facture', 'prestataire']
 */

/** Mots vides français ignorés lors de la recherche (bruit). */
export const FR_STOPWORDS = new Set([
    // articles / déterminants
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux', 'ce', 'ces',
    'cet', 'cette', 'ma', 'mon', 'mes', 'sa', 'son', 'ses', 'ta', 'ton', 'tes',
    'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
    // prépositions / conjonctions
    'et', 'ou', 'ni', 'mais', 'donc', 'or', 'car', 'en', 'dans', 'sur', 'sous',
    'pour', 'par', 'avec', 'sans', 'chez', 'vers', 'entre', 'depuis', 'pendant',
    'a', 'à',
    // pronoms
    'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'moi', 'toi',
    'lui', 'me', 'te', 'se', 'y',
    // interrogatifs / relatifs
    'qui', 'que', 'quoi', 'dont', 'ou', 'quel', 'quelle', 'quels', 'quelles',
    'comment', 'quand', 'combien',
    // verbes de recherche courants (bruit dans une requête)
    'chercher', 'cherche', 'cherches', 'trouver', 'trouve', 'trouves', 'montrer',
    'montre', 'montres', 'afficher', 'affiche', 'affiches', 'voir', 'lister',
    'liste', 'recherche', 'rechercher', 'donne', 'donner', 'obtenir',
    // termes génériques du domaine (n'aident pas à discriminer)
    'document', 'documents', 'dossier', 'dossiers', 'fichier', 'fichiers',
    'archive', 'archives',
    // divers
    'est', 'sont', 'etre', 'être', 'avoir', 'tous', 'tout', 'toute', 'toutes',
    'plus', 'moins', 'tres', 'très', 'aussi', 'meme', 'même', 'fait', 'faire',
    's', 'l', 'd', 'c', 'n', 'j', 'm', 't', 'qu',
]);

/** Minuscule + suppression des accents (comparaison robuste). */
export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

/**
 * Découpe une requête en tokens significatifs (≥ 2 caractères, hors mots vides).
 * Retourne un tableau éventuellement vide.
 */
export function tokenizeQuery(query: string): string[] {
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const raw of normalizeText(query).split(/[^a-z0-9-]+/)) {
        if (raw.length >= 2 && !FR_STOPWORDS.has(raw) && !seen.has(raw)) {
            seen.add(raw);
            tokens.push(raw);
        }
    }
    return tokens;
}
