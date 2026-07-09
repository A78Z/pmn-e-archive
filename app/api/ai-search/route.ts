/**
 * ROUTE SERVEUR — Recherche intelligente (langage naturel) — Archive PMN
 *
 * POST /api/ai-search  { query: string }
 *
 * Pipeline :
 *   1. Catalogue de MÉTADONNÉES (jamais de contenu binaire) depuis Back4App
 *      (REST, clé JS) — mis en cache mémoire 5 minutes.
 *   2. Pré-filtrage serveur → liste courte (~80 candidats max) par
 *      correspondance mots-clés (maîtrise des coûts de tokens).
 *   3. Appel Anthropic (claude-haiku-4-5) → classement JSON strict.
 *   4. Parsing défensif + enrichissement (chemin complet) + rate limiting.
 *
 * 🔐 SÉCURITÉ : ANTHROPIC_API_KEY est lue UNIQUEMENT ici (côté serveur).
 * Jamais de variante NEXT_PUBLIC_. En local : .env.local ; en prod :
 * Vercel → Settings → Environment Variables (Production).
 */

import { NextRequest, NextResponse } from 'next/server';
import { tokenizeQuery, normalizeText } from '@/lib/search-tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PARSE_SERVER_URL = process.env.NEXT_PUBLIC_PARSE_SERVER_URL || 'https://parseapi.back4app.com';
const PARSE_APP_ID = process.env.NEXT_PUBLIC_PARSE_APP_ID || '';
const PARSE_JS_KEY = process.env.NEXT_PUBLIC_PARSE_JS_KEY || '';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const MAX_CANDIDATES = 80;
const CATALOG_TTL_MS = 5 * 60 * 1000; // cache mémoire 5 min

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CatalogItem {
    objectId: string;
    type: 'dossier' | 'document';
    name: string;
    folder_number?: string;
    category?: string;
    rubrique?: string;
    mots_cles?: string[];
    exercice?: string;
    /** id du dossier contenant (documents) ou parent (dossiers) */
    parentId?: string | null;
    /** Chemin lisible : « A > B > C » */
    path: string;
    createdAt?: string;
}

// ---------------------------------------------------------------------------
// Catalogue Back4App (métadonnées uniquement) + cache mémoire
// ---------------------------------------------------------------------------
let catalogCache: { items: CatalogItem[]; at: number } | null = null;

