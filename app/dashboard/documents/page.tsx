'use client';

import { useEffect, useState } from 'react';
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
  Hash
} from 'lucide-react';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableFolderRow } from '@/components/sortable-folder-row';


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
      activationConstraint: {
        distance: 8,
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
    if (profile) {
      fetchFolders();
      fetchDocuments();
      fetchUsers();
    }
  }, [profile]);

  const handleViewModeChange = (mode: 'list' | 'large' | 'very-large') => {
    setViewMode(mode);
    localStorage.setItem('pmn_folder_view_mode', mode);
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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? (over.id as string) : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setOverId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const draggedFolder = folders.find(f => f.id === active.id);
    const targetFolder = folders.find(f => f.id === over.id);

    if (!draggedFolder) return;

    // Check permissions
    if (!canMoveFolder(profile, draggedFolder)) {
      toast.error('Vous n\'avez pas la permission de déplacer ce dossier');
      return;
    }

    try {
      // Determine if this is a REORDER or REPARENT operation
      // REORDER: Both folders have the same parent (siblings) - just changing position
      // REPARENT: Dropping onto a folder with different parent - moving INTO that folder

      const sameParent = draggedFolder.parent_id === targetFolder?.parent_id;

      if (targetFolder && !sameParent) {
        // REPARENT: Move INTO target folder (different parent)
        console.log(`🔄 Reparenting: Moving "${draggedFolder.name}" into "${targetFolder.name}"`);
        console.log(`   Current parent: ${draggedFolder.parent_id || 'root'} → New parent: ${targetFolder.id}`);

        const newParentId = targetFolder.id;

        // 1. Expand parent folder FIRST
        setExpandedFolders(prev => {
          const newExpanded = new Set(prev);
          newExpanded.add(newParentId);
          console.log('Expanded folders:', Array.from(newExpanded));
          return newExpanded;
        });

        // 2. Make API call with cycle detection
        await FolderHelpers.move(draggedFolder.id, newParentId);
        console.log('Folder moved successfully in database');

        // 3. Refresh folders from server
        await fetchFolders();
        console.log('Folders refreshed from server');

        // 4. Ensure parent stays expanded after refresh
        setExpandedFolders(prev => {
          const newExpanded = new Set(prev);
          newExpanded.add(newParentId);
          return newExpanded;
        });

        // 5. Show success message for REPARENTING
        toast.success(`Dossier déplacé dans "${targetFolder.name}"`);

      } else {
        // REORDER: Just changing position among siblings (same parent)
        console.log(`↕️ Reordering: Moving "${draggedFolder.name}" to new position`);
        console.log(`   Parent remains: ${draggedFolder.parent_id || 'root'}`);

        const oldIndex = folders.findIndex(f => f.id === active.id);
        const newIndex = folders.findIndex(f => f.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          setFolders(arrayMove(folders, oldIndex, newIndex));
          // Show success message for REORDERING
          toast.success('Position du dossier modifiée');
        }
      }
    } catch (error: any) {
      console.error('Error in drag operation:', error);

      // Refresh to restore correct state
      await fetchFolders();

      if (error.message?.includes('sous-dossiers')) {
        toast.error('Impossible de déplacer un dossier dans un de ses sous-dossiers');
      } else if (error.message?.includes('lui-même')) {
        toast.error('Impossible de déplacer un dossier dans lui-même');
      } else {
        toast.error('Erreur lors de l\'opération');
      }
    }
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
    return docsByFolder[folderId] ?? [];
  };

  const getSubFolders = (parentId: string) => {
    return folders.filter(folder => folder.parent_id === parentId);
  };

  const filteredFolders = folders.filter(folder => {
    const matchesSearch = folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      folder.folder_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || folder.category === categoryFilter;
    return matchesSearch && matchesCategory && !folder.parent_id;
  });

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory && !doc.folder_id;
  });

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
            style={{ paddingLeft: `${Math.min(depth * 1.5 + 1, 8)}rem` }} // Dynamic padding
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
                    setSelectedFolder(folder);
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
              {/* Loading state while this folder's documents are being fetched */}
              {loadingFolderIds.has(folder.id) && !docsByFolder[folder.id] && (
                <div
                  className="p-4 text-sm text-gray-500 flex items-center gap-2"
                  style={{ paddingLeft: `${Math.min((depth + 1) * 1.5 + 1, 8)}rem` }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement des documents...
                </div>
              )}

              {/* Error state with retry, instead of a misleading empty folder */}
              {folderErrors[folder.id] && (
                <div
                  className="p-4 text-sm text-red-600 flex items-center gap-3 flex-wrap"
                  style={{ paddingLeft: `${Math.min((depth + 1) * 1.5 + 1, 8)}rem` }}
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
                  className="flex items-center gap-3 p-4 hover:bg-gray-100 transition-colors border-t border-gray-100"
                  style={{ paddingLeft: `${Math.min((depth + 1) * 1.5 + 1, 8)}rem` }} // Match subfolder indentation
                >
                  <FileText className="h-5 w-5 text-gray-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{doc.name}</h4>
                    <p className="text-sm text-gray-500">
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
                    className="p-4 text-sm text-gray-500 italic"
                    style={{ paddingLeft: `${Math.min((depth + 1) * 1.5 + 1, 8)}rem` }}
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
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center mb-4 shadow-lg">
            <span className="text-2xl font-bold text-white">PMN</span>
          </div>
          <Loader2 className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-8 w-8 animate-spin text-green-600" />
        </div>
        <p className="text-gray-600 mt-6 font-medium">Chargement des documents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Arborescence des Documents</h1>
          <p className="text-gray-600 mt-1">Organisez vos documents en dossiers et sous-dossiers</p>
        </div>
      </div>

      {/* Search and Actions */}
      <Card className="p-4 border-0 shadow-md bg-white">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Rechercher un document..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-[200px] bg-gray-50 border-gray-200">
              <SelectValue placeholder="Toutes catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              onClick={() => setIsNewFolderDialogOpen(true)}
              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow-md"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Nouveau dossier
            </Button>
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className={`h-8 w-8 ${viewMode === 'list' ? 'shadow-sm' : ''}`}
                onClick={() => handleViewModeChange('list')}
                title="Liste"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'large' ? 'secondary' : 'ghost'}
                size="icon"
                className={`h-8 w-8 ${viewMode === 'large' ? 'shadow-sm' : ''}`}
                onClick={() => handleViewModeChange('large')}
                title="Grandes icônes"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'very-large' ? 'secondary' : 'ghost'}
                size="icon"
                className={`h-8 w-8 ${viewMode === 'very-large' ? 'shadow-sm' : ''}`}
                onClick={() => handleViewModeChange('very-large')}
                title="Très grandes icônes"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={() => router.push('/dashboard/upload')}
              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow-md"
            >
              <FilePlus className="h-4 w-4 mr-2" />
              Nouveau document
            </Button>
          </div>
        </div>
      </Card>

      {/* Content */}
      {filteredFolders.length === 0 && filteredDocuments.length === 0 ? (
        <Card className="p-12 border-0 shadow-md bg-white">
          <div className="text-center">
            <div className="mx-auto h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center mb-4">
              <FileText className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aucun document disponible pour le moment
            </h3>
            <p className="text-gray-600 mb-6">
              Commencez par créer un dossier ou uploader vos premiers documents
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                onClick={() => setIsNewFolderDialogOpen(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Créer un dossier
              </Button>
              <Button
                onClick={() => router.push('/dashboard/upload')}
                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900"
              >
                <Upload className="h-4 w-4 mr-2" />
                Uploader un fichier
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-0 shadow-md bg-white overflow-hidden">
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
                <div className="divide-y divide-gray-100">
                  {/* Folders List View */}
                  {/* Recursive Folder Rendering */}
                  {/* Recursive Folder Rendering */}
                  {renderFolderRecursive(filteredFolders)}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDragId ? (
                  <div className="bg-white p-4 rounded shadow-lg border border-blue-200 opacity-80">
                    <div className="flex items-center gap-3">
                      <Folder className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-gray-900">
                        {folders.find(f => f.id === activeDragId)?.name}
                      </span>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className={`grid gap-6 p-6 ${viewMode === 'very-large' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-3 lg:grid-cols-4'}`}>
              {/* Folders Grid */}
              {filteredFolders.map((folder) => (
                <Card
                  key={folder.id}
                  className="group relative hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-blue-500/20"
                  onClick={() => {
                    handleViewModeChange('list');
                    if (!expandedFolders.has(folder.id)) {
                      toggleFolder(folder.id);
                    }
                  }}
                >
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                    <div className={`
                      rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform duration-200
                      ${viewMode === 'very-large' ? 'w-24 h-24' : 'w-16 h-16'}
                    `}>
                      <Folder className={viewMode === 'very-large' ? 'w-12 h-12' : 'w-8 h-8'} />
                    </div>

                    <div className="space-y-2 w-full">
                      {folder.folder_number && (
                        <Badge variant="secondary" className="font-mono text-xs bg-gray-100 text-gray-600">
                          {folder.folder_number}
                        </Badge>
                      )}
                      <h3 className={`font-bold text-gray-900 truncate w-full ${viewMode === 'very-large' ? 'text-xl' : 'text-lg'}`}>
                        {folder.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {folder.category || 'Non classé'}
                      </p>
                    </div>

                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedFolder(folder); setIsRenameDialogOpen(true); }}>
                            <Edit className="h-4 w-4 mr-2" /> Renommer
                          </DropdownMenuItem>
                          {['admin', 'super_admin'].includes(profile?.role || '') && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Modification du numéro à venir"); }}>
                              <Hash className="h-4 w-4 mr-2" /> Modifier numéro
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Documents Grid */}
              {filteredDocuments.map((doc) => (
                <Card
                  key={doc.id}
                  className="group relative hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-gray-500/20"
                  onClick={() => {
                    setSelectedDocument(doc);
                    setIsPreviewDialogOpen(true);
                  }}
                >
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                    <div className={`
                      rounded-2xl bg-gray-50 flex items-center justify-center text-gray-600 group-hover:scale-110 transition-transform duration-200
                      ${viewMode === 'very-large' ? 'w-24 h-24' : 'w-16 h-16'}
                    `}>
                      <FileText className={viewMode === 'very-large' ? 'w-12 h-12' : 'w-8 h-8'} />
                    </div>

                    <div className="space-y-2 w-full">
                      <h3 className={`font-bold text-gray-900 truncate w-full ${viewMode === 'very-large' ? 'text-xl' : 'text-lg'}`}>
                        {doc.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>

                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setIsRenameDialogOpen(true); }}>
                            <Edit className="h-4 w-4 mr-2" /> Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc); }} className="text-red-600">
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
            <Button onClick={handleRename} className="bg-blue-600 hover:bg-blue-700">
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-blue-700">
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
            <Button onClick={handleCreateFolder} className="bg-blue-600 hover:bg-blue-700">
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
            <DialogTitle className="flex items-center text-blue-700">
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
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
            <Button onClick={handleCreateSubFolder} className="bg-blue-600 hover:bg-blue-700">
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
            <DialogTitle className="flex items-center text-blue-700">
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
            <DialogTitle className="flex items-center text-blue-700">
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
            <DialogTitle className="flex items-center text-blue-700">
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
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
            <Button onClick={handleModifyFolderNumber} className="bg-blue-600 hover:bg-blue-700">
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
              {itemToDelete?.type === 'folder' && " Tout son contenu sera également supprimé."}
              <br />
              <br />
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
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

      {/* Move Document Dialog */}
      <Dialog open={isMoveDocumentDialogOpen} onOpenChange={setIsMoveDocumentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-blue-700">
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
            <Button onClick={handleMoveDocument} className="bg-blue-600 hover:bg-blue-700">
              Déplacer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
