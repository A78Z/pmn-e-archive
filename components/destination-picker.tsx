'use client';

/**
 * Sélecteur de dossier de destination — Archive PMN (Uploader)
 *
 * Remplace le menu déroulant plat (inutilisable à 490+ dossiers) par un
 * panneau scalable :
 *  - recherche instantanée par nom (requête Parse limitée + débouncée),
 *    chaque résultat affiché avec son chemin complet ;
 *  - navigation par arborescence à chargement PARESSEUX (racines puis
 *    enfants par niveau — jamais tout l'arbre) + fil d'Ariane ;
 *  - option « Racine (aucun dossier) » ;
 *  - destinations récentes (localStorage) ;
 *  - création inline d'un sous-dossier dans l'emplacement courant.
 *
 * Les chemins d'ancêtres sont résolus à la demande (getByIds, en cache),
 * sans charger l'intégralité des dossiers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Search,
    ChevronRight,
    Loader2,
    FolderPlus,
    Home,
    Check,
    Clock,
    CornerDownRight,
} from 'lucide-react';
import { FolderGlyph } from '@/components/pmn-icons';
import { FolderHelpers } from '@/lib/parse-helpers';
import { toast } from 'sonner';

const RECENTS_KEY = 'pmn_upload_recent_destinations';
const RECENTS_MAX = 5;

export interface RecentDestination {
    id: string; // '' = racine
    path: string;
}

interface FolderNode {
    id: string;
    name: string;
    parent_id?: string | null;
}

interface DestinationPickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Catégorie du formulaire (héritée à la création d'un sous-dossier) */
    category?: string;
    createdBy?: string;
    onSelect: (folderId: string | undefined, path: string) => void;
}

export function getRecentDestinations(): RecentDestination[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(RECENTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.slice(0, RECENTS_MAX) : [];
    } catch {
        return [];
    }
}

export function pushRecentDestination(dest: RecentDestination) {
    if (typeof window === 'undefined') return;
    try {
        const existing = getRecentDestinations().filter(d => d.id !== dest.id);
        const next = [dest, ...existing].slice(0, RECENTS_MAX);
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
        /* ignore */
    }
}