async function parseRest(className: string, params: Record<string, string>): Promise<any[]> {
    const search = new URLSearchParams(params).toString();
    const res = await fetch(`${PARSE_SERVER_URL}/classes/${className}?${search}`, {
        headers: {
            'X-Parse-Application-Id': PARSE_APP_ID,
            'X-Parse-Javascript-Key': PARSE_JS_KEY,
        },
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Back4App ${className} HTTP ${res.status}`);
    const json = await res.json();
    return json.results || [];
}

async function fetchAllPaginated(className: string, keys: string): Promise<any[]> {
    const all: any[] = [];
    let skip = 0;
    for (;;) {
        const page = await parseRest(className, {
            keys,
            limit: '1000',
            skip: String(skip),
            order: 'objectId',
        });
        all.push(...page);
        if (page.length < 1000) break;
        skip += 1000;
    }
    return all;
}

async function getCatalog(): Promise<CatalogItem[]> {
    if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
        return catalogCache.items;
    }

    const [folders, documents] = await Promise.all([
        fetchAllPaginated('Folder', 'name,folder_number,category,rubrique,mots_cles,exercice,parent_id,createdAt'),
        fetchAllPaginated('Document', 'name,category,rubrique,mots_cles,exercice,folder_id,createdAt'),
    ]);

    // Chemins : index des dossiers
    const folderById = new Map<string, any>(folders.map(f => [f.objectId, f]));
    const pathOf = (folderId: string | null | undefined): string => {
        const parts: string[] = [];
        let current = folderId ? folderById.get(folderId) : null;
        let guard = 0;
        while (current && guard < 30) {
            parts.unshift(current.name);
            current = current.parent_id ? folderById.get(current.parent_id) : null;
            guard++;
        }
        return parts.join(' > ') || 'Racine';
    };

    const items: CatalogItem[] = [
        ...folders.map((f): CatalogItem => ({
            objectId: f.objectId,
            type: 'dossier',
            name: f.name || '',
            folder_number: f.folder_number,
            category: f.category,
            rubrique: f.rubrique,
            mots_cles: f.mots_cles,
            exercice: f.exercice != null ? String(f.exercice) : undefined,
            parentId: f.parent_id ?? null,
            path: pathOf(f.parent_id),
            createdAt: f.createdAt,
        })),
        ...documents.map((d): CatalogItem => ({
            objectId: d.objectId,
            type: 'document',
            name: d.name || '',
            category: d.category,
            rubrique: d.rubrique,
            mots_cles: d.mots_cles,
            exercice: d.exercice != null ? String(d.exercice) : undefined,
            parentId: d.folder_id ?? null,
            path: pathOf(d.folder_id),
            createdAt: d.createdAt,
        })),
    ];

    catalogCache = { items, at: Date.now() };
    return items;
}

// ---------------------------------------------------------------------------
// Pré-filtrage serveur → liste courte (maîtrise des coûts de tokens)
// Tokenisation partagée avec la recherche classique (lib/search-tokens).
// ---------------------------------------------------------------------------
const normalize = normalizeText;

function scoreItem(item: CatalogItem, tokens: string[]): number {
    const haystacks: Array<[string, number]> = [
        [normalize(item.name), 5],
        [normalize(item.folder_number || ''), 5],
        [normalize((item.mots_cles || []).join(' ')), 4],
        [normalize(item.rubrique || ''), 3],
        [normalize(item.category || ''), 3],
        [normalize(item.exercice || ''), 3],
        [normalize(item.path), 2],
    ];
    let score = 0;
    for (const token of tokens) {
        for (const [hay, weight] of haystacks) {
            if (hay.includes(token)) score += weight;
        }
    }
    // léger bonus aux dossiers (points d'entrée de navigation)
    if (score > 0 && item.type === 'dossier') score += 1;
    return score;
}

function shortlist(catalog: CatalogItem[], query: string): CatalogItem[] {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) return [];

    const scored = catalog
        .map(item => ({ item, score: scoreItem(item, tokens) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score);

    let candidates = scored.slice(0, MAX_CANDIDATES).map(x => x.item);

    // Si trop peu de correspondances lexicales, élargir avec des DOSSIERS
    // (le modèle peut faire le lien sémantique : « factures » → Comptabilité)
    if (candidates.length < 25) {
        const seen = new Set(candidates.map(c => c.objectId));
        const extraFolders = catalog
            .filter(i => i.type === 'dossier' && !seen.has(i.objectId))
            .slice(0, MAX_CANDIDATES - candidates.length);
        candidates = [...candidates, ...extraFolders];
    }
    return candidates;
}

// ---------------------------------------------------------------------------
// Catégorisation des erreurs (jamais de secret exposé/journalisé)
// ---------------------------------------------------------------------------
type AiReason =
    | 'ok'
    | 'missing_key'   // clé absente de l'environnement
    | 'auth'          // 401/403 : clé invalide / révoquée
    | 'billing'       // 400 crédits insuffisants / facturation
    | 'model'         // 404 : modèle inconnu
    | 'rate_limit'    // 429
    | 'network'       // réseau / timeout
    | 'bad_response'  // réponse non conforme (JSON invalide)
    | 'unknown';

/** Erreur typée transportant une catégorie (jamais la clé). */
class AiError extends Error {
    reason: AiReason;
    constructor(reason: AiReason, detail: string) {
        super(detail);
        this.reason = reason;
    }
}

/** Catégorise un échec HTTP Anthropic à partir du statut + message d'erreur. */
function categorizeHttp(status: number, message: string): AiReason {
    const m = (message || '').toLowerCase();
    if (status === 401 || status === 403) return 'auth';
    if (status === 429) return 'rate_limit';
    if (status === 404) return 'model';
    if (status === 400) {
        if (m.includes('credit') || m.includes('billing') || m.includes('balance') || m.includes('quota')) {
            return 'billing';
        }
        if (m.includes('model')) return 'model';
        return 'unknown';
    }
    if (status >= 500) return 'unknown';
    return 'unknown';
}

/** Messages utilisateur (sobres) associés à chaque catégorie. */
const REASON_MESSAGES: Record<AiReason, string> = {
    ok: 'OK',
    missing_key: "La recherche IA n'est pas configurée (clé API absente côté serveur).",
    auth: "La recherche IA est indisponible (clé API invalide).",
    billing: "La recherche IA est indisponible (crédits API épuisés).",
    model: "La recherche IA est indisponible (modèle non disponible).",
    rate_limit: "La recherche IA est temporairement surchargée. Réessayez dans un instant.",
    network: "La recherche IA est momentanément injoignable.",
    bad_response: "La recherche IA a renvoyé une réponse inattendue.",
    unknown: "L'assistant IA est momentanément indisponible.",
};

/**
 * Appel minimal à l'API (max_tokens: 1) pour l'endpoint de santé.
 * Retourne une catégorie ; ne lève jamais, n'expose jamais la clé.
 */
async function anthropicPing(): Promise<AiReason> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return 'missing_key';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 1,
                messages: [{ role: 'user', content: 'ping' }],
            }),
            signal: controller.signal,
        });
        if (res.ok) return 'ok';
        let message = '';
        try {
            const body = await res.json();
            message = body?.error?.message || '';
        } catch {
            /* ignore */
        }
        const reason = categorizeHttp(res.status, message);
        console.error(`[ai-search:health] appel test échoué — status=${res.status} reason=${reason} message="${message.slice(0, 160)}"`);
        return reason;
    } catch (e: any) {
        console.error('[ai-search:health] erreur réseau/timeout:', e?.name || e?.message);
        return 'network';
    } finally {
        clearTimeout(timeout);
    }
}

// ---------------------------------------------------------------------------
// Appel Anthropic (JSON strict) + parsing défensif
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT =
    "Tu es un assistant d'archives du Mobilier National. À partir de la requête de " +
    "l'utilisateur et de la liste de dossiers/documents (métadonnées), renvoie " +
    "uniquement les éléments pertinents, classés du plus au moins pertinent, avec " +
    "une raison courte en français. Réponds en JSON strict, sans texte autour, au " +
    'format : {"results":[{"objectId":"...","type":"dossier|document","raison":"..."}],' +
    '"reponse":"phrase de synthèse optionnelle"}';

function candidateLine(item: CatalogItem): string {
    const fields = [
        item.objectId,
        item.type,
        item.name,
        item.folder_number || '',
        item.category || '',
        item.rubrique || '',
        (item.mots_cles || []).join(','),
        item.exercice || '',
        item.path,
    ];
    return fields.join(' | ');
}

async function callAnthropic(query: string, candidates: CatalogItem[]): Promise<{ results: any[]; reponse?: string }> {
    // 1. Vérifier la présence de la clé EN PREMIER (pas d'appel réseau inutile)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error("[ai-search] ANTHROPIC_API_KEY manquante dans l'environnement");
        throw new AiError('missing_key', 'ANTHROPIC_API_KEY absente');
    }

    const userContent =
        `Requête de l'utilisateur : « ${query} »\n\n` +
        `Liste des candidats (format : objectId | type | nom | cote | catégorie | rubrique | mots-clés | exercice | chemin) :\n` +
        candidates.map(candidateLine).join('\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    // 2. Appel réseau — les erreurs réseau/timeout sont catégorisées 'network'
    let res: Response;
    try {
        res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 1500,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userContent }],
            }),
            signal: controller.signal,
        });
    } catch (e: any) {
        clearTimeout(timeout);
        console.error('[ai-search] erreur réseau/timeout:', e?.name || e?.message);
        throw new AiError('network', e?.name || 'network error');
    }
    clearTimeout(timeout);

    // 3. Erreur HTTP → catégorisée (auth / billing / model / rate_limit / unknown)
    if (!res.ok) {
        let message = '';
        try {
            const body = await res.json();
            message = body?.error?.message || '';
        } catch {
            /* réponse non JSON */
        }
        const reason = categorizeHttp(res.status, message);
        // Journalisation détaillée côté serveur (message SANS la clé)
        console.error(`[ai-search] appel API échoué — status=${res.status} reason=${reason} message="${message.slice(0, 200)}"`);
        throw new AiError(reason, `HTTP ${res.status}`);
    }

    // 4. Parsing défensif de la réponse JSON
    try {
        const data = await res.json();
        let text: string = data?.content?.[0]?.text ?? '';
        text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            text = text.slice(firstBrace, lastBrace + 1);
        }
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed.results)) {
            throw new Error('champ results manquant');
        }
        return parsed;
    } catch (e: any) {
        console.error('[ai-search] réponse IA non conforme:', e?.message);
        throw new AiError('bad_response', e?.message || 'réponse invalide');
    }
}

