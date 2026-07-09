'use client';

/**
 * Rapport « Doublons » — Archive PMN (lecture seule)
 *
 * Regroupe les documents suspectés en double pour estimer l'espace récupérable.
 * NE SUPPRIME RIEN automatiquement : chaque suppression est manuelle et
 * confirmée individuellement. Deux niveaux distingués :
 *  - EXACTS : même empreinte SHA-256 (certain).
 *  - PROBABLES : même nom + même taille, pour les documents sans empreinte.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/parse-auth';
import { DocumentHelpers, FolderHelpers } from '@/lib/parse-helpers';
import { formatBytes } from '@/lib/file-hash';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, HardDrive, Files, Eye, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { FileTile } from '@/components/pmn-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface DocMeta {
  id: string;
  name: string;
  file_size?: number;
  file_hash?: string;
  folder_id?: string;
  file_path?: string;
  createdAt: string;
}

interface DupGroup {
  key: string;
  type: 'exact' | 'probable';
  size: number;
  docs: DocMeta[];       // triés : plus ancien en premier
  recoverable: number;   // size × (count - 1)
}

const PAGE_SIZE = 25;

export default function DuplicatesPage() {
  const { profile } = useAuth();
  const isAdmin = ['admin', 'super_admin'].includes(profile?.role || '');

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DupGroup[]>([]);
  const [paths, setPaths] = useState<Record<string, string>>({});
  const [totalRecoverable, setTotalRecoverable] = useState(0);
  const [totalExtraCopies, setTotalExtraCopies] = useState(0);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [toDelete, setToDelete] = useState<{ doc: DocMeta; group: DupGroup } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const buildReport = async () => {
    setLoading(true);
    try {
      const all: DocMeta[] = await DocumentHelpers.scanForDuplicates();

      // Groupes EXACTS par empreinte
      const byHash = new Map<string, DocMeta[]>();
      const noHash: DocMeta[] = [];
      for (const d of all) {
        if (d.file_hash) {
          const arr = byHash.get(d.file_hash) || [];
          arr.push(d);
          byHash.set(d.file_hash, arr);
        } else {
          noHash.push(d);
        }
      }

      // Groupes PROBABLES (nom + taille) parmi les documents SANS empreinte
      const byNameSize = new Map<string, DocMeta[]>();
      for (const d of noHash) {
        if (d.name && typeof d.file_size === 'number') {
          const k = `${d.name}||${d.file_size}`;
          const arr = byNameSize.get(k) || [];
          arr.push(d);
          byNameSize.set(k, arr);
        }
      }

      const result: DupGroup[] = [];
      for (const [key, docs] of byHash) {
        if (docs.length > 1) {
          const size = docs[0].file_size || 0;
          const sorted = [...docs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          result.push({ key: `h:${key}`, type: 'exact', size, docs: sorted, recoverable: size * (docs.length - 1) });
        }
      }
      for (const [key, docs] of byNameSize) {
        if (docs.length > 1) {
          const size = docs[0].file_size || 0;
          const sorted = [...docs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          result.push({ key: `n:${key}`, type: 'probable', size, docs: sorted, recoverable: size * (docs.length - 1) });
        }
      }

      // Tri par espace récupérable décroissant
      result.sort((a, b) => b.recoverable - a.recoverable);

      const totalRec = result.reduce((s, g) => s + g.recoverable, 0);
      const totalCopies = result.reduce((s, g) => s + (g.docs.length - 1), 0);

      // Résoudre les chemins des dossiers concernés (batch, ciblé)
      const folderIds = Array.from(new Set(result.flatMap(g => g.docs.map(d => d.folder_id).filter(Boolean)))) as string[];
      const resolved = folderIds.length ? await FolderHelpers.resolvePaths(folderIds) : {};

      setGroups(result);
      setPaths(resolved);
      setTotalRecoverable(totalRec);
      setTotalExtraCopies(totalCopies);
      setVisible(PAGE_SIZE);
    } catch (e) {
      console.error('Erreur rapport doublons:', e);
      toast.error('Erreur lors de la génération du rapport');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) buildReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const pathOf = (folderId?: string) => (folderId ? (paths[folderId] || 'Racine') : 'Racine');

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await DocumentHelpers.delete(toDelete.doc.id);
      toast.success('Document supprimé');
      // Mettre à jour le groupe localement (recalcul de l'espace)
      setGroups(prev => {
        const next = prev
          .map(g => {
            if (g.key !== toDelete.group.key) return g;
            const docs = g.docs.filter(d => d.id !== toDelete.doc.id);
            return { ...g, docs, recoverable: g.size * Math.max(0, docs.length - 1) };
          })
          .filter(g => g.docs.length > 1);
        setTotalRecoverable(next.reduce((s, g) => s + g.recoverable, 0));
        setTotalExtraCopies(next.reduce((s, g) => s + (g.docs.length - 1), 0));
        return next;
      });
      setToDelete(null);
    } catch (e: any) {
      console.error('Erreur suppression:', e);
      toast.error(`Erreur lors de la suppression${e?.message ? ` : ${e.message}` : ''}`);
    } finally {
      setDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[1320px] px-6 pt-[34px] md:px-10">
        <div className="surface p-12 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-pmn-faint" />
          <h1 className="text-lg font-bold text-pmn-ink">Accès réservé aux administrateurs</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] animate-fade-up space-y-5 px-6 pb-12 pt-[34px] md:px-10">
      <div>
        <h1 className="text-[34px] font-semibold leading-tight tracking-[-.4px] text-pmn-ink-strong">Doublons</h1>
        <p className="mt-[5px] text-[15px] text-pmn-subtle">
          Documents suspectés en double — rapport en lecture seule (aucune suppression automatique)
        </p>
      </div>

      {/* Bandeau récapitulatif */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-[16px] border border-border bg-white p-0 shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pmn-gold/[.16] text-pmn-gold-dark">
              <HardDrive className="h-[21px] w-[21px]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-pmn-subtle">Espace récupérable</p>
              <p className="font-display text-[28px] font-semibold leading-none text-pmn-ink-strong">
                {loading ? '…' : formatBytes(totalRecoverable)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[16px] border border-border bg-white p-0 shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pmn-green/10 text-pmn-green">
              <Copy className="h-[21px] w-[21px]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-pmn-subtle">Groupes de doublons</p>
              <p className="font-display text-[28px] font-semibold leading-none text-pmn-ink-strong">
                {loading ? '…' : groups.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[16px] border border-border bg-white p-0 shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pmn-green/10 text-pmn-green">
              <Files className="h-[21px] w-[21px]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-pmn-subtle">Copies excédentaires</p>
              <p className="font-display text-[28px] font-semibold leading-none text-pmn-ink-strong">
                {loading ? '…' : totalExtraCopies}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[16px]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="surface p-12 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-pmn-green" />
          <h3 className="text-[17px] font-bold text-pmn-ink">Aucun doublon détecté</h3>
          <p className="mt-1 text-sm text-pmn-faint">Vos archives ne contiennent pas de doublons repérables.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {groups.slice(0, visible).map(group => (
              <Card key={group.key} className="rounded-[16px] border border-border bg-white p-0 shadow-card">
                <CardContent className="p-0">
                  {/* En-tête du groupe */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-[20px] px-2.5 py-0.5 text-[11.5px] font-semibold ${group.type === 'exact' ? 'bg-pmn-green/[.1] text-pmn-green' : 'bg-pmn-gold/[.14] text-pmn-gold-dark'}`}>
                        {group.type === 'exact' ? 'Doublon exact' : 'Doublon probable'}
                      </span>
                      <span className="text-sm font-semibold text-pmn-ink">{group.docs.length} occurrences</span>
                      <span className="text-xs text-pmn-faint">· {formatBytes(group.size)} chacun</span>
                    </div>
                    <span className="text-[13px] font-semibold text-pmn-gold-dark">
                      {formatBytes(group.recoverable)} récupérables
                    </span>
                  </div>

                  {/* Occurrences */}
                  <div className="divide-y divide-[rgba(20,33,28,.055)]">
                    {group.docs.map((doc, idx) => (
                      <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                        <FileTile name={doc.name} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[14px] font-semibold text-pmn-ink">{doc.name}</span>
                            {idx === 0 && (
                              <span className="flex-none rounded-[6px] bg-pmn-green/[.1] px-1.5 py-0.5 text-[10.5px] font-semibold text-pmn-green">
                                à conserver (plus ancien)
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-pmn-faint">
                            📁 {pathOf(doc.folder_id)} · {format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr })}
                          </p>
                        </div>
                        {doc.file_path && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-none text-pmn-subtle hover:text-pmn-green"
                            title="Prévisualiser le fichier"
                            onClick={() => window.open(doc.file_path, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-none text-pmn-subtle hover:text-red-600"
                          title="Supprimer cette occurrence"
                          onClick={() => setToDelete({ doc, group })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {visible < groups.length && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setVisible(v => v + PAGE_SIZE)}
                className="rounded-[11px] border-pmn-green/25 font-medium text-pmn-green hover:bg-pmn-green/[.06] hover:text-pmn-green"
              >
                Afficher plus de groupes ({groups.length - visible} restants)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Confirmation de suppression (manuelle, individuelle) */}
      <Dialog open={toDelete !== null} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <Trash2 className="mr-2 h-5 w-5" /> Supprimer ce document ?
            </DialogTitle>
            <DialogDescription className="break-words pt-2">
              Supprimer <strong className="break-all text-pmn-ink">« {toDelete?.doc.name} »</strong> dans{' '}
              <strong>{pathOf(toDelete?.doc.folder_id)}</strong> ?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-pmn-faint">Cette action est irréversible. Les autres occurrences sont conservées.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>Annuler</Button>
            <Button onClick={confirmDelete} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
