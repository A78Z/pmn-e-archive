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
  const [documents, setDocuments] = useState<Document[]>([]);
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (profile) {
        fetchFolders();
        fetchDocuments();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [profile]);

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
    } catch (error) {
      console.error('Error loading folders:', error);
      toast.error('Erreur lors du chargement des dossiers');
    }
  };

  const fetchDocuments = async () => {
    try {
      const documentsData = await DocumentHelpers.getAll();
      setDocuments(documentsData as Document[]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
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


  const handleRename = async () => {
    if (!renameValue.trim()) return;

    try {
      if (selectedFolder) {
        await FolderHelpers.update(selectedFolder.id, {
          name: renameValue.trim()
        });
        toast.success('Dossier renommé avec succès');
      } else if (selectedDocument) {
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
      fetchDocuments();
    } catch (error) {
      console.error('Error renaming:', error);
      toast.error('Erreur lors du renommage');
    }
  };

  const handleShareFolder = async () => {
    if (!selectedFolder) return;

    const url = `${window.location.origin}/dashboard/documents?folder=${selectedFolder.id}`;

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

    try {
      if (itemToDelete.type === 'folder') {
        await FolderHelpers.delete(itemToDelete.id);
        toast.success('Dossier supprimé');
      } else {
        await DocumentHelpers.delete(itemToDelete.id);
        toast.success('Document supprimé');
      }
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchFolders();
      fetchDocuments();

      // Trigger dashboard refresh to update stats in real-time
      window.dispatchEvent(new Event('refreshDashboard'));
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDeleteFolder = (folder: Folder) => {
    setItemToDelete({ type: 'folder', id: folder.id, name: folder.name });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteDocument = (doc: Document) => {
    setItemToDelete({ type: 'document', id: doc.id, name: doc.name });
    setIsDeleteDialogOpen(true);
  };

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
      toast.loading('Préparation du téléchargement...');
      const zip = new JSZip();

      const processFolder = async (folderId: string, currentZip: any) => {
        const folderDocs = documents.filter(d => d.folder_id === folderId);
        const subfolders = folders.filter(f => f.parent_id === folderId);

        // Process documents in parallel
        await Promise.all(folderDocs.map(async (doc) => {
          if (doc.file?.url) {
            try {
              const response = await fetch(doc.file.url);
              const blob = await response.blob();
              currentZip.file(doc.name, blob);
            } catch (e) {
              console.error(`Failed to download ${doc.name}`, e);
            }
          }
        }));

        // Process subfolders
        for (const sub of subfolders) {
          const subZip = currentZip.folder(sub.name);
          await processFolder(sub.id, subZip);
        }
      };

      await processFolder(folder.id, zip);

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
      toast.success('Dossier téléchargé');

    } catch (error) {
      console.error('Error downloading folder:', error);
      toast.dismiss();
      toast.error('Erreur lors du téléchargement du dossier');
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getDocumentsInFolder = (folderId: string) => {
    return documents.filter(doc => doc.folder_id === folderId);
  };

  const getSubFolders = (parentId: string) => {
    const subfolders = folders.filter(folder => folder.parent_id === parentId);
    if (subfolders.length === 0) {
      console.log(`getSubFolders(${parentId}): No subfolders found. Total folders: ${folders.length}`);
    } else {
      console.log(`getSubFolders(${parentId}): Found ${subfolders.length} subfolders`);
    }
    return subfolders;
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
                  {filteredFolders.map((folder) => {
                    const isExpanded = expandedFolders.has(folder.id);
                    const folderDocs = getDocumentsInFolder(folder.id);

                    return (
                      <div key={folder.id}>
                        {/* Folder Row */}
                        <div className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                          <button
                            onClick={() => toggleFolder(folder.id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-gray-600" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-gray-600" />
                            )}
                          </button>

                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Folder className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {folder.folder_number && (
                                  <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                    {folder.folder_number}
                                  </span>
                                )}
                                <h3 className="font-semibold text-gray-900 truncate">{folder.name}</h3>
                              </div>
                              <p className="text-sm text-gray-500">
                                {format(new Date(folder.createdAt), 'dd/MM/yyyy', { locale: fr })}
                              </p>
                            </div>
                            {folder.status && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                {folder.status}
                              </Badge>
                            )}
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
                                  setSelectedFolder(folder);
                                  setRenameValue(folder.name);
                                  setIsRenameDialogOpen(true);
                                }}
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
                                  setSelectedFolder(folder);
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
                                className="text-red-600 whitespace-nowrap cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Folder Documents (when expanded) */}
                        {isExpanded && folderDocs.length > 0 && (
                          <div className="bg-gray-50 border-t border-gray-100">
                            {folderDocs.map((doc) => (
                              <div key={doc.id} className="flex items-center gap-3 p-4 pl-16 hover:bg-gray-100 transition-colors">
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
                                        handleDeleteDocument(doc);
                                      }}
                                      className="text-red-600 whitespace-nowrap cursor-pointer"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Supprimer
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Subfolders (when expanded) */}
                        {isExpanded && getSubFolders(folder.id).map((subfolder) => {
                          const canMoveSubfolder = canMoveFolder(profile, subfolder);
                          const isOverSubfolder = overId === subfolder.id;
                          const isSubfolderExpanded = expandedFolders.has(subfolder.id);
                          const subfolderDocs = getDocumentsInFolder(subfolder.id);
                          const subSubfolders = getSubFolders(subfolder.id);

                          return (
                            <div key={subfolder.id} className="bg-gray-50 border-t border-gray-100 pl-8">
                              <SortableFolderRow
                                folder={subfolder}
                                isExpanded={isSubfolderExpanded}
                                isOverThis={isOverSubfolder}
                                canMove={canMoveSubfolder}
                                onToggle={() => toggleFolder(subfolder.id)}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    {/* Subfolder actions similar to folder actions */}
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFolder(subfolder);
                                        setRenameValue(subfolder.name);
                                        setIsRenameDialogOpen(true);
                                      }}
                                      className="whitespace-nowrap cursor-pointer"
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Renommer
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadFolder(subfolder);
                                      }}
                                      className="whitespace-nowrap cursor-pointer"
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Télécharger
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFolder(subfolder);
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
                                        setSelectedFolder(subfolder);
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
                                        setParentFolder(subfolder);
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
                                        handleDeleteFolder(subfolder);
                                      }}
                                      className="text-red-600 whitespace-nowrap cursor-pointer"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Supprimer
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </SortableFolderRow>

                              {/* Subfolder Contents (Documents & Nested Folders) */}
                              {isSubfolderExpanded && (
                                <div className="border-t border-gray-100">
                                  {/* Nested Folders (Sub-subfolders) */}
                                  {subSubfolders.map((subSubfolder) => {
                                    const canMoveSubSubfolder = canMoveFolder(profile, subSubfolder);
                                    const isOverSubSubfolder = overId === subSubfolder.id;
                                    const isSubSubfolderExpanded = expandedFolders.has(subSubfolder.id);
                                    const subSubfolderDocs = getDocumentsInFolder(subSubfolder.id);
                                    const subSubSubfolders = getSubFolders(subSubfolder.id);

                                    return (
                                      <div key={subSubfolder.id} className="pl-8 bg-gray-50/50 border-t border-gray-100">
                                        <SortableFolderRow
                                          folder={subSubfolder}
                                          isExpanded={isSubSubfolderExpanded}
                                          isOverThis={isOverSubSubfolder}
                                          canMove={canMoveSubSubfolder}
                                          onToggle={() => toggleFolder(subSubfolder.id)}
                                        >
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
                                                  setSelectedFolder(subSubfolder);
                                                  setRenameValue(subSubfolder.name);
                                                  setIsRenameDialogOpen(true);
                                                }}
                                                className="whitespace-nowrap cursor-pointer"
                                              >
                                                <Edit className="h-4 w-4 mr-2" />
                                                Renommer
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDownloadFolder(subSubfolder);
                                                }}
                                                className="whitespace-nowrap cursor-pointer"
                                              >
                                                <Download className="h-4 w-4 mr-2" />
                                                Télécharger
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedFolder(subSubfolder);
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
                                                  setSelectedFolder(subSubfolder);
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
                                                  setParentFolder(subSubfolder);
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
                                                  handleDeleteFolder(subSubfolder);
                                                }}
                                                className="text-red-600 whitespace-nowrap cursor-pointer"
                                              >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Supprimer
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </SortableFolderRow>

                                        {/* Level 4 Content (Documents & Nested Folders) */}
                                        {isSubSubfolderExpanded && (
                                          <div className="border-t border-gray-100\">
                                            {/* Level 4 Folders */}
                                            {subSubSubfolders.map((level4Folder) => {
                                              const canMoveLevel4 = canMoveFolder(profile, level4Folder);
                                              const isOverLevel4 = overId === level4Folder.id;
                                              const isLevel4Expanded = expandedFolders.has(level4Folder.id);
                                              const level4Docs = getDocumentsInFolder(level4Folder.id);
                                              const level5Folders = getSubFolders(level4Folder.id);

                                              return (
                                                <div key={level4Folder.id} className="pl-8 bg-gray-50/30 border-t border-gray-100">
                                                  <SortableFolderRow
                                                    folder={level4Folder}
                                                    isExpanded={isLevel4Expanded}
                                                    isOverThis={isOverLevel4}
                                                    canMove={canMoveLevel4}
                                                    onToggle={() => toggleFolder(level4Folder.id)}
                                                  >
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
                                                            setSelectedFolder(level4Folder);
                                                            setRenameValue(level4Folder.name);
                                                            setIsRenameDialogOpen(true);
                                                          }}
                                                          className="whitespace-nowrap cursor-pointer"
                                                        >
                                                          <Edit className="h-4 w-4 mr-2" />
                                                          Renommer
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownloadFolder(level4Folder);
                                                          }}
                                                          className="whitespace-nowrap cursor-pointer"
                                                        >
                                                          <Download className="h-4 w-4 mr-2" />
                                                          Télécharger
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedFolder(level4Folder);
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
                                                            setSelectedFolder(level4Folder);
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
                                                            setParentFolder(level4Folder);
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
                                                            handleDeleteFolder(level4Folder);
                                                          }}
                                                          className="text-red-600 whitespace-nowrap cursor-pointer"
                                                        >
                                                          <Trash2 className="h-4 w-4 mr-2" />
                                                          Supprimer
                                                        </DropdownMenuItem>
                                                      </DropdownMenuContent>
                                                    </DropdownMenu>
                                                  </SortableFolderRow>

                                                  {/* Level 5 Content (Documents & Nested Folders) */}
                                                  {isLevel4Expanded && (
                                                    <div className="border-t border-gray-100 pl-8">
                                                      {/* Level 5 Folders */}
                                                      {level5Folders.map((level5Folder) => (
                                                        <div key={level5Folder.id} className="flex items-center gap-3 p-4 pl-12 hover:bg-gray-100 transition-colors border-t border-gray-100">
                                                          <Folder className="h-5 w-5 text-blue-200 flex-shrink-0" />
                                                          <div className="flex-1 min-w-0">
                                                            <h4 className="font-medium text-gray-900 truncate">{level5Folder.name}</h4>
                                                            <p className="text-sm text-gray-500">
                                                              {format(new Date(level5Folder.createdAt), 'dd/MM/yyyy', { locale: fr })}
                                                            </p>
                                                          </div>
                                                        </div>
                                                      ))}

                                                      {/* Level 5 Documents */}
                                                      {level4Docs.map((doc) => (
                                                        <div key={doc.id} className="flex items-center gap-3 p-4 pl-12 hover:bg-gray-100 transition-colors border-t border-gray-100">
                                                          <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                                          <div className="flex-1 min-w-0">
                                                            <h4 className="font-medium text-gray-900 truncate">{doc.name}</h4>
                                                            <p className="text-sm text-gray-500">
                                                              {format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr })}
                                                            </p>
                                                          </div>
                                                          {/* Document Actions */}
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
                                                                  handleDeleteDocument(doc);
                                                                }}
                                                                className="text-red-600 whitespace-nowrap cursor-pointer"
                                                              >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Supprimer
                                                              </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                          </DropdownMenu>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}

                                            {/* Level 4 Documents */}
                                            {subSubfolderDocs.map((doc) => (
                                              <div key={doc.id} className="flex items-center gap-3 p-4 pl-12 hover:bg-gray-100 transition-colors border-t border-gray-100">
                                                <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                  <h4 className="font-medium text-gray-900 truncate">{doc.name}</h4>
                                                  <p className="text-sm text-gray-500">
                                                    {format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr })}
                                                  </p>
                                                </div>
                                                {/* Document Actions */}
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
                                                        handleDeleteDocument(doc);
                                                      }}
                                                      className="text-red-600 whitespace-nowrap cursor-pointer"
                                                    >
                                                      <Trash2 className="h-4 w-4 mr-2" />
                                                      Supprimer
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </div>
                                            ))}

                                            {subSubfolderDocs.length === 0 && subSubSubfolders.length === 0 && (
                                              <div className="p-4 pl-12 text-sm text-gray-500 italic">
                                                Dossier vide
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {/* Documents in Subfolder */}
                                  {subfolderDocs.map((doc) => (
                                    <div key={doc.id} className="flex items-center gap-3 p-4 pl-16 hover:bg-gray-100 transition-colors bg-gray-50/50 border-t border-gray-100">
                                      <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-gray-900 truncate">{doc.name}</h4>
                                        <p className="text-sm text-gray-500">
                                          {format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr })}
                                        </p>
                                      </div>

                                      {/* Document Actions */}
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
                                              handleDeleteDocument(doc);
                                            }}
                                            className="text-red-600 whitespace-nowrap cursor-pointer"
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Supprimer
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  ))}

                                  {subfolderDocs.length === 0 && subSubfolders.length === 0 && (
                                    <div className="p-4 pl-16 text-sm text-gray-500 italic">
                                      Dossier vide
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Root Documents List */}
                  {filteredDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                      <div className="w-6" /> {/* Spacer for alignment */}
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
                              handleDeleteDocument(doc);
                            }}
                            className="text-red-600 whitespace-nowrap cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
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
    </div >
  );
}

