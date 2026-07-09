'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Search,
  Folder,
  FolderPlus,
  Upload,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Eye,
  Loader2,
  ChevronRight,
  ChevronDown,
  Edit,
  FilePlus,
  LayoutGrid,
  Grid3X3,
  List,
  Hash,
  FolderInput,
  ArrowUpDown,
  ChevronsDown,
  ChevronsUp,
  Info,
  Tags,
  Archive as ArchiveIcon,
  ArchiveRestore,
  Sparkles,
  Send
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PropertiesPanel, PropertiesItem } from '@/components/properties-panel';
import { CLASSIFICATION_PLAN } from '@/lib/classification-plan';
import { useAuth } from '@/lib/parse-auth';
import { FolderHelpers, DocumentHelpers, UserHelpers, ShareHelpers } from '@/lib/parse-helpers';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import JSZip from 'jszip';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableFolderRow } from '@/components/sortable-folder-row';
import { FolderGlyph, FileTile } from '@/components/pmn-icons';


export const dynamic = 'force-dynamic';

type Folder = {
  id: string;
  name: string;
  created_by: string;
  parent_id?: string;
  createdAt: string;
  category?: string;
  status?: string;
  folder_number?: string;
  // Classement (champs additifs, optionnels)
  rubrique?: string;
  mots_cles?: string[];
  exercice?: string;
};

type Document = {
  id: string;
  name: string;
  category: string;
  size: number;
  uploaded_by: string;
  folder_id?: string;
  createdAt: string;
  file?: any;
  status?: string;
  // Classement (champs additifs, optionnels)
  rubrique?: string;
  mots_cles?: string[];
  exercice?: string;
};

const CATEGORIES = [
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
];

