'use client';

/**
 * Panneau latéral « Propriétés / Classer » — Archive PMN
 *
 * Affiche et permet d'éditer les métadonnées d'un dossier ou d'un document :
 * nom, cote (D-xxxx, admin), catégorie, rubrique (plan de classement),
 * mots-clés (tags), exercice, statut, dates (lecture seule).
 *
 * L'enregistrement est CIBLÉ : seul l'élément affiché est écrit (.save()),
 * uniquement avec les champs du formulaire. Champs de classement additifs
 * et optionnels — aucun backfill des autres éléments.
 */

import { useEffect, useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Tags, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FolderHelpers, DocumentHelpers } from '@/lib/parse-helpers';
import { CLASSIFICATION_PLAN } from '@/lib/classification-plan';
import { OFFICIAL_CATEGORIES } from '@/lib/categories';
import { FolderGlyph, FileTile } from '@/components/pmn-icons';

export interface PropertiesItem {
    type: 'folder' | 'document';
    data: any;
}

interface PropertiesPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: PropertiesItem | null;
    /** L'utilisateur peut-il modifier cet élément (admin ou propriétaire) ? */
    canEdit: boolean;
    /** Admin : autorise l'édition de la cote (D-xxxx) */
    isAdmin: boolean;
    /** Appelé après un enregistrement réussi (pour rafraîchir l'affichage) */
    onSaved: (type: 'folder' | 'document', updated: any) => void;
}

const NONE_VALUE = '__none__';