// ---------------------------------------------------------------------------
// Rate limiting simple (par IP, en mémoire)
// ---------------------------------------------------------------------------
const RATE_LIMIT = 10;            // requêtes max
const RATE_WINDOW_MS = 60 * 1000; // par minute
const rateBuckets = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const bucket = (rateBuckets.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
    if (bucket.length >= RATE_LIMIT) {
        rateBuckets.set(ip, bucket);
        return true;
    }
    bucket.push(now);
    rateBuckets.set(ip, bucket);
    return false;
}

// ---------------------------------------------------------------------------
// Handler POST
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
        if (isRateLimited(ip)) {
            return NextResponse.json(
                { error: 'Trop de requêtes. Réessayez dans une minute.', fallback: false },
                { status: 429 }
            );
        }

        const body = await req.json().catch(() => null);
        const query = typeof body?.query === 'string' ? body.query.trim() : '';
        if (!query || query.length < 3) {
            return NextResponse.json(
                { error: 'Requête trop courte (3 caractères minimum).', fallback: false },
                { status: 400 }
            );
        }
        if (query.length > 500) {
            return NextResponse.json(
                { error: 'Requête trop longue (500 caractères maximum).', fallback: false },
                { status: 400 }
            );
        }

        // 1-2. Catalogue (cache) + liste courte
        const catalog = await getCatalog();
        const candidates = shortlist(catalog, query);

        if (candidates.length === 0) {
            return NextResponse.json({
                results: [],
                reponse: `Aucun élément des archives ne correspond aux termes de « ${query} ».`,
            });
        }

        // 3. Classement par le modèle
        const ai = await callAnthropic(query, candidates);

        // 4. Enrichissement : ne garder que des objectIds réellement candidats
        const byId = new Map(candidates.map(c => [c.objectId, c]));
        const results = (ai.results || [])
            .filter((r: any) => r && byId.has(r.objectId))
            .slice(0, 30)
            .map((r: any) => {
                const item = byId.get(r.objectId)!;
                return {
                    objectId: item.objectId,
                    type: item.type,
                    name: item.name,
                    folder_number: item.folder_number || null,
                    category: item.category || null,
                    rubrique: item.rubrique || null,
                    exercice: item.exercice || null,
                    path: item.path,
                    parentId: item.parentId ?? null,
                    createdAt: item.createdAt || null,
                    raison: typeof r.raison === 'string' ? r.raison.slice(0, 300) : '',
                };
            });

        return NextResponse.json({
            ok: true,
            results,
            reponse: typeof ai.reponse === 'string' ? ai.reponse.slice(0, 600) : undefined,
        });
    } catch (error: any) {
        // Erreurs catégorisées (jamais la clé exposée ni journalisée en clair)
        const reason: AiReason = error instanceof AiError ? error.reason : 'unknown';
        if (!(error instanceof AiError)) {
            console.error('[ai-search] erreur inattendue:', error?.message || error);
        }

        // Le statut HTTP reflète la catégorie ; le client bascule sur la
        // recherche classique dans tous les cas (fallback: true).
        const status =
            reason === 'missing_key' ? 503 :
            reason === 'rate_limit' ? 429 :
            reason === 'auth' || reason === 'billing' || reason === 'model' ? 503 :
            502;

        return NextResponse.json(
            {
                ok: false,
                reason,
                error: REASON_MESSAGES[reason],
                fallback: true,
            },
            { status }
        );
    }
}

// ---------------------------------------------------------------------------
// Handler GET — endpoint de santé (aucun secret exposé)
// Ouvrir /api/ai-search dans le navigateur → { keyPresent, testCall }
// ---------------------------------------------------------------------------
export async function GET() {
    const keyPresent = Boolean(process.env.ANTHROPIC_API_KEY);
    if (!keyPresent) {
        return NextResponse.json({ keyPresent: false, testCall: 'missing_key' as AiReason });
    }
    const testCall = await anthropicPing();
    return NextResponse.json({ keyPresent: true, testCall });
}