export default function DocumentsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  // Documents à la racine (sans folder_id) uniquement — les documents des
  // dossiers sont chargés à la demande dans docsByFolder (voir ci-dessous).
  const [documents, setDocuments] = useState<Document[]>([]);
  // Cache des documents par dossier : chargés au dépliage, conservés ensuite.
  const [docsByFolder, setDocsByFolder] = useState<Record<string, Document[]>>({});
  const [loadingFolderIds, setLoadingFolderIds] = useState<Set<string>>(new Set());
  const [folderErrors, setFolderErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'large' | 'very-large'>('list');

  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [isNewSubFolderDialogOpen, setIsNewSubFolderDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isMoveDocumentDialogOpen, setIsMoveDocumentDialogOpen] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>('root');

  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderCategory, setNewFolderCategory] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [parentFolder, setParentFolder] = useState<Folder | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'folder' | 'document', id: string, name: string } | null>(null);

  // ===== Déplacement sécurisé de dossiers =====
  // Confirmation avant écriture (drag & drop) : rien n'est enregistré tant que
  // l'utilisateur n'a pas confirmé.
  const [pendingMove, setPendingMove] = useState<{ folder: Folder; targetId: string | null; targetName: string } | null>(null);
  // « Déplacer vers… » (menu ⋮) : sélecteur de destination
  const [isMoveFolderDialogOpen, setIsMoveFolderDialogOpen] = useState(false);
  const [folderToMove, setFolderToMove] = useState<Folder | null>(null);
  const [moveFolderTargetId, setMoveFolderTargetId] = useState<string>('root');

  // ===== Tri de l'affichage (aucune modification de données) =====
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'date-desc' | 'date-asc'>('name-asc');

  // ===== Compteurs de documents par dossier (count() léger, mis en cache) =====
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const countsInFlight = useRef<Set<string>>(new Set());

  // ===== Navigation « drill-down » en vues grille / très grandes icônes =====
  // Pile du chemin courant (fil d'Ariane). Vide = racine.
  // Indépendant de la vue liste (qui utilise expandedFolders + le chevron).
  const [gridPath, setGridPath] = useState<Folder[]>([]);

  // ===== Panneau Propriétés / Classer =====
  const [propertiesItem, setPropertiesItem] = useState<PropertiesItem | null>(null);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);

  // ===== Archiver / Désarchiver (avec confirmation) =====
  const [statusToggleItem, setStatusToggleItem] = useState<PropertiesItem | null>(null);

  // ===== Filtres additionnels (combinables avec la recherche) =====
  const [statusFilter, setStatusFilter] = useState<'all' | 'Archive' | 'Actif'>('all');
  const [exerciceFilter, setExerciceFilter] = useState<string>('all');
  const [rubriqueFilter, setRubriqueFilter] = useState<string>('all');

  // ===== Recherche approfondie (requête serveur indépendante de l'arbre) =====
  const SEARCH_PAGE_SIZE = 50;
  const [searchResults, setSearchResults] = useState<{ folders: Folder[]; documents: Document[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchSkip, setSearchSkip] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const deepSearchActive = searchTerm.trim().length >= 2;

  // ===== Recherche intelligente (IA, langage naturel) =====
  // Mode complémentaire à la recherche classique. La clé API vit UNIQUEMENT
  // côté serveur (/api/ai-search) : le client n'envoie que la requête.
  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<any[] | null>(null);
  const [aiSynthese, setAiSynthese] = useState<string | null>(null);
  const [isModifyNumberDialogOpen, setIsModifyNumberDialogOpen] = useState(false);
  const [newFolderNumber, setNewFolderNumber] = useState('');

  // Share states
  const [users, setUsers] = useState<any[]>([]);
  const [selectedShareUser, setSelectedShareUser] = useState<string>('');
  const [sharePermissions, setSharePermissions] = useState({
    can_read: true,
    can_write: false,
    can_delete: false,
    can_share: false
  });

  // Drag and Drop state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Drag délibéré : maintien 150 ms avant activation (évite les
      // déplacements accidentels au simple clic), tolérance 5 px.
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  useEffect(() => {
    const savedViewMode = localStorage.getItem('pmn_folder_view_mode');
    if (savedViewMode) {
      setViewMode(savedViewMode as any);
    }
    const savedSort = localStorage.getItem('pmn_folder_sort');
    if (savedSort && ['name-asc', 'name-desc', 'date-desc', 'date-asc'].includes(savedSort)) {
      setSortBy(savedSort as any);
    }
    if (profile) {
      fetchFolders();
      fetchDocuments();
      fetchUsers();
    }
  }, [profile]);

  const handleSortChange = (value: string) => {
    setSortBy(value as any);
    localStorage.setItem('pmn_folder_sort', value);
  };

  // Compteurs de documents : count() léger pour les dossiers actuellement
  // rendus (racine + enfants des dossiers dépliés), par lots, avec cache.
  // Aucun chargement massif : seuls des comptages sont demandés.
  //
  // ⚠️ ANTI-BOUCLE : un comptage qui échoue (limite de débit, réseau…) est
  // mémorisé dans countsFailed et n'est JAMAIS retenté automatiquement, et
  // setDocCounts n'est appelé que s'il y a réellement de nouvelles valeurs.
  // (Sans ces gardes : échec → nouvel état → re-déclenchement → re-échec →
  // boucle infinie « Maximum update depth exceeded ».)
  const countsFailed = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (folders.length === 0) return;

    const rendered = folders.filter(f => !f.parent_id || expandedFolders.has(f.parent_id));
    const need = rendered
      .filter(f =>
        docCounts[f.id] === undefined &&
        docsByFolder[f.id] === undefined &&
        !countsInFlight.current.has(f.id) &&
        !countsFailed.current.has(f.id)
      )
      .slice(0, 6);

    if (need.length === 0) return;

    need.forEach(f => countsInFlight.current.add(f.id));
    Promise.all(
      need.map(async f => {
        try {
          return [f.id, await DocumentHelpers.countByFolder(f.id)] as const;
        } catch (e) {
          console.warn(`countByFolder(${f.id}) failed (ne sera pas retenté):`, e);
          countsFailed.current.add(f.id);
          return [f.id, undefined] as const;
        }
      })
    ).then(results => {
      results.forEach(([id]) => countsInFlight.current.delete(id));
      const defined = results.filter(([, count]) => count !== undefined);
      // Ne changer l'état QUE si de nouvelles valeurs existent (anti-boucle)
      if (defined.length > 0) {
        setDocCounts(prev => {
          const next = { ...prev };
          defined.forEach(([id, count]) => {
            next[id] = count as number;
          });
          return next;
        });
      }
    });
  }, [folders, expandedFolders, docCounts, docsByFolder]);

  // Nombre de documents connu pour un dossier : cache de contenu (exact,
  // prioritaire) sinon cache de comptage.
  const getDocCount = (folderId: string): number | undefined =>
    docsByFolder[folderId]?.length ?? docCounts[folderId];

  // Options des filtres de recherche approfondie (combinables)
  const buildDeepSearchOptions = (skip: number) => ({
    skip,
    limit: SEARCH_PAGE_SIZE,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    rubrique: rubriqueFilter !== 'all' ? rubriqueFilter : undefined,
    exercice: exerciceFilter !== 'all' ? exerciceFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  // ===== Recherche approfondie : requête serveur débouncée (300 ms) =====
  // Indépendante de l'arbre : ne recharge rien d'autre, lazy-loading intact.
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const options = buildDeepSearchOptions(0);
        const [folderResults, documentResults] = await Promise.all([
          FolderHelpers.searchDeep(term, options),
          DocumentHelpers.searchDeep(term, options),
        ]);
        setSearchResults({
          folders: folderResults as Folder[],
          documents: documentResults as Document[],
        });
        setSearchSkip(SEARCH_PAGE_SIZE);
        setSearchHasMore(
          folderResults.length === SEARCH_PAGE_SIZE || documentResults.length === SEARCH_PAGE_SIZE
        );
      } catch (error: any) {
        console.error('Deep search error:', error);
        toast.error(`Erreur lors de la recherche${error?.message ? ` : ${error.message}` : ''}`);
        setSearchResults({ folders: [], documents: [] });
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, categoryFilter, rubriqueFilter, exerciceFilter, statusFilter]);

  // Page suivante des résultats de recherche
  const loadMoreSearchResults = async () => {
    const term = searchTerm.trim();
    if (term.length < 2 || loadingMore) return;
    setLoadingMore(true);
    try {
      const options = buildDeepSearchOptions(searchSkip);
      const [folderResults, documentResults] = await Promise.all([
        FolderHelpers.searchDeep(term, options),
        DocumentHelpers.searchDeep(term, options),
      ]);
      setSearchResults(prev => prev ? {
        folders: [...prev.folders, ...(folderResults as Folder[])],
        documents: [...prev.documents, ...(documentResults as Document[])],
      } : { folders: folderResults as Folder[], documents: documentResults as Document[] });
      setSearchSkip(prev => prev + SEARCH_PAGE_SIZE);
      setSearchHasMore(
        folderResults.length === SEARCH_PAGE_SIZE || documentResults.length === SEARCH_PAGE_SIZE
      );
    } catch (error: any) {
      toast.error(`Erreur lors du chargement des résultats${error?.message ? ` : ${error.message}` : ''}`);
    } finally {
      setLoadingMore(false);
    }
  };

  // Depuis un résultat de recherche : révèle l'élément dans l'arbre
  // (déplie tous les ancêtres + le dossier, charge son contenu à la volée).
  const revealInTree = (folderId: string | null | undefined) => {
    setSearchTerm('');
    if (!folderId) return;
    setExpandedFolders(prev => {
      const next = new Set(prev);
      let current = folders.find(f => f.id === folderId);
      next.add(folderId);
      while (current?.parent_id) {
        next.add(current.parent_id);
        current = folders.find(f => f.id === current!.parent_id);
      }
      return next;
    });
    fetchFolderDocuments(folderId);
  };

  // ===== Recherche intelligente : envoi au serveur =====
  const runAiSearch = async () => {
    const query = aiQuery.trim();
    if (query.length < 3) {
      toast.error('Décrivez votre recherche en quelques mots (3 caractères minimum)');
      return;
    }
    setAiLoading(true);
    setAiResults(null);
    setAiSynthese(null);
    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.fallback) {
          // Repli : recherche approfondie classique (Étape A).
          // Pour les admins : indiquer discrètement la catégorie de cause
          // (missing_key / billing / auth / model / network…) pour le dépannage.
          const isAdmin = ['admin', 'super_admin'].includes(profile?.role || '');
          const reasonHint = isAdmin && data?.reason ? ` [cause : ${data.reason}]` : '';
          toast.info(`${data.error || 'Recherche IA indisponible'} — recherche classique utilisée.${reasonHint}`);
          setAiMode(false);
          setAiResults(null);
          setSearchTerm(query);
          return;
        }
        toast.error(data?.error || 'Erreur lors de la recherche IA');
        return;
      }

      setAiResults(data.results || []);
      setAiSynthese(data.reponse || null);
    } catch (error: any) {
      console.error('AI search error:', error);
      // Panne réseau/API : repli sur la recherche classique
      toast.info('Recherche IA indisponible — recherche classique utilisée.');
      setAiMode(false);
      setSearchTerm(query);
    } finally {
      setAiLoading(false);
    }
  };

  // Clic sur un résultat IA : quitter le mode IA et révéler l'élément
  const handleAiResultClick = (result: any) => {
    setAiMode(false);
    setAiResults(null);
    setAiSynthese(null);
    setAiQuery('');
    // Dossier → révéler le dossier lui-même ; document → son dossier parent
    revealInTree(result.type === 'dossier' ? result.objectId : result.parentId);
  };

  // Basculer le mode IA (reset propre dans les deux sens)
  const toggleAiMode = () => {
    setAiMode(prev => {
      const next = !prev;
      if (next) {
        setSearchTerm(''); // désactiver la recherche classique
      } else {
        setAiResults(null);
        setAiSynthese(null);
        setAiLoading(false);
      }
      return next;
    });
  };

  // ===== « Tout développer » : chargement PROGRESSIF du contenu =====
  // Les dossiers dépliés sans contenu en cache sont chargés avec un PLAFOND
  // DE CONCURRENCE de 4 (chargement par dossier respecté — jamais massif).
  //
  // ⚠️ ANTI-BOUCLE (cause du crash « Maximum update depth exceeded ») :
  // sans le plafond ci-dessous, chaque setLoadingFolderIds re-déclenchait
  // cet effet de façon SYNCHRONE, qui lançait aussitôt les 4 dossiers
  // suivants, etc. Avec 490 dossiers dépliés : ~123 mises à jour d'état
  // imbriquées dans le même cycle → React coupe à 50 et crashe.
  // Le plafond garantit : quand 4 chargements sont en vol, l'effet
  // re-déclenché NE CHANGE AUCUN ÉTAT (cascade synchrone stoppée) ;
  // la suite ne part qu'aux complétions (asynchrones).
  useEffect(() => {
    const MAX_CONCURRENT = 4;
    const freeSlots = MAX_CONCURRENT - loadingFolderIds.size;
    if (freeSlots <= 0) return;

    const pending = Array.from(expandedFolders)
      .filter(id =>
        docsByFolder[id] === undefined &&
        !loadingFolderIds.has(id) &&
        !folderErrors[id] &&
        folders.some(f => f.id === id)
      )
      .slice(0, freeSlots);
    pending.forEach(id => fetchFolderDocuments(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedFolders, docsByFolder, loadingFolderIds, folders]);

  const expandAll = () => {
    setExpandedFolders(new Set(folders.map(f => f.id)));
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  // Chemin d'un élément pour la liste de résultats (fil d'Ariane)
  const getResultPath = (parentFolderId: string | null | undefined): string => {
    if (!parentFolderId) return 'Racine';
    return getFolderPath(parentFolderId) || 'Racine';
  };

  const handleViewModeChange = (mode: 'list' | 'large' | 'very-large') => {
    setViewMode(mode);
    localStorage.setItem('pmn_folder_view_mode', mode);
  };

  // ===== Handlers de navigation drill-down (vues grille) =====
  // Entrer dans un dossier : empiler dans le fil d'Ariane + charger son
  // contenu à la demande (getByFolder — lazy-loading respecté).
  const enterFolderGrid = (folder: Folder) => {
    setGridPath(prev => [...prev, folder]);
    fetchFolderDocuments(folder.id);
  };

  // Remonter à un niveau du fil d'Ariane (index -1 = racine).
  const gridNavigateTo = (index: number) => {
    setGridPath(prev => (index < 0 ? [] : prev.slice(0, index + 1)));
  };

  // NOTE: l'ancien polling (10 s) rechargeait TOUS les documents à chaque cycle
  // (requête massive) et écrasait l'état local. Supprimé : les données sont
  // rafraîchies de manière ciblée après chaque action (création, renommage,
  // suppression, déplacement).

  const fetchFolders = async () => {
    try {
      if (!profile?.id) {
        console.warn('No user profile available, skipping folder fetch');
        return;
      }

      console.log('📁 Fetching folders for user:', profile.id);

      // Fetch folders for current user only
      // Admin users can see all folders if needed (future enhancement)
      const isAdmin = ['super_admin', 'admin'].includes(profile.role);
      const foldersData = isAdmin
        ? await FolderHelpers.getAllForAdmin()
        : await FolderHelpers.getAllByUser(profile.id);

      console.log(`✅ Fetched ${foldersData.length} folders`);
      setFolders(foldersData as Folder[]);
    } catch (error: any) {
      console.error('Error loading folders:', error);
      toast.error(`Erreur lors du chargement des dossiers${error?.message ? ` : ${error.message}` : ''}`);
    }
  };

  // Charge UNIQUEMENT les documents à la racine (sans dossier).
  // Les documents des dossiers sont chargés à la demande via fetchFolderDocuments,
  // ce qui évite la requête massive (3894 docs) qui tronquait/échouait auparavant.
  const fetchDocuments = async () => {
    try {
      const documentsData = await DocumentHelpers.getByFolder(null);
      setDocuments(documentsData as Document[]);
    } catch (error: any) {
      console.error('Error loading root documents:', error);
      toast.error(`Erreur lors du chargement des données${error?.message ? ` : ${error.message}` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  // Charge les documents d'un dossier donné (au dépliage), avec cache.
  const fetchFolderDocuments = async (folderId: string, force = false) => {
    if (!force && docsByFolder[folderId]) return;

    setLoadingFolderIds(prev => new Set(prev).add(folderId));
    setFolderErrors(prev => {
      if (!(folderId in prev)) return prev;
      const next = { ...prev };
      delete next[folderId];
      return next;
    });

    try {
      const docs = await DocumentHelpers.getByFolder(folderId);
      setDocsByFolder(prev => ({ ...prev, [folderId]: docs as Document[] }));
    } catch (error: any) {
      console.error(`Error loading documents for folder ${folderId}:`, error);
      setFolderErrors(prev => ({ ...prev, [folderId]: error?.message || 'Erreur de chargement' }));
    } finally {
      setLoadingFolderIds(prev => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
  };

  // Rafraîchit le conteneur d'un document (racine ou dossier chargé en cache).
  const refreshDocumentContainer = (folderId?: string | null) => {
    if (folderId) {
      if (docsByFolder[folderId]) {
        fetchFolderDocuments(folderId, true);
      }
    } else {
      fetchDocuments();
    }
  };

  const fetchUsers = async () => {
    try {
      const allUsers = await UserHelpers.getAll();
      setUsers((allUsers as any[]).filter(u => u.id !== profile?.id));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleShareDocument = async () => {
    if (!selectedDocument || !selectedShareUser || !profile) {
      toast.error('Veuillez sélectionner un utilisateur');
      return;
    }

    try {
      await ShareHelpers.create({
        document_id: selectedDocument.id,
        shared_by: profile.id,
        shared_with: selectedShareUser,
        ...sharePermissions,
        is_link_share: false,
        share_token: null,
        expires_at: null
      });

      toast.success('✅ Document partagé avec succès');
      setIsShareDialogOpen(false);
      setSelectedShareUser('');
      setSharePermissions({
        can_read: true,
        can_write: false,
        can_delete: false,
        can_share: false
      });
    } catch (error) {
      console.error('Error sharing document:', error);
      toast.error('Erreur lors du partage');
    }
  };

  const handleModifyFolderNumber = async () => {
    if (!selectedFolder || !newFolderNumber.trim()) {
      toast.error('Veuillez entrer un numéro de dossier');
      return;
    }

    // Validate format D-XXXX
    const numberPattern = /^D-\d{4}$/;
    if (!numberPattern.test(newFolderNumber.trim())) {
      toast.error('Le format doit être D-XXXX (ex: D-0023)');
      return;
    }

    try {
      await FolderHelpers.update(selectedFolder.id, {
        folder_number: newFolderNumber.trim()
      });

      toast.success('✅ Numéro de dossier modifié avec succès');
      setIsModifyNumberDialogOpen(false);
      setNewFolderNumber('');
      setSelectedFolder(null);
      fetchFolders();
    } catch (error) {
      console.error('Error modifying folder number:', error);
      toast.error('Erreur lors de la modification du numéro');
    }
  };


  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Veuillez entrer un nom de dossier');
      return;
    }

    try {
      await FolderHelpers.create({
        name: newFolderName.trim(),
        created_by: profile?.id,
        category: newFolderCategory || 'Autre',
        status: 'Archive'
      });

      toast.success('Dossier créé avec succès');
      setIsNewFolderDialogOpen(false);
      setNewFolderName('');
      setNewFolderCategory('');
      fetchFolders();
      fetchDocuments();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Erreur lors de la création du dossier');
    }
  };

  const handleCreateSubFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Veuillez entrer un nom de sous-dossier');
      return;
    }

    if (!parentFolder) {
      toast.error('Dossier parent non sélectionné');
      return;
    }

    try {
      const newFolder = await FolderHelpers.create({
        name: newFolderName.trim(),
        created_by: profile?.id,
        parent_id: parentFolder.id,
        category: parentFolder.category || 'Autre',
        status: 'Archive'
      });

      toast.success('Sous-dossier créé avec succès');
      setIsNewSubFolderDialogOpen(false);
      setNewFolderName('');

      // Store parent ID before clearing state
      const parentId = parentFolder.id;
      setParentFolder(null);

      // Optimistically update folders list
      setFolders(prev => [...prev, newFolder as Folder]);

      // Expand the parent folder to show the new subfolder
      setExpandedFolders(prev => {
        const newExpanded = new Set(prev);
        newExpanded.add(parentId);
        return newExpanded;
      });

      // Still fetch to ensure consistency, but UI is already updated
      fetchFolders();
      fetchDocuments();

    } catch (error) {
      console.error('Error creating subfolder:', error);
      toast.error('Erreur lors de la création du sous-dossier');
    }
  };

  const canMoveFolder = (userProfile: any, folder: Folder): boolean => {
    if (!userProfile) return false;
    // Only admins and folder owners can move
    return ['super_admin', 'admin'].includes(userProfile.role) || folder.created_by === userProfile.id;
  };

  // Tous les descendants d'un dossier (garde-fou anti-cycle côté UI)
  const getDescendantIds = (folderId: string): Set<string> => {
    const ids = new Set<string>();
    const walk = (parentId: string) => {
      folders.forEach(f => {
        if (f.parent_id === parentId && !ids.has(f.id)) {
          ids.add(f.id);
          walk(f.id);
        }
      });
    };
    walk(folderId);
    return ids;
  };

  /**
   * Exécute un déplacement CONFIRMÉ de dossier (drag & drop ou « Déplacer vers… »).
   * - Mémorise l'ancien parent_id AVANT écriture → toast « Annuler » (10 s)
   *   qui restaure exactement la position d'origine.
   * - Seul le champ parent_id est modifié (FolderHelpers.move).
   */
  const executeMove = async (folder: Folder, targetId: string | null, targetName: string) => {
    const previousParentId = folder.parent_id ?? null;

    try {
      await FolderHelpers.move(folder.id, targetId);

      // Déplier la destination pour montrer le résultat
      if (targetId) {
        setExpandedFolders(prev => new Set(prev).add(targetId));
      }
      await fetchFolders();

      toast.success(
        targetId
          ? `« ${folder.name} » déplacé dans « ${targetName} »`
          : `« ${folder.name} » déplacé à la racine`,
        {
          duration: 10000,
          action: {
            label: 'Annuler',
            onClick: async () => {
              try {
                await FolderHelpers.move(folder.id, previousParentId);
                if (previousParentId) {
                  setExpandedFolders(prev => new Set(prev).add(previousParentId));
                }
                await fetchFolders();
                toast.success(`« ${folder.name} » est revenu à sa place d'origine`);
              } catch (undoError: any) {
                console.error('Error undoing move:', undoError);
                toast.error(`Impossible d'annuler le déplacement${undoError?.message ? ` : ${undoError.message}` : ''}`);
              }
            },
          },
        }
      );
    } catch (error: any) {
      console.error('Error moving folder:', error);
      await fetchFolders();
      if (error.message?.includes('sous-dossiers')) {
        toast.error('Impossible de déplacer un dossier dans un de ses sous-dossiers');
      } else if (error.message?.includes('lui-même')) {
        toast.error('Impossible de déplacer un dossier dans lui-même');
      } else {
        toast.error(`Erreur lors du déplacement${error?.message ? ` : ${error.message}` : ''}`);
      }
    }
  };

  /**
   * Garde-fous d'un déplacement : permissions, dossier dans lui-même,
   * dossier dans un de ses descendants, destination inchangée.
   * Retourne false (avec message) si le déplacement est interdit.
   */
  const validateMove = (folder: Folder, targetId: string | null, targetName: string): boolean => {
    if (!canMoveFolder(profile, folder)) {
      toast.error('Vous n\'avez pas la permission de déplacer ce dossier');
      return false;
    }
    if (targetId === folder.id) {
      toast.error('Impossible de déplacer un dossier dans lui-même');
      return false;
    }
    if (targetId && getDescendantIds(folder.id).has(targetId)) {
      toast.error('Impossible de déplacer un dossier dans un de ses sous-dossiers');
      return false;
    }
    if ((folder.parent_id ?? null) === targetId) {
      toast.info(
        targetId
          ? `« ${folder.name} » est déjà dans « ${targetName} »`
          : `« ${folder.name} » est déjà à la racine`
      );
      return false;
    }
    return true;
  };

  /** Drag & drop : valide puis ouvre la modale de confirmation. */
  const requestMove = (folder: Folder, targetId: string | null, targetName: string): boolean => {
    if (!validateMove(folder, targetId, targetName)) return false;
    setPendingMove({ folder, targetId, targetName });
    return true;
  };

  /** « Déplacer vers… » : le bouton du sélecteur vaut confirmation. */
  const confirmMoveFolderDialog = async () => {
    if (!folderToMove) return;
    const targetId = moveFolderTargetId === 'root' ? null : moveFolderTargetId;
    const targetName = targetId
      ? (folders.find(f => f.id === targetId)?.name || 'ce dossier')
      : 'la racine';

    if (!validateMove(folderToMove, targetId, targetName)) return;

    setIsMoveFolderDialogOpen(false);
    const folder = folderToMove;
    setFolderToMove(null);
    setMoveFolderTargetId('root');
    await executeMove(folder, targetId, targetName);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? (over.id as string) : null);
  };

  /**
   * Drop d'un dossier sur un autre = demande de déplacement DANS ce dossier.
   * AUCUNE écriture ici : on valide les garde-fous puis on ouvre la
   * confirmation (pendingMove). L'écriture n'a lieu qu'après « Confirmer ».
   * (L'ancien « réordonnancement » entre frères, jamais persisté, est supprimé.)
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setOverId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const draggedFolder = folders.find(f => f.id === active.id);
    const targetFolder = folders.find(f => f.id === over.id);

    if (!draggedFolder || !targetFolder) return;

    requestMove(draggedFolder, targetFolder.id, targetFolder.name);
  };


  const canRename = (userProfile: any, item: Folder | Document): boolean => {
    if (!userProfile) return false;
    // Only admins and owners can rename
    return ['super_admin', 'admin'].includes(userProfile.role) || (item as any).created_by === userProfile.id || (item as any).uploaded_by === userProfile.id;
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;

    // Capturé avant la remise à zéro des états pour rafraîchir le bon conteneur
    const renamedDocument = selectedDocument;

    try {
      if (selectedFolder) {
        if (!canRename(profile, selectedFolder)) {
          toast.error("Vous n'avez pas la permission de renommer ce dossier");
          return;
        }
        await FolderHelpers.update(selectedFolder.id, {
          name: renameValue.trim()
        });
        toast.success('Dossier renommé avec succès');
      } else if (selectedDocument) {
        if (!canRename(profile, selectedDocument)) {
          toast.error("Vous n'avez pas la permission de renommer ce document");
          return;
        }
        await DocumentHelpers.update(selectedDocument.id, {
          name: renameValue.trim()
        });
        toast.success('Document renommé avec succès');
      }

      setIsRenameDialogOpen(false);
      setSelectedFolder(null);
      setSelectedDocument(null);
      setRenameValue('');
      fetchFolders();
      // Rafraîchissement ciblé : uniquement le conteneur du document renommé
      if (renamedDocument) {
        refreshDocumentContainer(renamedDocument.folder_id);
      }
    } catch (error) {
      console.error('Error renaming:', error);
      toast.error('Erreur lors du renommage');
    }
  };

  const handleShareFolder = async (folder?: Folder) => {
    const targetFolder = folder || selectedFolder;
    if (!targetFolder) return;

    const url = `${window.location.origin}/dashboard/documents?folder=${targetFolder.id}`;

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien du dossier copié dans le presse-papier');
      setIsShareDialogOpen(false);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for non-secure contexts or failures
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('Lien du dossier copié dans le presse-papier');
        setIsShareDialogOpen(false);
      } catch (err) {
        console.error('Fallback copy failed:', err);
        toast.error('Impossible de copier le lien');
      }
      document.body.removeChild(textArea);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    // Localiser le conteneur du document AVANT suppression (racine ou dossier en cache)
    const documentContainerId =
      itemToDelete.type === 'document' && !documents.some(d => d.id === itemToDelete.id)
        ? Object.keys(docsByFolder).find(fid =>
            docsByFolder[fid].some(d => d.id === itemToDelete.id)
          ) ?? null
        : null;

    try {
      if (itemToDelete.type === 'folder') {
        await FolderHelpers.delete(itemToDelete.id);
        // Purger le cache du dossier supprimé
        setDocsByFolder(prev => {
          if (!(itemToDelete.id in prev)) return prev;
          const next = { ...prev };
          delete next[itemToDelete.id];
          return next;
        });
        toast.success('Dossier supprimé');
        fetchFolders();
      } else {
        await DocumentHelpers.delete(itemToDelete.id);
        toast.success('Document supprimé');
        // Rafraîchissement ciblé du conteneur concerné uniquement
        refreshDocumentContainer(documentContainerId);
        // Invalider le compteur du dossier concerné
        if (documentContainerId) {
          setDocCounts(prev => {
            const next = { ...prev };
            delete next[documentContainerId];
            return next;
          });
        }
      }
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);

      // Trigger dashboard refresh to update stats in real-time
      window.dispatchEvent(new Event('refreshDashboard'));
    } catch (error: any) {
      console.error('Error deleting item:', error);
      toast.error(`Erreur lors de la suppression${error?.message ? ` : ${error.message}` : ''}`);
    }
  };

  const canDelete = (userProfile: any, item: Folder | Document): boolean => {
    if (!userProfile) return false;
    // Only admins and owners can delete
    return ['super_admin', 'admin'].includes(userProfile.role) || (item as any).created_by === userProfile.id || (item as any).uploaded_by === userProfile.id;
  };

  const handleDeleteFolder = (folder: Folder) => {
    if (!canDelete(profile, folder)) {
      toast.error("Vous n'avez pas la permission de supprimer ce dossier");
      return;
    }
    setItemToDelete({ type: 'folder', id: folder.id, name: folder.name });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteDocument = (doc: Document) => {
    if (!canDelete(profile, doc)) {
      toast.error("Vous n'avez pas la permission de supprimer ce document");
      return;
    }
    setItemToDelete({ type: 'document', id: doc.id, name: doc.name });
    setIsDeleteDialogOpen(true);
  };

  const handleMoveDocument = async () => {
    if (!selectedDocument) return;

    try {
      const sourceFolderId = selectedDocument.folder_id || null;
      const targetFolderId = moveTargetFolderId === 'root' ? null : moveTargetFolderId;

      // Update in backend
      await DocumentHelpers.update(selectedDocument.id, {
        folder_id: targetFolderId
      });

      // Rafraîchir les conteneurs source et destination (racine ou cache)
      refreshDocumentContainer(sourceFolderId);
      if (targetFolderId !== sourceFolderId) {
        refreshDocumentContainer(targetFolderId);
      }

      // Invalider les compteurs des dossiers concernés
      setDocCounts(prev => {
        const next = { ...prev };
        if (sourceFolderId) delete next[sourceFolderId];
        if (targetFolderId) delete next[targetFolderId];
        return next;
      });

      toast.success('Document déplacé avec succès');
      setIsMoveDocumentDialogOpen(false);
      setSelectedDocument(null);
      setMoveTargetFolderId('root');
    } catch (error: any) {
      console.error('Error moving document:', error);
      toast.error(`Erreur lors du déplacement du document${error?.message ? ` : ${error.message}` : ''}`);
    }
  };

  // Helper to get full path of a folder
  const getFolderPath = (folderId: string): string => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return '';

    const parts = [folder.name];
    let current = folder;

    while (current.parent_id) {
      const parent = folders.find(f => f.id === current.parent_id);
      if (parent) {
        parts.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
    }

    return parts.join(' > ');
  };

  // Prepare sorted folder options with paths
  const folderOptions = folders
    .map(f => ({
      id: f.id,
      name: f.name,
      path: getFolderPath(f.id)
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const handleDownload = async (doc: Document) => {
    try {
      // Debug: log the entire document structure
      console.log('Document structure:', doc);
      console.log('File object:', doc.file);

      // Try multiple possible locations for the file URL
      const fileUrl = doc.file?.url || (doc as any).file_url || (doc as any).file_path;

      if (fileUrl) {
        console.log('File URL found:', fileUrl);
        // Try to fetch first to check if it works
        try {
          const response = await fetch(fileUrl);
          if (!response.ok) throw new Error('Network response was not ok');
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = doc.name;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          toast.success('Téléchargement démarré');
        } catch (fetchError) {
          console.warn('Fetch download failed, falling back to window.open', fetchError);
          // Fallback: open in new tab
          window.open(fileUrl, '_blank');
          toast.success('Ouverture du document');
        }
      } else {
        console.error('No file URL found. Document object:', doc);
        toast.error('URL du fichier introuvable');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleDownloadFolder = async (folder: Folder) => {
    try {
      toast.loading('Préparation du téléchargement... Cela peut prendre quelques instants.');
      const zip = new JSZip();

      // Recursive function to fetch and add content
      const processFolder = async (folderId: string, currentZip: any) => {
        // Fetch fresh data from backend to ensure we have EVERYTHING
        // (bypassing the frontend list limit or current filter state)
        const [folderDocs, subfolders] = await Promise.all([
          DocumentHelpers.getByFolder(folderId) as Promise<Document[]>,
          FolderHelpers.getSubFolders(folderId) as Promise<Folder[]>
        ]);

        // Process documents in parallel
        await Promise.all(folderDocs.map(async (doc) => {
          // Robust URL detection logic
          const fileUrl = doc.file?.url || (doc as any).file_url || (doc as any).file_path;

          if (fileUrl) {
            try {
              const response = await fetch(fileUrl);
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              const blob = await response.blob();
              currentZip.file(doc.name, blob);
            } catch (e) {
              console.error(`Failed to download ${doc.name}`, e);
              // Add a text file explaining the error for this specific file
              currentZip.file(`${doc.name}_error.txt`, `Le fichier n'a pas pu être téléchargé. Erreur: ${e}`);
            }
          }
        }));

        // Process subfolders
        for (const sub of subfolders) {
          const subZip = currentZip.folder(sub.name);
          if (subZip) {
            await processFolder(sub.id, subZip);
          }
        }
      };

      await processFolder(folder.id, zip);

      // Check if ZIP is not empty before downloading
      if (Object.keys(zip.files).length === 0) {
        toast.dismiss();
        toast.warning('Le dossier est vide.');
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folder.name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.dismiss();
      toast.success('Dossier téléchargé avec succès');

    } catch (error) {
      console.error('Error downloading folder:', error);
      toast.dismiss();
      toast.error('Erreur lors de la génération du ZIP');
    }
  };

  // ===== Propriétés / Classer =====
  const openProperties = (type: 'folder' | 'document', data: any) => {
    setPropertiesItem({ type, data });
    setIsPropertiesOpen(true);
  };

  const handlePropertiesSaved = (type: 'folder' | 'document', updated: any) => {
    if (type === 'folder') {
      fetchFolders();
    } else {
      refreshDocumentContainer(updated?.folder_id ?? propertiesItem?.data?.folder_id ?? null);
    }
  };

  // ===== Archiver / Désarchiver =====
  const requestStatusToggle = (type: 'folder' | 'document', data: any) => {
    if (!canRename(profile, data)) {
      toast.error("Vous n'avez pas la permission de modifier cet élément");
      return;
    }
    setStatusToggleItem({ type, data });
  };

  const confirmStatusToggle = async () => {
    if (!statusToggleItem) return;
    const { type, data } = statusToggleItem;
    const newStatus = data.status === 'Archive' ? 'Actif' : 'Archive';
    setStatusToggleItem(null);
    try {
      if (type === 'folder') {
        await FolderHelpers.update(data.id, { status: newStatus });
        fetchFolders();
      } else {
        await DocumentHelpers.update(data.id, { status: newStatus });
        refreshDocumentContainer(data.folder_id ?? null);
      }
      toast.success(
        newStatus === 'Archive'
          ? `« ${data.name} » archivé`
          : `« ${data.name} » désarchivé`
      );
    } catch (error: any) {
      console.error('Error toggling status:', error);
      toast.error(`Erreur lors du changement de statut${error?.message ? ` : ${error.message}` : ''}`);
    }
  };

  // Filtres additionnels (statut / exercice / rubrique) — affichage uniquement
  const matchesExtraFilters = (item: { status?: string; exercice?: string; rubrique?: string }): boolean => {
    if (statusFilter === 'Archive' && item.status !== 'Archive') return false;
    if (statusFilter === 'Actif' && item.status === 'Archive') return false;
    if (exerciceFilter !== 'all' && String(item.exercice ?? '') !== exerciceFilter) return false;
    if (rubriqueFilter !== 'all' && item.rubrique !== rubriqueFilter) return false;
    return true;
  };

  // Années présentes dans les données chargées (pour le filtre Exercice)
  const exerciceOptions = Array.from(
    new Set(
      [...folders, ...documents, ...Object.values(docsByFolder).flat()]
        .map(item => item.exercice)
        .filter(Boolean)
        .map(String)
    )
  ).sort().reverse();

  // Comparateur de tri (affichage uniquement, aucune écriture)
  const compareItems = (a: { name: string; createdAt: string }, b: { name: string; createdAt: string }): number => {
    switch (sortBy) {
      case 'name-desc':
        return b.name.localeCompare(a.name, 'fr', { numeric: true, sensitivity: 'base' });
      case 'date-desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'date-asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'name-asc':
      default:
        return a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' });
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
      // Chargement à la demande : les documents du dossier sont récupérés
      // au premier dépliage puis mis en cache.
      fetchFolderDocuments(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getDocumentsInFolder = (folderId: string) => {
    return [...(docsByFolder[folderId] ?? [])].sort(compareItems);
  };

  const getSubFolders = (parentId: string) => {
    return folders.filter(folder => folder.parent_id === parentId).sort(compareItems);
  };

  const filteredFolders = folders
    .filter(folder => {
      const matchesSearch = folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        folder.folder_number?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || folder.category === categoryFilter;
      return matchesSearch && matchesCategory && matchesExtraFilters(folder) && !folder.parent_id;
    })
    .sort(compareItems);

  const filteredDocuments = documents
    .filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
      return matchesSearch && matchesCategory && matchesExtraFilters(doc) && !doc.folder_id;
    })
    .sort(compareItems);

  // ===== Contenu du dossier courant en vue GRILLE (drill-down) =====
  // gridCurrentId = null → racine (mêmes éléments qu'en liste au niveau 0).
  const gridCurrentId = gridPath.length ? gridPath[gridPath.length - 1].id : null;

  const gridFolders = folders
    .filter(f => (f.parent_id ?? null) === gridCurrentId)
    .filter(f => categoryFilter === 'all' || f.category === categoryFilter)
    .filter(matchesExtraFilters)
    .sort(compareItems);

  // Documents du dossier courant : racine → state `documents` ;
  // sous-dossier → cache `docsByFolder` (chargé au drill-in).
  const gridDocuments = (gridCurrentId ? (docsByFolder[gridCurrentId] ?? []) : documents)
    .filter((d: Document) => categoryFilter === 'all' || d.category === categoryFilter)
    .filter(matchesExtraFilters)
    .sort(compareItems);

  const gridLoading = gridCurrentId != null && loadingFolderIds.has(gridCurrentId) && docsByFolder[gridCurrentId] === undefined;

  // Recursive helper to render folder hierarchy
  const renderFolderRecursive = (foldersToRender: Folder[], depth: number = 0) => {
    return foldersToRender.map((folder) => {
      const isExpanded = expandedFolders.has(folder.id);
      const subFolders = getSubFolders(folder.id);
      const docs = getDocumentsInFolder(folder.id);
      const isOverThis = overId === folder.id;
      const canMove = canMoveFolder(profile, folder);

      return (
        <div key={folder.id} className={depth > 0 ? "border-t border-gray-100" : ""}>
          {/* Folder Row */}
          <SortableFolderRow
            folder={folder}
            isExpanded={isExpanded}
            isOverThis={isOverThis}
            canMove={canMove}
            onToggle={() => toggleFolder(folder.id)}
            style={depth > 0 ? { paddingLeft: `${18 + depth * 26}px` } : undefined} // indentation charte : depth × 26px
            subCount={subFolders.length}
            docCount={getDocCount(folder.id)}
          >
            {/* Same dropdown menu for ALL levels */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFolder(folder);
                    setRenameValue(folder.name);
                    setIsRenameDialogOpen(true);
                  }}
                  disabled={!canRename(profile, folder)}
                  className="whitespace-nowrap cursor-pointer"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Renommer
                </DropdownMenuItem>
                {/* Admin only: Modify Number */}
                {['admin', 'super_admin'].includes(profile?.role || '') && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFolder(folder);
                      setNewFolderNumber(folder.folder_number || '');
                      setIsModifyNumberDialogOpen(true);
                    }}
                    className="whitespace-nowrap cursor-pointer"
                  >
                    <Hash className="h-4 w-4 mr-2" />
                    Modifier numéro
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadFolder(folder);
                  }}
                  className="whitespace-nowrap cursor-pointer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    openProperties('folder', folder);
                  }}
                  className="whitespace-nowrap cursor-pointer"
                >
                  <Info className="h-4 w-4 mr-2" />
                  Propriétés / Détails
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    openProperties('folder', folder);
                  }}
                  className="whitespace-nowrap cursor-pointer"
                >
                  <Tags className="h-4 w-4 mr-2" />
                  Classer
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    requestStatusToggle('folder', folder);
                  }}
                  disabled={!canRename(profile, folder)}
                  className="whitespace-nowrap cursor-pointer"
                >
                  {folder.status === 'Archive' ? (
                    <><ArchiveRestore className="h-4 w-4 mr-2" />Désarchiver</>
                  ) : (
                    <><ArchiveIcon className="h-4 w-4 mr-2" />Archiver</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareFolder(folder);
                  }}
                  className="whitespace-nowrap cursor-pointer"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Partager
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setFolderToMove(folder);
                    setMoveFolderTargetId(folder.parent_id || 'root');
                    setIsMoveFolderDialogOpen(true);
                  }}
                  disabled={!canMoveFolder(profile, folder)}
                  className="whitespace-nowrap cursor-pointer"
                >
                  <FolderInput className="h-4 w-4 mr-2" />
                  Déplacer vers…
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setParentFolder(folder);
                    setIsNewSubFolderDialogOpen(true);
                  }}
                  className="whitespace-nowrap cursor-pointer"
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Nouveau sous-dossier
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder);
                  }}
                  disabled={!canDelete(profile, folder)}
                  className="text-red-600 whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SortableFolderRow>

          {/* Children: Subfolders and Documents */}
          {isExpanded && (
            <div className="border-t border-gray-100">
              {/* Loading state while this folder's documents are being fetched (skeleton rows) */}
              {loadingFolderIds.has(folder.id) && !docsByFolder[folder.id] && (
                <>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={`skeleton-${folder.id}-${i}`}
                      className="flex items-center gap-3 px-[18px] py-[9px]"
                      style={{ paddingLeft: `${18 + (depth + 1) * 26}px` }}
                    >
                      <Skeleton className="h-10 w-10 rounded-[9px]" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[50%] max-w-[360px] rounded" />
                        <Skeleton className="h-3 w-[20%] max-w-[140px] rounded" />
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Error state with retry, instead of a misleading empty folder */}
              {folderErrors[folder.id] && (
                <div
                  className="flex flex-wrap items-center gap-3 px-[18px] py-3 text-sm text-destructive"
                  style={{ paddingLeft: `${18 + (depth + 1) * 26}px` }}
                >
                  <span>Erreur de chargement : {folderErrors[folder.id]}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchFolderDocuments(folder.id, true);
                    }}
                  >
                    Réessayer
                  </Button>
                </div>
              )}

              {/* Recursive Subfolders - RENDERED FIRST */}
              {subFolders.length > 0 && renderFolderRecursive(subFolders, depth + 1)}

              {/* Documents in this folder - RENDERED LAST */}
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 border-t border-border px-[18px] py-[9px] transition-colors duration-150 hover:bg-pmn-hover"
                  style={{ paddingLeft: `${18 + (depth + 1) * 26}px` }} // Match subfolder indentation
                >
                  <FileTile name={doc.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <h4 className="truncate text-[14.5px] font-semibold text-pmn-ink">{doc.name}</h4>
                    <p className="mt-0.5 text-xs text-pmn-faint">
                      {format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr })}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDocument(doc);
                          setRenameValue(doc.name);
                          setIsRenameDialogOpen(true);
                        }}
                        disabled={!canRename(profile, doc)}
                        className="whitespace-nowrap cursor-pointer"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Renommer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(doc);
                        }}
                        className="whitespace-nowrap cursor-pointer"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDocument(doc);
                          setIsPreviewDialogOpen(true);
                        }}
                        className="whitespace-nowrap cursor-pointer"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Prévisualiser
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          openProperties('document', doc);
                        }}
                        className="whitespace-nowrap cursor-pointer"
                      >
                        <Info className="h-4 w-4 mr-2" />
                        Propriétés / Classer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          requestStatusToggle('document', doc);
                        }}
                        disabled={!canRename(profile, doc)}
                        className="whitespace-nowrap cursor-pointer"
                      >
                        {doc.status === 'Archive' ? (
                          <><ArchiveRestore className="h-4 w-4 mr-2" />Désarchiver</>
                        ) : (
                          <><ArchiveIcon className="h-4 w-4 mr-2" />Archiver</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDocument(doc);
                          setIsShareDialogOpen(true);
                        }}
                        className="whitespace-nowrap cursor-pointer"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Partager
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDocument(doc);
                          setMoveTargetFolderId(doc.folder_id || 'root');
                          setIsMoveDocumentDialogOpen(true);
                        }}
                        disabled={!canRename(profile, doc)}
                        className="whitespace-nowrap cursor-pointer"
                      >
                        <Folder className="h-4 w-4 mr-2" />
                        Déplacer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc);
                        }}
                        disabled={!canDelete(profile, doc)}
                        className="text-red-600 whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {/* "Dossier vide" uniquement lorsque le chargement est terminé sans erreur */}
              {subFolders.length === 0 &&
                docs.length === 0 &&
                !loadingFolderIds.has(folder.id) &&
                !folderErrors[folder.id] &&
                docsByFolder[folder.id] !== undefined && (
                  <div
                    className="px-[18px] py-3 text-sm italic text-pmn-faint"
                    style={{ paddingLeft: `${18 + (depth + 1) * 26}px` }}
                  >
                    Dossier vide
                  </div>
                )}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    // Squelette de chargement : même structure que la page (header + toolbar + arborescence)
    return (
      <div className="mx-auto max-w-[1320px] animate-fade-up space-y-[18px] px-6 pb-12 pt-[34px] md:px-10">
        <div>
          <Skeleton className="h-9 w-[420px] max-w-full rounded-lg" />
          <Skeleton className="mt-3 h-4 w-[320px] max-w-full rounded" />
        </div>
        <div className="surface flex items-center gap-3 p-3.5">
          <Skeleton className="h-11 flex-1 rounded-[11px]" />
          <Skeleton className="hidden h-11 w-[190px] rounded-[11px] md:block" />
          <Skeleton className="hidden h-11 w-[170px] rounded-[11px] md:block" />
          <Skeleton className="h-11 w-[150px] rounded-[11px]" />
        </div>
        <div className="surface overflow-hidden p-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-[rgba(20,33,28,.055)] px-[18px] py-[11px]">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-9 w-9 rounded-[9px]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[45%] max-w-[340px] rounded" />
                <Skeleton className="h-3 w-[25%] max-w-[180px] rounded" />
              </div>
              <Skeleton className="h-6 w-[72px] rounded-[20px]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] animate-fade-up space-y-[18px] px-6 pb-12 pt-[34px] md:px-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-semibold leading-tight tracking-[-.4px] text-pmn-ink-strong">
            Arborescence des documents
          </h1>
          <p className="mt-[5px] text-[15px] text-pmn-subtle">
            Organisez vos documents en dossiers et sous-dossiers
          </p>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="surface space-y-3 p-3.5">
      <div className="flex flex-col items-center gap-3 md:flex-row">
        <div className="relative flex w-full min-w-0 flex-1 items-center gap-2 md:min-w-[240px]">
          {aiMode ? (
            <>
              {/* Mode IA : saisie en langage naturel */}
              <div className="relative min-w-0 flex-1">
                <Sparkles className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-pmn-gold-dark" strokeWidth={2} />
                <Input
                  placeholder="Ex. : les appels d'offres F-PMN de 2024"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !aiLoading) runAiSearch();
                  }}
                  className="h-11 rounded-[11px] border-pmn-gold/40 bg-pmn-gold/[.06] pl-10 pr-12 text-sm focus:border-pmn-gold focus:ring-pmn-gold"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={runAiSearch}
                  disabled={aiLoading}
                  title="Lancer la recherche IA"
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] bg-pmn-gold text-[#3A2A00] transition-colors hover:bg-pmn-gold-deep disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          ) : (
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-pmn-faint" strokeWidth={2} />
              <Input
                placeholder="Rechercher un document..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 rounded-[11px] border-[rgba(20,33,28,.07)] bg-[#F6F5F0] pl-10 text-sm focus:border-pmn-green focus:ring-pmn-green"
              />
            </div>
          )}
          {/* Bascule Recherche IA */}
          <Button
            type="button"
            variant="outline"
            onClick={toggleAiMode}
            title={aiMode ? 'Revenir à la recherche classique' : 'Recherche intelligente (langage naturel)'}
            className={`h-11 flex-none gap-1.5 rounded-[11px] text-[13px] font-semibold transition-colors ${
              aiMode
                ? 'border-pmn-gold bg-pmn-gold/[.16] text-pmn-gold-dark hover:bg-pmn-gold/[.24] hover:text-pmn-gold-dark'
                : 'border-pmn-gold/40 bg-white text-pmn-gold-dark hover:bg-pmn-gold/[.08] hover:text-pmn-gold-dark'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden lg:inline">Recherche IA</span>
          </Button>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-11 w-full rounded-[11px] border-[rgba(20,33,28,.07)] bg-[#F6F5F0] text-sm font-medium text-pmn-text2 md:w-[190px]">
            <SelectValue placeholder="Toutes catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="h-11 w-full rounded-[11px] border-[rgba(20,33,28,.07)] bg-[#F6F5F0] text-sm font-medium text-pmn-text2 md:w-[170px]">
            <span className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-pmn-faint" />
              <SelectValue placeholder="Trier" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Nom (A → Z)</SelectItem>
            <SelectItem value="name-desc">Nom (Z → A)</SelectItem>
            <SelectItem value="date-desc">Plus récent</SelectItem>
            <SelectItem value="date-asc">Plus ancien</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex w-full gap-2 md:w-auto">
          <Button
            onClick={() => setIsNewFolderDialogOpen(true)}
            variant="outline"
            className="h-11 flex-1 rounded-[11px] border-pmn-green/30 bg-white text-sm font-semibold text-pmn-green hover:bg-pmn-green/[.06] hover:text-pmn-green md:flex-none"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Nouveau dossier
          </Button>
          <div className="flex h-11 gap-0.5 rounded-[11px] border border-[rgba(20,33,28,.07)] bg-[#F6F5F0] p-1">
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-[34px] rounded-lg ${viewMode === 'list' ? 'bg-white text-pmn-green shadow-card hover:bg-white hover:text-pmn-green' : 'text-pmn-faint2 hover:bg-transparent hover:text-pmn-subtle'}`}
              onClick={() => handleViewModeChange('list')}
              title="Liste"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-[34px] rounded-lg ${viewMode === 'large' ? 'bg-white text-pmn-green shadow-card hover:bg-white hover:text-pmn-green' : 'text-pmn-faint2 hover:bg-transparent hover:text-pmn-subtle'}`}
              onClick={() => handleViewModeChange('large')}
              title="Grandes icônes"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-[34px] rounded-lg ${viewMode === 'very-large' ? 'bg-white text-pmn-green shadow-card hover:bg-white hover:text-pmn-green' : 'text-pmn-faint2 hover:bg-transparent hover:text-pmn-subtle'}`}
              onClick={() => handleViewModeChange('very-large')}
              title="Très grandes icônes"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => router.push('/dashboard/upload')}
            className="h-11 flex-1 rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] text-sm font-semibold text-white shadow-cta transition-[filter] hover:brightness-110 md:flex-none"
          >
            <FilePlus className="h-4 w-4 mr-2" />
            Nouveau document
          </Button>
        </div>
      </div>

      {/* Rangée 2 : filtres combinables + développer/réduire */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(20,33,28,.06)] pt-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[130px] rounded-[9px] border-[rgba(20,33,28,.07)] bg-[#F6F5F0] text-[13px] font-medium text-pmn-text2">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="Archive">Archivé</SelectItem>
            <SelectItem value="Actif">Actif</SelectItem>
          </SelectContent>
        </Select>
        <Select value={exerciceFilter} onValueChange={setExerciceFilter}>
          <SelectTrigger className="h-9 w-[140px] rounded-[9px] border-[rgba(20,33,28,.07)] bg-[#F6F5F0] text-[13px] font-medium text-pmn-text2">
            <SelectValue placeholder="Exercice" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous exercices</SelectItem>
            {exerciceOptions.map(year => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rubriqueFilter} onValueChange={setRubriqueFilter}>
          <SelectTrigger className="h-9 w-[220px] rounded-[9px] border-[rgba(20,33,28,.07)] bg-[#F6F5F0] text-[13px] font-medium text-pmn-text2">
            <SelectValue placeholder="Rubrique" />
          </SelectTrigger>
          <SelectContent className="max-h-[280px]">
            <SelectItem value="all">Toutes rubriques</SelectItem>
            {CLASSIFICATION_PLAN.map(r => (
              <SelectItem key={r.code} value={r.code}>{r.code} – {r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(statusFilter !== 'all' || exerciceFilter !== 'all' || rubriqueFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-[13px] text-pmn-subtle hover:text-pmn-ink"
            onClick={() => {
              setStatusFilter('all');
              setExerciceFilter('all');
              setRubriqueFilter('all');
            }}
          >
            Réinitialiser
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={expandAll}
          className="h-9 gap-1.5 rounded-[9px] border-pmn-green/25 text-[13px] font-medium text-pmn-green hover:bg-pmn-green/[.06] hover:text-pmn-green"
        >
          <ChevronsDown className="h-4 w-4" />
          Tout développer
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={collapseAll}
          className="h-9 gap-1.5 rounded-[9px] border-[rgba(20,33,28,.1)] text-[13px] font-medium text-pmn-subtle hover:bg-pmn-hover"
        >
          <ChevronsUp className="h-4 w-4" />
          Tout réduire
        </Button>
      </div>
      </div>

      {/* ===== Résultats de la recherche intelligente (IA) ===== */}
      {aiMode && (aiLoading || aiResults !== null) ? (
        <div className="surface overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-pmn-ink">
              <Sparkles className="h-4 w-4 text-pmn-gold-dark" />
              {aiLoading
                ? "L'assistant analyse vos archives…"
                : `${aiResults?.length ?? 0} résultat(s) — recherche intelligente`}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-[13px] text-pmn-subtle hover:text-pmn-ink"
              onClick={() => {
                setAiResults(null);
                setAiSynthese(null);
              }}
            >
              Effacer
            </Button>
          </div>

          {aiLoading ? (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-[rgba(20,33,28,.055)] px-[18px] py-[11px]">
                  <Skeleton className="h-10 w-10 rounded-[9px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[45%] rounded" />
                    <Skeleton className="h-3 w-[60%] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {aiSynthese && (
                <div className="border-b border-border bg-pmn-gold/[.06] px-[18px] py-3 text-sm text-pmn-text2">
                  <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-pmn-gold-dark" />
                  {aiSynthese}
                </div>
              )}
              {(aiResults?.length ?? 0) === 0 ? (
                <div className="px-[18px] py-10 text-center text-sm text-pmn-faint">
                  <p>Aucun résultat pour cette recherche.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-9 rounded-[9px] border-pmn-green/25 text-[13px] font-medium text-pmn-green hover:bg-pmn-green/[.06] hover:text-pmn-green"
                    onClick={() => {
                      const q = aiQuery.trim();
                      setAiMode(false);
                      setAiResults(null);
                      setSearchTerm(q);
                    }}
                  >
                    Essayer la recherche classique
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-[rgba(20,33,28,.055)]">
                  {aiResults?.map(result => (
                    <button
                      key={`ai-${result.objectId}`}
                      onClick={() => handleAiResultClick(result)}
                      className="flex w-full items-center gap-3 px-[18px] py-[10px] text-left transition-colors hover:bg-pmn-hover"
                    >
                      {result.type === 'dossier' ? (
                        <FolderGlyph size={36} />
                      ) : (
                        <FileTile name={result.name} size={36} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-[9px]">
                          {result.folder_number && (
                            <span className="flex-none rounded-[5px] border border-[rgba(20,33,28,.06)] bg-[#F1F0EB] px-1.5 py-0.5 font-mono text-[11px] text-pmn-faint2">
                              {result.folder_number}
                            </span>
                          )}
                          <span className="truncate text-[14.5px] font-semibold text-pmn-ink">{result.name}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-pmn-faint">📁 {result.path}</p>
                        {result.raison && (
                          <p className="mt-1 text-xs italic text-pmn-gold-dark">
                            <Sparkles className="mr-1 inline h-3 w-3" />
                            {result.raison}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-none items-center gap-1.5">
                        {result.rubrique && (
                          <span className="rounded-[20px] bg-pmn-green/[.08] px-2 py-0.5 text-[11px] font-semibold text-pmn-green">
                            {result.rubrique}
                          </span>
                        )}
                        {result.category && (
                          <span className="hidden rounded-[20px] bg-pmn-gold/[.14] px-2 py-0.5 text-[11px] font-semibold text-pmn-gold-dark sm:inline">
                            {result.category}
                          </span>
                        )}
                        {result.createdAt && (
                          <span className="hidden text-xs text-pmn-faint md:inline">
                            {format(new Date(result.createdAt), 'dd/MM/yyyy', { locale: fr })}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : deepSearchActive ? (
        <div className="surface overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
            <p className="text-sm font-semibold text-pmn-ink">
              {searching ? (
                <span className="flex items-center gap-2 text-pmn-subtle">
                  <Loader2 className="h-4 w-4 animate-spin" /> Recherche en cours…
                </span>
              ) : (
                <>
                  {(searchResults?.folders.length ?? 0) + (searchResults?.documents.length ?? 0)}
                  {searchHasMore ? '+' : ''} résultat(s) pour « {searchTerm.trim()} »
                  <span className="ml-2 font-normal text-pmn-faint">— toute l&apos;arborescence</span>
                </>
              )}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-[13px] text-pmn-subtle hover:text-pmn-ink"
              onClick={() => setSearchTerm('')}
            >
              Effacer
            </Button>
          </div>

          {searching && !searchResults ? (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-[rgba(20,33,28,.055)] px-[18px] py-[11px]">
                  <Skeleton className="h-10 w-10 rounded-[9px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[45%] rounded" />
                    <Skeleton className="h-3 w-[30%] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {(searchResults?.folders.length ?? 0) === 0 && (searchResults?.documents.length ?? 0) === 0 ? (
                <div className="px-[18px] py-10 text-center text-sm text-pmn-faint">
                  Aucun résultat pour « {searchTerm.trim()} »
                  {(statusFilter !== 'all' || exerciceFilter !== 'all' || rubriqueFilter !== 'all' || categoryFilter !== 'all') &&
                    ' avec les filtres actifs'}
                </div>
              ) : (
                <div className="divide-y divide-[rgba(20,33,28,.055)]">
                  {/* Dossiers trouvés */}
                  {searchResults?.folders.map(folder => (
                    <button
                      key={`sf-${folder.id}`}
                      onClick={() => revealInTree(folder.id)}
                      className="flex w-full items-center gap-3 px-[18px] py-[10px] text-left transition-colors hover:bg-pmn-hover"
                    >
                      <FolderGlyph size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-[9px]">
                          {folder.folder_number && (
                            <span className="flex-none rounded-[5px] border border-[rgba(20,33,28,.06)] bg-[#F1F0EB] px-1.5 py-0.5 font-mono text-[11px] text-pmn-faint2">
                              {folder.folder_number}
                            </span>
                          )}
                          <span className="truncate text-[14.5px] font-semibold text-pmn-ink">{folder.name}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-pmn-faint">
                          📁 {getResultPath(folder.parent_id)}
                        </p>
                      </div>
                      <div className="flex flex-none items-center gap-1.5">
                        {folder.rubrique && (
                          <span className="rounded-[20px] bg-pmn-green/[.08] px-2 py-0.5 text-[11px] font-semibold text-pmn-green">
                            {folder.rubrique}
                          </span>
                        )}
                        {folder.category && (
                          <span className="hidden rounded-[20px] bg-pmn-gold/[.14] px-2 py-0.5 text-[11px] font-semibold text-pmn-gold-dark sm:inline">
                            {folder.category}
                          </span>
                        )}
                        <span className="hidden text-xs text-pmn-faint md:inline">
                          {format(new Date(folder.createdAt), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      </div>
                    </button>
                  ))}

                  {/* Documents trouvés */}
                  {searchResults?.documents.map(doc => (
                    <button
                      key={`sd-${doc.id}`}
                      onClick={() => revealInTree(doc.folder_id ?? null)}
                      className="flex w-full items-center gap-3 px-[18px] py-[10px] text-left transition-colors hover:bg-pmn-hover"
                    >
                      <FileTile name={doc.name} size={36} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold text-pmn-ink">{doc.name}</span>
                        <p className="mt-0.5 truncate text-xs text-pmn-faint">
                          📁 {getResultPath(doc.folder_id)}
                        </p>
                      </div>
                      <div className="flex flex-none items-center gap-1.5">
                        {doc.rubrique && (
                          <span className="rounded-[20px] bg-pmn-green/[.08] px-2 py-0.5 text-[11px] font-semibold text-pmn-green">
                            {doc.rubrique}
                          </span>
                        )}
                        {doc.category && (
                          <span className="hidden rounded-[20px] bg-pmn-gold/[.14] px-2 py-0.5 text-[11px] font-semibold text-pmn-gold-dark sm:inline">
                            {doc.category}
                          </span>
                        )}
                        <span className="hidden text-xs text-pmn-faint md:inline">
                          {format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      </div>
                    </button>
                  ))}

                  {/* Pagination */}
                  {searchHasMore && (
                    <div className="flex justify-center px-[18px] py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loadingMore}
                        onClick={loadMoreSearchResults}
                        className="h-9 rounded-[9px] border-pmn-green/25 text-[13px] font-medium text-pmn-green hover:bg-pmn-green/[.06] hover:text-pmn-green"
                      >
                        {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Afficher plus de résultats
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : filteredFolders.length === 0 && filteredDocuments.length === 0 ? (
        <div className="surface p-12">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-pmn-green/[.09] text-pmn-green">
              <FileText className="h-8 w-8" strokeWidth={1.7} />
            </div>
            <h3 className="mb-2 text-[17px] font-bold text-pmn-ink">
              Aucun document disponible pour le moment
            </h3>
            <p className="mb-6 text-[13.5px] text-pmn-faint">
              Commencez par créer un dossier ou uploader vos premiers documents
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                onClick={() => setIsNewFolderDialogOpen(true)}
                className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Créer un dossier
              </Button>
              <Button
                onClick={() => router.push('/dashboard/upload')}
                className="rounded-[11px] bg-pmn-gold font-semibold text-[#3A2A00] hover:bg-pmn-gold-deep"
              >
                <Upload className="h-4 w-4 mr-2" />
                Uploader un fichier
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Card className="surface overflow-hidden rounded-[16px] border-0 p-0">
          {viewMode === 'list' ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={folders.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="divide-y divide-[rgba(20,33,28,.055)]">
                  {/* Folders List View */}
                  {/* Recursive Folder Rendering */}
                  {renderFolderRecursive(filteredFolders)}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDragId ? (
                  <div className="rounded-[11px] border border-pmn-gold/40 bg-white p-3 opacity-90 shadow-card-hover">
                    <div className="flex items-center gap-3">
                      <FolderGlyph size={28} />
                      <span className="text-[14.5px] font-semibold text-pmn-ink">
                        {folders.find(f => f.id === activeDragId)?.name}
                      </span>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div>
              {/* Fil d'Ariane de navigation (drill-down grille) */}
              <div className="flex flex-wrap items-center gap-1 border-b border-border px-[18px] py-3 text-sm">
                <button
                  type="button"
                  onClick={() => gridNavigateTo(-1)}
                  className={`rounded-md px-2 py-1 font-medium transition-colors ${gridPath.length === 0 ? 'text-pmn-ink' : 'text-pmn-green hover:bg-pmn-green/[.06]'}`}
                >
                  Racine
                </button>
                {gridPath.map((seg, i) => {
                  const live = folders.find(f => f.id === seg.id);
                  const label = live?.name || seg.name;
                  const isLast = i === gridPath.length - 1;
                  return (
                    <span key={seg.id} className="flex items-center gap-1">
                      <ChevronRight className="h-3.5 w-3.5 text-pmn-faint" strokeWidth={2} />
                      <button
                        type="button"
                        onClick={() => gridNavigateTo(i)}
                        className={`max-w-[220px] truncate rounded-md px-2 py-1 font-medium transition-colors ${isLast ? 'text-pmn-ink' : 'text-pmn-green hover:bg-pmn-green/[.06]'}`}
                        title={label}
                      >
                        {label}
                      </button>
                    </span>
                  );
                })}
              </div>

              {/* Chargement du contenu du dossier courant */}
              {gridLoading ? (
                <div className={`grid gap-4 p-[18px] ${viewMode === 'very-large' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-[16px] border border-border bg-white p-[18px] shadow-card">
                      <Skeleton className="h-12 w-12 rounded-[9px]" />
                      <Skeleton className="mt-4 h-4 w-[70%] rounded" />
                      <Skeleton className="mt-2 h-3 w-[40%] rounded" />
                    </div>
                  ))}
                </div>
              ) : gridFolders.length === 0 && gridDocuments.length === 0 ? (
                <div className="px-[18px] py-16 text-center text-sm italic text-pmn-faint">
                  Dossier vide
                </div>
              ) : (
                <div className={`grid gap-4 p-[18px] ${viewMode === 'very-large' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
              {/* Folders Grid */}
              {gridFolders.map((folder) => (
                <Card
                  key={folder.id}
                  className="group relative cursor-pointer rounded-[16px] border border-border bg-white p-0 shadow-card transition-all duration-200 hover:border-pmn-green/[.35] hover:shadow-card-hover"
                  onClick={() => enterFolderGrid(folder)}
                >
                  <CardContent className="p-[18px]">
                    <div className="flex items-center justify-between">
                      <FolderGlyph size={viewMode === 'very-large' ? 64 : 48} />
                      <span className="pill-archive rounded-[20px] px-2.5 py-[3px] text-[11.5px] font-semibold">
                        {folder.status === 'Archive' || !folder.status ? 'Archivé' : folder.status}
                      </span>
                    </div>

                    <div className="mt-3.5 w-full space-y-2">
                      {folder.folder_number && (
                        <span className="inline-block rounded-[5px] border border-[rgba(20,33,28,.06)] bg-[#F1F0EB] px-1.5 py-0.5 font-mono text-[11px] text-pmn-faint2">
                          {folder.folder_number}
                        </span>
                      )}
                      <h3 className={`w-full truncate font-semibold leading-tight text-pmn-ink ${viewMode === 'very-large' ? 'text-[17px]' : 'text-[15px]'}`}>
                        {folder.name}
                      </h3>
                      <p className="flex items-center gap-1.5 text-xs text-pmn-faint">
                        {format(new Date(folder.createdAt), 'dd/MM/yyyy', { locale: fr })}
                        {' · '}
                        {(() => {
                          const subCount = getSubFolders(folder.id).length;
                          const docCount = getDocCount(folder.id);
                          return docCount !== undefined
                            ? `${subCount + docCount} éléments`
                            : `${subCount} sous-dossier${subCount > 1 ? 's' : ''}`;
                        })()}
                      </p>
                      <p className="text-xs text-pmn-faint">{folder.category || 'Non classé'}</p>
                    </div>

                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setSelectedFolder(folder); setRenameValue(folder.name); setIsRenameDialogOpen(true); }}
                            disabled={!canRename(profile, folder)}
                            className="cursor-pointer"
                          >
                            <Edit className="h-4 w-4 mr-2" /> Renommer
                          </DropdownMenuItem>
                          {['admin', 'super_admin'].includes(profile?.role || '') && (
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setSelectedFolder(folder); setNewFolderNumber(folder.folder_number || ''); setIsModifyNumberDialogOpen(true); }}
                              className="cursor-pointer"
                            >
                              <Hash className="h-4 w-4 mr-2" /> Modifier numéro
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadFolder(folder); }} className="cursor-pointer">
                            <Download className="h-4 w-4 mr-2" /> Télécharger
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openProperties('folder', folder); }} className="cursor-pointer">
                            <Info className="h-4 w-4 mr-2" /> Propriétés / Détails
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openProperties('folder', folder); }} className="cursor-pointer">
                            <Tags className="h-4 w-4 mr-2" /> Classer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); requestStatusToggle('folder', folder); }}
                            disabled={!canRename(profile, folder)}
                            className="cursor-pointer"
                          >
                            {folder.status === 'Archive'
                              ? (<><ArchiveRestore className="h-4 w-4 mr-2" />Désarchiver</>)
                              : (<><ArchiveIcon className="h-4 w-4 mr-2" />Archiver</>)}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShareFolder(folder); }} className="cursor-pointer">
                            <Share2 className="h-4 w-4 mr-2" /> Partager
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setFolderToMove(folder); setMoveFolderTargetId(folder.parent_id || 'root'); setIsMoveFolderDialogOpen(true); }}
                            disabled={!canMoveFolder(profile, folder)}
                            className="cursor-pointer"
                          >
                            <FolderInput className="h-4 w-4 mr-2" /> Déplacer vers…
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setParentFolder(folder); setIsNewSubFolderDialogOpen(true); }} className="cursor-pointer">
                            <FolderPlus className="h-4 w-4 mr-2" /> Nouveau sous-dossier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                            disabled={!canDelete(profile, folder)}
                            className="text-red-600 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Documents Grid */}
              {gridDocuments.map((doc) => (
                <Card
                  key={doc.id}
                  className="group relative cursor-pointer rounded-[16px] border border-border bg-white p-0 shadow-card transition-all duration-200 hover:border-pmn-green/[.35] hover:shadow-card-hover"
                  onClick={() => {
                    setSelectedDocument(doc);
                    setIsPreviewDialogOpen(true);
                  }}
                >
                  <CardContent className="p-[18px]">
                    <FileTile name={doc.name} size={viewMode === 'very-large' ? 64 : 48} />

                    <div className="mt-3.5 w-full space-y-2">
                      <h3 className={`w-full truncate font-semibold leading-tight text-pmn-ink ${viewMode === 'very-large' ? 'text-[17px]' : 'text-[15px]'}`}>
                        {doc.name}
                      </h3>
                      <p className="text-xs text-pmn-faint">
                        {format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>

                    {/* Actions rapides au survol : Prévisualiser + Télécharger */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-white/80 backdrop-blur-sm hover:bg-white"
                        title="Prévisualiser"
                        onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setIsPreviewDialogOpen(true); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-white/80 backdrop-blur-sm hover:bg-white"
                        title="Télécharger"
                        onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 backdrop-blur-sm hover:bg-white" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setIsPreviewDialogOpen(true); }} className="cursor-pointer">
                            <Eye className="h-4 w-4 mr-2" /> Prévisualiser
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(doc); }} className="cursor-pointer">
                            <Download className="h-4 w-4 mr-2" /> Télécharger
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setIsShareDialogOpen(true); }} className="cursor-pointer">
                            <Share2 className="h-4 w-4 mr-2" /> Partager
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setRenameValue(doc.name); setIsRenameDialogOpen(true); }}
                            disabled={!canRename(profile, doc)}
                            className="cursor-pointer"
                          >
                            <Edit className="h-4 w-4 mr-2" /> Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setMoveTargetFolderId(doc.folder_id || 'root'); setIsMoveDocumentDialogOpen(true); }}
                            disabled={!canRename(profile, doc)}
                            className="cursor-pointer"
                          >
                            <Folder className="h-4 w-4 mr-2" /> Déplacer vers…
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openProperties('document', doc); }} className="cursor-pointer">
                            <Info className="h-4 w-4 mr-2" /> Propriétés / Classer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); requestStatusToggle('document', doc); }}
                            disabled={!canRename(profile, doc)}
                            className="cursor-pointer"
                          >
                            {doc.status === 'Archive'
                              ? (<><ArchiveRestore className="h-4 w-4 mr-2" />Désarchiver</>)
                              : (<><ArchiveIcon className="h-4 w-4 mr-2" />Archiver</>)}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc); }}
                            disabled={!canDelete(profile, doc)}
                            className="text-red-600 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Renommer l'élément</DialogTitle>
            <DialogDescription>
              Entrez le nouveau nom pour cet élément.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rename-input">Nouveau nom *</Label>
              <Input
                id="rename-input"
                placeholder="Nouveau nom"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="mt-2"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRename} className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110">
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-pmn-green">
              <FolderPlus className="h-5 w-5 mr-2" />
              Créer un nouveau dossier
            </DialogTitle>
            <DialogDescription>
              Organisez vos documents en créant un nouveau dossier
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="folder-name">Nom du dossier *</Label>
              <Input
                id="folder-name"
                placeholder="Ex: DRP SIMPLE2025"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="folder-category">Catégorie</Label>
              <Select value={newFolderCategory} onValueChange={setNewFolderCategory}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFolderDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateFolder} className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110">
              <FolderPlus className="h-4 w-4 mr-2" />
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New SubFolder Dialog */}
      <Dialog open={isNewSubFolderDialogOpen} onOpenChange={setIsNewSubFolderDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-pmn-green">
              <FolderPlus className="h-5 w-5 mr-2" />
              Créer un nouveau sous-dossier
            </DialogTitle>
            <DialogDescription>
              Créer un sous-dossier dans "{parentFolder?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="subfolder-name">Nom du sous-dossier *</Label>
              <Input
                id="subfolder-name"
                placeholder="Ex: Documents 2025"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="mt-2"
                autoFocus
              />
            </div>
            {parentFolder && (
              <div className="rounded-[11px] border border-pmn-green/20 bg-pmn-green/[.06] p-3">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Dossier parent :</span> {parentFolder.name}
                </p>
                {parentFolder.category && (
                  <p className="text-sm text-blue-700 mt-1">
                    <span className="font-semibold">Catégorie :</span> {parentFolder.category}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsNewSubFolderDialogOpen(false);
                setNewFolderName('');
                setParentFolder(null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleCreateSubFolder} className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110">
              <FolderPlus className="h-4 w-4 mr-2" />
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-pmn-green">
              <Eye className="h-5 w-5 mr-2" />
              {selectedFolder ? 'Détails du dossier' : 'Détails du document'}
            </DialogTitle>
          </DialogHeader>
          {selectedFolder && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-bold text-gray-500">Nom :</Label>
                <div className="col-span-3 font-medium">{selectedFolder.name}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-bold text-gray-500">Catégorie :</Label>
                <div className="col-span-3">
                  <Badge variant="secondary">{selectedFolder.category || 'Aucune'}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-bold text-gray-500">Créé le :</Label>
                <div className="col-span-3">
                  {format(new Date(selectedFolder.createdAt), 'dd MMMM yyyy', { locale: fr })}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-bold text-gray-500">Statut :</Label>
                <div className="col-span-3">
                  <Badge variant="outline" className={selectedFolder.status === 'Archive' ? 'bg-red-50 text-red-700' : ''}>
                    {selectedFolder.status || 'Actif'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
          {selectedDocument && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-bold text-gray-500">Nom :</Label>
                <div className="col-span-3 font-medium truncate">{selectedDocument.name}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-bold text-gray-500">Catégorie :</Label>
                <div className="col-span-3">
                  <Badge variant="secondary">{selectedDocument.category || 'Aucune'}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-bold text-gray-500">Créé le :</Label>
                <div className="col-span-3">
                  {format(new Date(selectedDocument.createdAt), 'dd MMMM yyyy', { locale: fr })}
                </div>
              </div>
              {selectedDocument.file?.url && (
                <div className="flex justify-end mt-4">
                  <Button onClick={() => window.open(selectedDocument.file.url, '_blank')} className="w-full">
                    <Eye className="h-4 w-4 mr-2" />
                    Ouvrir le fichier
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsPreviewDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-pmn-green">
              <Share2 className="h-5 w-5 mr-2" />
              Partager le document
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un utilisateur et définissez les permissions d'accès
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* User Selection */}
            <div className="space-y-2">
              <Label htmlFor="share-user">Partager avec</Label>
              <Select value={selectedShareUser} onValueChange={setSelectedShareUser}>
                <SelectTrigger id="share-user">
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permissions */}
            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="perm-read"
                    checked={sharePermissions.can_read}
                    disabled
                  />
                  <label htmlFor="perm-read" className="text-sm font-medium cursor-not-allowed opacity-70">
                    Lecture (obligatoire)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="perm-write"
                    checked={sharePermissions.can_write}
                    onCheckedChange={(checked: boolean) =>
                      setSharePermissions({ ...sharePermissions, can_write: !!checked })
                    }
                  />
                  <label htmlFor="perm-write" className="text-sm font-medium cursor-pointer">
                    Modification
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="perm-delete"
                    checked={sharePermissions.can_delete}
                    onCheckedChange={(checked: boolean) =>
                      setSharePermissions({ ...sharePermissions, can_delete: !!checked })
                    }
                  />
                  <label htmlFor="perm-delete" className="text-sm font-medium cursor-pointer">
                    Suppression
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="perm-share"
                    checked={sharePermissions.can_share}
                    onCheckedChange={(checked: boolean) =>
                      setSharePermissions({ ...sharePermissions, can_share: !!checked })
                    }
                  />
                  <label htmlFor="perm-share" className="text-sm font-medium cursor-pointer">
                    Partage
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleShareDocument} disabled={!selectedShareUser}>
              <Share2 className="h-4 w-4 mr-2" />
              Partager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Folder Number Dialog */}
      <Dialog open={isModifyNumberDialogOpen} onOpenChange={setIsModifyNumberDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-pmn-green">
              <Hash className="h-5 w-5 mr-2" />
              Modifier le numéro du dossier
            </DialogTitle>
            <DialogDescription>
              Modifiez le numéro d'identification du dossier "{selectedFolder?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="folder-number">Numéro du dossier *</Label>
              <Input
                id="folder-number"
                placeholder="D-0001"
                value={newFolderNumber}
                onChange={(e) => setNewFolderNumber(e.target.value)}
                className="mt-2 font-mono"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Format requis : D-XXXX (ex: D-0023)
              </p>
            </div>
            {selectedFolder?.folder_number && (
              <div className="rounded-[11px] border border-pmn-green/20 bg-pmn-green/[.06] p-3">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Numéro actuel :</span> {selectedFolder.folder_number}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsModifyNumberDialogOpen(false);
              setNewFolderNumber('');
              setSelectedFolder(null);
            }}>
              Annuler
            </Button>
            <Button onClick={handleModifyFolderNumber} className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110">
              <Hash className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <Trash2 className="h-5 w-5 mr-2" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription className="break-words">
              Êtes-vous sûr de vouloir supprimer {itemToDelete?.type === 'folder' ? 'le dossier' : 'le document'}{' '}
              <strong className="break-all">"{itemToDelete?.name}"</strong> ?
            </DialogDescription>
          </DialogHeader>
          {itemToDelete?.type === 'folder' && (() => {
            const subCount = folders.filter(f => f.parent_id === itemToDelete.id).length;
            const docCount = getDocCount(itemToDelete.id);
            const isEmpty = subCount === 0 && docCount === 0;
            if (isEmpty) {
              return (
                <p className="text-sm text-pmn-faint">Ce dossier est vide.</p>
              );
            }
            return (
              <div className="rounded-[11px] border border-pmn-gold/30 bg-pmn-gold/[.08] p-3 text-sm text-pmn-gold-dark">
                <p className="font-semibold">
                  Ce dossier contient {docCount !== undefined ? `${docCount} document(s)` : 'des documents'} et {subCount} sous-dossier(s).
                </p>
                <p className="mt-1">
                  Son contenu ne sera pas supprimé automatiquement : déplacez ou supprimez
                  d&apos;abord son contenu si nécessaire.
                </p>
              </div>
            );
          })()}
          <p className="text-sm text-pmn-faint">Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Confirmation de déplacement (drag & drop) ===== */}
      <Dialog
        open={pendingMove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingMove(null);
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-pmn-green">
              <FolderInput className="h-5 w-5 mr-2" />
              Déplacer le dossier ?
            </DialogTitle>
            <DialogDescription className="break-words pt-2">
              Déplacer <strong className="break-all text-pmn-ink">« {pendingMove?.folder.name} »</strong>{' '}
              {pendingMove?.targetId ? (
                <>dans <strong className="break-all text-pmn-ink">« {pendingMove?.targetName} »</strong> ?</>
              ) : (
                <>à la <strong className="text-pmn-ink">racine</strong> ?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-pmn-faint">
            Vous pourrez annuler ce déplacement pendant 10 secondes après confirmation.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                if (!pendingMove) return;
                const { folder, targetId, targetName } = pendingMove;
                setPendingMove(null);
                await executeMove(folder, targetId, targetName);
              }}
              className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110"
            >
              <FolderInput className="h-4 w-4 mr-2" />
              Confirmer le déplacement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== « Déplacer vers… » : sélecteur de destination ===== */}
      <Dialog
        open={isMoveFolderDialogOpen}
        onOpenChange={(open) => {
          setIsMoveFolderDialogOpen(open);
          if (!open) {
            setFolderToMove(null);
            setMoveFolderTargetId('root');
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-pmn-green">
              <FolderInput className="h-5 w-5 mr-2" />
              Déplacer le dossier
            </DialogTitle>
            <DialogDescription className="break-words">
              Choisissez la destination de <strong className="break-all">« {folderToMove?.name} »</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="move-folder-target">Dossier de destination</Label>
              <Select value={moveFolderTargetId} onValueChange={setMoveFolderTargetId}>
                <SelectTrigger id="move-folder-target" className="w-full">
                  <SelectValue placeholder="Sélectionner une destination" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="root">
                    <span className="italic text-pmn-subtle">Racine (aucun dossier parent)</span>
                  </SelectItem>
                  {(() => {
                    if (!folderToMove) return null;
                    // Exclure le dossier lui-même et tous ses descendants
                    const excluded = getDescendantIds(folderToMove.id);
                    excluded.add(folderToMove.id);
                    return folderOptions
                      .filter(option => !excluded.has(option.id))
                      .map(option => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.path}
                        </SelectItem>
                      ));
                  })()}
                </SelectContent>
              </Select>
              <p className="text-xs text-pmn-faint">
                Position actuelle :{' '}
                {folderToMove?.parent_id
                  ? getFolderPath(folderToMove.parent_id) || 'dossier parent'
                  : 'Racine'}
                {' '}· Le dossier lui-même et ses sous-dossiers sont exclus des destinations.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsMoveFolderDialogOpen(false);
                setFolderToMove(null);
                setMoveFolderTargetId('root');
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={confirmMoveFolderDialog}
              className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110"
            >
              <FolderInput className="h-4 w-4 mr-2" />
              Confirmer le déplacement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Document Dialog */}
      <Dialog open={isMoveDocumentDialogOpen} onOpenChange={setIsMoveDocumentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-pmn-green">
              <Folder className="h-5 w-5 mr-2" />
              Déplacer le document
            </DialogTitle>
            <DialogDescription>
              Sélectionnez le dossier de destination pour "{selectedDocument?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="destination-folder">Dossier de destination</Label>
              <Select value={moveTargetFolderId} onValueChange={setMoveTargetFolderId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un dossier" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="root">
                    <span className="text-gray-500 italic">Racine (aucun dossier)</span>
                  </SelectItem>
                  {folderOptions.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveDocumentDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleMoveDocument} className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110">
              Déplacer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Panneau Propriétés / Classer ===== */}
      <PropertiesPanel
        open={isPropertiesOpen}
        onOpenChange={(open) => {
          setIsPropertiesOpen(open);
          if (!open) setPropertiesItem(null);
        }}
        item={propertiesItem}
        canEdit={propertiesItem ? canRename(profile, propertiesItem.data) : false}
        isAdmin={['admin', 'super_admin'].includes(profile?.role || '')}
        onSaved={handlePropertiesSaved}
      />

      {/* ===== Confirmation Archiver / Désarchiver ===== */}
      <Dialog
        open={statusToggleItem !== null}
        onOpenChange={(open) => {
          if (!open) setStatusToggleItem(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-pmn-green">
              {statusToggleItem?.data?.status === 'Archive' ? (
                <><ArchiveRestore className="h-5 w-5 mr-2" />Désarchiver ?</>
              ) : (
                <><ArchiveIcon className="h-5 w-5 mr-2" />Archiver ?</>
              )}
            </DialogTitle>
            <DialogDescription className="break-words pt-2">
              {statusToggleItem?.data?.status === 'Archive' ? (
                <>Rendre <strong className="break-all text-pmn-ink">« {statusToggleItem?.data?.name} »</strong> actif ?</>
              ) : (
                <>Marquer <strong className="break-all text-pmn-ink">« {statusToggleItem?.data?.name} »</strong> comme archivé ?</>
              )}
              {' '}Seul le statut de cet élément sera modifié.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusToggleItem(null)}>
              Annuler
            </Button>
            <Button
              onClick={confirmStatusToggle}
              className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110"
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