export function DestinationPicker({
    open,
    onOpenChange,
    category,
    createdBy,
    onSelect,
}: DestinationPickerProps) {
    // Recherche
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; path: string }> | null>(null);
    const [searching, setSearching] = useState(false);

    // Arborescence (chargement paresseux)
    const [navPath, setNavPath] = useState<FolderNode[]>([]);
    const [levelFolders, setLevelFolders] = useState<FolderNode[]>([]);
    const [levelLoading, setLevelLoading] = useState(false);

    // Création inline
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);

    const [recents, setRecents] = useState<RecentDestination[]>([]);

    // Cache de résolution des chemins (id → {name, parent_id})
    const pathCache = useRef<Map<string, FolderNode>>(new Map());

    const currentFolder = navPath.length ? navPath[navPath.length - 1] : null;
    const currentId = currentFolder?.id ?? null;

    // ----- Résolution de chemins (ancêtres à la demande, en cache) -----
    const ensureAncestors = useCallback(async (folders: FolderNode[]) => {
        folders.forEach(f => pathCache.current.set(f.id, { id: f.id, name: f.name, parent_id: f.parent_id ?? null }));
        const collectMissing = () => {
            const missing = new Set<string>();
            for (const [, v] of pathCache.current) {
                if (v.parent_id && !pathCache.current.has(v.parent_id)) missing.add(v.parent_id);
            }
            return missing;
        };
        let missing = collectMissing();
        let guard = 0;
        while (missing.size > 0 && guard < 12) {
            const fetched = await FolderHelpers.getByIds([...missing]);
            fetched.forEach((f: any) => pathCache.current.set(f.id, { id: f.id, name: f.name, parent_id: f.parent_id ?? null }));
            const next = collectMissing();
            // éviter une boucle si un parent est introuvable
            if ([...next].every(id => missing.has(id))) break;
            missing = next;
            guard++;
        }
    }, []);

    const pathOf = useCallback((id: string): string => {
        const parts: string[] = [];
        let cur = pathCache.current.get(id);
        let guard = 0;
        while (cur && guard < 20) {
            parts.unshift(cur.name);
            cur = cur.parent_id ? pathCache.current.get(cur.parent_id) : undefined;
            guard++;
        }
        return parts.join(' > ');
    }, []);

    // ----- Chargement d'un niveau de l'arbre -----
    const loadLevel = useCallback(async (parentId: string | null) => {
        setLevelLoading(true);
        try {
            const data = parentId
                ? await FolderHelpers.getSubFolders(parentId)
                : await FolderHelpers.getRootFolders();
            const nodes: FolderNode[] = (data as any[]).map(f => ({ id: f.id, name: f.name, parent_id: f.parent_id ?? null }));
            nodes.forEach(n => pathCache.current.set(n.id, n));
            setLevelFolders(nodes);
        } catch (e) {
            console.error('Erreur chargement niveau:', e);
            setLevelFolders([]);
        } finally {
            setLevelLoading(false);
        }
    }, []);

    // Ouverture : réinitialiser + charger racines + récents
    useEffect(() => {
        if (open) {
            setSearch('');
            setSearchResults(null);
            setNavPath([]);
            setCreating(false);
            setNewName('');
            setRecents(getRecentDestinations());
            loadLevel(null);
        }
    }, [open, loadLevel]);

    // Recherche débouncée (250 ms)
    useEffect(() => {
        const term = search.trim();
        if (term.length < 1) {
            setSearchResults(null);
            setSearching(false);
            return;
        }
        setSearching(true);
        const timer = setTimeout(async () => {
            try {
                const found = await FolderHelpers.searchByName(term, 30);
                const nodes: FolderNode[] = (found as any[]).map(f => ({ id: f.id, name: f.name, parent_id: f.parent_id ?? null }));
                await ensureAncestors(nodes);
                setSearchResults(nodes.map(n => ({ id: n.id, name: n.name, path: pathOf(n.id) })));
            } catch (e) {
                console.error('Erreur recherche dossiers:', e);
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [search, ensureAncestors, pathOf]);

    // ----- Actions -----
    const choose = (folderId: string | undefined, path: string) => {
        if (folderId) {
            pushRecentDestination({ id: folderId, path });
        }
        onSelect(folderId, path);
        onOpenChange(false);
    };

    const enterFolder = (node: FolderNode) => {
        setNavPath(prev => [...prev, node]);
        setCreating(false);
        loadLevel(node.id);
    };

    const navigateTo = (index: number) => {
        // index -1 = racine
        setCreating(false);
        if (index < 0) {
            setNavPath([]);
            loadLevel(null);
        } else {
            const target = navPath[index];
            setNavPath(prev => prev.slice(0, index + 1));
            loadLevel(target.id);
        }
    };

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name) {
            toast.error('Veuillez saisir un nom de dossier');
            return;
        }
        setSaving(true);
        try {
            const payload: Record<string, any> = {
                name,
                created_by: createdBy,
                status: 'Archive',
            };
            if (currentId) payload.parent_id = currentId;
            if (category) payload.category = category;

            const created: any = await FolderHelpers.create(payload);
            const node: FolderNode = { id: created.id, name: created.name, parent_id: currentId };
            pathCache.current.set(node.id, node);
            toast.success(`Dossier « ${name} » créé`);
            // Sélection automatique du nouveau dossier
            choose(created.id, pathOf(created.id));
        } catch (e: any) {
            console.error('Erreur création dossier:', e);
            toast.error(`Erreur lors de la création${e?.message ? ` : ${e.message}` : ''}`);
        } finally {
            setSaving(false);
        }
    };

    const isSearchMode = search.trim().length >= 1;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
                <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
                    <DialogTitle className="text-[17px] font-bold text-pmn-ink">Choisir la destination</DialogTitle>
                    <DialogDescription className="text-[12.5px]">
                        Recherchez un dossier ou naviguez dans l&apos;arborescence.
                    </DialogDescription>
                </DialogHeader>

                {/* Recherche */}
                <div className="border-b border-border px-6 py-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-pmn-faint" strokeWidth={2} />
                        <Input
                            placeholder="Rechercher un dossier par nom…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-11 rounded-[11px] border-[rgba(20,33,28,.07)] bg-[#F6F5F0] pl-10 text-sm"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2">
                    {/* ===== Racine (toujours en tête, hors recherche) ===== */}
                    {!isSearchMode && (
                        <button
                            type="button"
                            onClick={() => choose(undefined, 'Racine')}
                            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-pmn-hover"
                        >
                            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-pmn-green/[.08] text-pmn-green">
                                <Home className="h-4 w-4" />
                            </span>
                            <span className="flex-1 text-sm font-semibold text-pmn-ink">Racine (aucun dossier)</span>
                            <Check className="h-4 w-4 text-pmn-faint" />
                        </button>
                    )}

                    {/* ===== Résultats de recherche ===== */}
                    {isSearchMode ? (
                        <div className="py-1">
                            {searching ? (
                                <div className="flex items-center gap-2 px-3 py-6 text-sm text-pmn-faint">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Recherche…
                                </div>
                            ) : (searchResults?.length ?? 0) === 0 ? (
                                <div className="px-3 py-8 text-center text-sm text-pmn-faint">
                                    Aucun dossier ne correspond à « {search.trim()} »
                                </div>
                            ) : (
                                searchResults!.map(r => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => choose(r.id, r.path)}
                                        className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-pmn-hover"
                                    >
                                        <FolderGlyph size={32} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-pmn-ink">{r.name}</div>
                                            <div className="truncate text-xs text-pmn-faint">📁 {r.path}</div>
                                        </div>
                                        <span className="flex-none text-[11px] font-semibold text-pmn-green">Choisir</span>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        <>
                            {/* ===== Destinations récentes ===== */}
                            {recents.length > 0 && (
                                <div className="mt-1">
                                    <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-pmn-faint">
                                        <Clock className="h-3 w-3" /> Récentes
                                    </div>
                                    {recents.map(rec => (
                                        <button
                                            key={rec.id || 'root'}
                                            type="button"
                                            onClick={() => choose(rec.id || undefined, rec.path)}
                                            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-pmn-hover"
                                        >
                                            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-pmn-gold/[.14] text-pmn-gold-dark">
                                                <Clock className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="truncate text-[13px] text-pmn-text2">{rec.path}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* ===== Fil d'Ariane ===== */}
                            <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border px-3 pb-1 pt-3 text-[13px]">
                                <button
                                    type="button"
                                    onClick={() => navigateTo(-1)}
                                    className={`rounded-md px-1.5 py-0.5 font-medium ${navPath.length === 0 ? 'text-pmn-ink' : 'text-pmn-green hover:bg-pmn-green/[.06]'}`}
                                >
                                    Racine
                                </button>
                                {navPath.map((seg, i) => (
                                    <span key={seg.id} className="flex items-center gap-1">
                                        <ChevronRight className="h-3.5 w-3.5 text-pmn-faint" strokeWidth={2} />
                                        <button
                                            type="button"
                                            onClick={() => navigateTo(i)}
                                            className={`max-w-[180px] truncate rounded-md px-1.5 py-0.5 font-medium ${i === navPath.length - 1 ? 'text-pmn-ink' : 'text-pmn-green hover:bg-pmn-green/[.06]'}`}
                                            title={seg.name}
                                        >
                                            {seg.name}
                                        </button>
                                    </span>
                                ))}
                            </div>

                            {/* ===== Niveau courant (enfants) ===== */}
                            <div className="py-1">
                                {levelLoading ? (
                                    <div className="flex items-center gap-2 px-3 py-6 text-sm text-pmn-faint">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                                    </div>
                                ) : levelFolders.length === 0 ? (
                                    <div className="px-3 py-4 text-sm italic text-pmn-faint">
                                        Aucun sous-dossier à ce niveau.
                                    </div>
                                ) : (
                                    levelFolders.map(node => (
                                        <div
                                            key={node.id}
                                            className="group flex items-center gap-2 rounded-[10px] px-3 py-2 transition-colors hover:bg-pmn-hover"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => enterFolder(node)}
                                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                                title="Ouvrir ce dossier"
                                            >
                                                <FolderGlyph size={32} />
                                                <span className="truncate text-sm font-semibold text-pmn-ink">{node.name}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => choose(node.id, pathOf(node.id))}
                                                className="flex-none rounded-[8px] border border-pmn-green/30 px-2.5 py-1 text-[12px] font-semibold text-pmn-green transition-colors hover:bg-pmn-green/[.06]"
                                            >
                                                Choisir
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => enterFolder(node)}
                                                className="flex-none text-pmn-faint transition-colors hover:text-pmn-subtle"
                                                title="Ouvrir"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* ===== Création inline ===== */}
                            <div className="border-t border-border px-3 py-2">
                                {creating ? (
                                    <div className="flex items-center gap-2 px-1 py-1">
                                        <CornerDownRight className="h-4 w-4 flex-none text-pmn-faint" />
                                        <Input
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && !saving) handleCreate(); }}
                                            placeholder={`Nom du sous-dossier dans « ${currentFolder?.name || 'Racine'} »`}
                                            className="h-9 rounded-[9px] text-sm"
                                            autoFocus
                                        />
                                        <Button
                                            onClick={handleCreate}
                                            disabled={saving}
                                            className="h-9 flex-none rounded-[9px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] px-3 text-[13px] font-semibold text-white"
                                        >
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => { setCreating(false); setNewName(''); }} className="h-9 flex-none text-[13px]">
                                            Annuler
                                        </Button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setCreating(true)}
                                        className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left text-[13px] font-semibold text-pmn-green transition-colors hover:bg-pmn-green/[.06]"
                                    >
                                        <FolderPlus className="h-4 w-4" />
                                        Créer un sous-dossier ici {currentFolder ? `(dans « ${currentFolder.name} »)` : '(à la racine)'}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Pied : sélectionner le dossier courant (si on est entré) */}
                {!isSearchMode && currentFolder && (
                    <div className="border-t border-border px-6 py-3">
                        <Button
                            onClick={() => choose(currentFolder.id, pathOf(currentFolder.id))}
                            className="h-10 w-full rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] text-sm font-semibold text-white shadow-cta transition-[filter] hover:brightness-110"
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Sélectionner « {currentFolder.name} »
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