export function PropertiesPanel({
    open,
    onOpenChange,
    item,
    canEdit,
    isAdmin,
    onSaved,
}: PropertiesPanelProps) {
    const [name, setName] = useState('');
    const [cote, setCote] = useState('');
    const [category, setCategory] = useState<string>(NONE_VALUE);
    const [rubrique, setRubrique] = useState<string>(NONE_VALUE);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [exercice, setExercice] = useState('');
    const [status, setStatus] = useState<string>('Archive');
    const [saving, setSaving] = useState(false);

    // Synchroniser le formulaire quand l'élément change
    useEffect(() => {
        if (!item) return;
        const d = item.data;
        setName(d.name || '');
        setCote(d.folder_number || '');
        setCategory(d.category || NONE_VALUE);
        setRubrique(d.rubrique || NONE_VALUE);
        setTags(Array.isArray(d.mots_cles) ? d.mots_cles : []);
        setTagInput('');
        setExercice(d.exercice != null ? String(d.exercice) : '');
        setStatus(d.status || (item.type === 'folder' ? 'Archive' : 'Actif'));
    }, [item]);

    if (!item) return null;

    const isFolder = item.type === 'folder';
    const d = item.data;

    const addTag = (raw: string) => {
        const value = raw.trim();
        if (!value) return;
        if (tags.includes(value)) {
            setTagInput('');
            return;
        }
        setTags(prev => [...prev, value]);
        setTagInput('');
    };

    const removeTag = (value: string) => {
        setTags(prev => prev.filter(t => t !== value));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Le nom ne peut pas être vide');
            return;
        }
        if (isFolder && isAdmin && cote.trim() && !/^D-\d{4}$/.test(cote.trim())) {
            toast.error('La cote doit être au format D-XXXX (ex: D-0023)');
            return;
        }
        if (exercice.trim() && !/^\d{4}$/.test(exercice.trim())) {
            toast.error("L'exercice doit être une année à 4 chiffres (ex: 2024)");
            return;
        }

        // Uniquement les champs du formulaire — écriture ciblée sur cet élément
        const payload: Record<string, any> = {
            name: name.trim(),
            category: category === NONE_VALUE ? null : category,
            rubrique: rubrique === NONE_VALUE ? null : rubrique,
            mots_cles: tags,
            exercice: exercice.trim() || null,
            status,
        };
        if (isFolder && isAdmin && cote.trim()) {
            payload.folder_number = cote.trim();
        }

        setSaving(true);
        try {
            const updated = isFolder
                ? await FolderHelpers.update(d.id, payload)
                : await DocumentHelpers.update(d.id, payload);

            toast.success('Propriétés enregistrées');
            onSaved(item.type, updated);
            onOpenChange(false);
        } catch (error: any) {
            console.error('Error saving properties:', error);
            toast.error(`Erreur lors de l'enregistrement${error?.message ? ` : ${error.message}` : ''}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[420px]">
                <SheetHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
                    <div className="flex items-center gap-3">
                        {isFolder ? <FolderGlyph size={40} /> : <FileTile name={d.name || ''} size={40} />}
                        <div className="min-w-0">
                            <SheetTitle className="truncate text-[17px] font-bold text-pmn-ink">
                                Propriétés / Classer
                            </SheetTitle>
                            <SheetDescription className="truncate text-[12.5px]">
                                {isFolder ? 'Dossier' : 'Document'} · {d.name}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 space-y-5 px-6 py-5">
                    {/* Nom */}
                    <div className="space-y-1.5">
                        <Label htmlFor="props-name">Nom</Label>
                        <Input
                            id="props-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!canEdit}
                        />
                    </div>

                    {/* Cote (dossiers) */}
                    {isFolder && (
                        <div className="space-y-1.5">
                            <Label htmlFor="props-cote">Cote</Label>
                            <Input
                                id="props-cote"
                                value={cote}
                                onChange={(e) => setCote(e.target.value)}
                                placeholder="D-0000"
                                className="font-mono"
                                disabled={!canEdit || !isAdmin}
                            />
                            {!isAdmin && (
                                <p className="text-xs text-pmn-faint">
                                    Seul un administrateur peut modifier la cote.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Catégorie */}
                    <div className="space-y-1.5">
                        <Label>Catégorie</Label>
                        <Select value={category} onValueChange={setCategory} disabled={!canEdit}>
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionner une catégorie" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[280px]">
                                <SelectItem value={NONE_VALUE}>
                                    <span className="italic text-pmn-subtle">Aucune</span>
                                </SelectItem>
                                {OFFICIAL_CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Rubrique (plan de classement) */}
                    <div className="space-y-1.5">
                        <Label>Rubrique (plan de classement)</Label>
                        <Select value={rubrique} onValueChange={setRubrique} disabled={!canEdit}>
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionner une rubrique" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[280px]">
                                <SelectItem value={NONE_VALUE}>
                                    <span className="italic text-pmn-subtle">Aucune</span>
                                </SelectItem>
                                {CLASSIFICATION_PLAN.map(r => (
                                    <SelectItem key={r.code} value={r.code}>
                                        {r.code} – {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Mots-clés */}
                    <div className="space-y-1.5">
                        <Label htmlFor="props-tags" className="flex items-center gap-1.5">
                            <Tags className="h-3.5 w-3.5 text-pmn-faint" />
                            Mots-clés
                        </Label>
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {tags.map(tag => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 rounded-[20px] bg-pmn-green/[.08] px-2.5 py-1 text-xs font-medium text-pmn-green"
                                    >
                                        {tag}
                                        {canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => removeTag(tag)}
                                                className="text-pmn-green/60 transition-colors hover:text-pmn-green"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}
                        <Input
                            id="props-tags"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',') {
                                    e.preventDefault();
                                    addTag(tagInput);
                                }
                            }}
                            onBlur={() => addTag(tagInput)}
                            placeholder="Ajouter un mot-clé puis Entrée"
                            disabled={!canEdit}
                        />
                    </div>

                    {/* Exercice */}
                    <div className="space-y-1.5">
                        <Label htmlFor="props-exercice">Exercice (année)</Label>
                        <Input
                            id="props-exercice"
                            value={exercice}
                            onChange={(e) => setExercice(e.target.value)}
                            placeholder="2024"
                            inputMode="numeric"
                            maxLength={4}
                            disabled={!canEdit}
                        />
                    </div>

                    {/* Statut */}
                    <div className="space-y-1.5">
                        <Label>Statut</Label>
                        <Select value={status} onValueChange={setStatus} disabled={!canEdit}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Archive">Archivé</SelectItem>
                                <SelectItem value="Actif">Actif</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Dates (lecture seule) */}
                    <div className="rounded-[11px] border border-border bg-pmn-hover p-3 text-[12.5px] text-pmn-subtle">
                        <p>
                            <span className="font-semibold">Créé le :</span>{' '}
                            {d.createdAt ? format(new Date(d.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr }) : '—'}
                        </p>
                        <p className="mt-1">
                            <span className="font-semibold">Modifié le :</span>{' '}
                            {d.updatedAt ? format(new Date(d.updatedAt), 'dd MMMM yyyy à HH:mm', { locale: fr }) : '—'}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {canEdit ? 'Annuler' : 'Fermer'}
                    </Button>
                    {canEdit && (
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110"
                        >
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
