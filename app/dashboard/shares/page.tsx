'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Share2,
  Folder,
  Download,
  Clock,
  Search,
  Filter,
  Eye,
  Link2,
  Trash2,
  FileText,
  Image as ImageIcon,
  File,
  Users,
  Calendar,
  UserCheck,
  Copy,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/lib/parse-auth';
import { ShareHelpers, DocumentHelpers } from '@/lib/parse-helpers';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import JSZip from 'jszip';

type ShareWithDetails = {
  id: string;
  document_id: string;
  shared_by: string;
  shared_with: string | null;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  can_share: boolean;
  share_token: string | null;
  is_link_share: boolean;
  created_at: string;
  expires_at: string | null;
  document?: {
    id: string;
    name: string;
    file_type: string;
    file_size: number;
    file_path: string;
    category: string;
  };
  shared_with_user?: {
    id: string;
    full_name: string;
    email: string;
  };
  shared_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
};

export default function SharesPage() {
  const { profile } = useAuth();
  const [sharedByMe, setSharedByMe] = useState<ShareWithDetails[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<ShareWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'link' | 'user'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPermission, setFilterPermission] = useState<string>('all');
  const [selectedShares, setSelectedShares] = useState<Set<string>>(new Set());
  const [previewShare, setPreviewShare] = useState<ShareWithDetails | null>(null);
  const [revokeShare, setRevokeShare] = useState<ShareWithDetails | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [receivedCount, setReceivedCount] = useState(0);
  const [sharedCount, setSharedCount] = useState(0);
  const [recentCount, setRecentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    fetchShares();
    const interval = setInterval(fetchShares, 10000); // Poll every 10s

    return () => clearInterval(interval);
  }, [profile]);

  const fetchShares = async () => {
    if (!profile) return;

    // Only set loading on first load to avoid flickering
    if (sharedByMe.length === 0 && sharedWithMe.length === 0) {
      setIsLoading(true);
    }

    try {
      const myShares = await ShareHelpers.getSharedBy(profile.id);
      const withMe = await ShareHelpers.getSharedWith(profile.id);

      setSharedByMe(myShares as unknown as ShareWithDetails[]);
      setSharedWithMe(withMe as unknown as ShareWithDetails[]);
      setReceivedCount(withMe.length);
      setSharedCount(myShares.length);

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recent = [...myShares, ...withMe].filter(
        (share: any) => new Date(share.created_at) > oneDayAgo
      );
      setRecentCount(recent.length);
    } catch (error) {
      console.error('Error fetching shares:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    if (fileType?.includes('image')) return <ImageIcon className="h-8 w-8 text-blue-500" />;
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleCopyLink = (share: ShareWithDetails) => {
    if (!share.share_token) return;

    const link = `${window.location.origin}/shared/${share.share_token}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(share.id);
    toast.success('Lien copié');

    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleDownload = async (share: ShareWithDetails) => {
    if (!share.document) return;

    try {
      // In Parse, file_path is usually the URL
      const response = await fetch(share.document.file_path);
      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = share.document.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Téléchargement réussi');
    } catch (error) {
      toast.error('Erreur téléchargement');
      console.error(error);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedShares.size === 0) return;

    try {
      const zip = new JSZip();
      const allShares = [...sharedByMe, ...sharedWithMe];
      const sharesToDownload = allShares.filter(s => selectedShares.has(s.id));

      toast.info('Préparation...');

      for (const share of sharesToDownload) {
        if (!share.document) continue;

        try {
          const response = await fetch(share.document.file_path);
          const blob = await response.blob();
          zip.file(share.document.name, blob);
        } catch (error) {
          console.error(error);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documents-${format(new Date(), 'yyyy-MM-dd')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSelectedShares(new Set());
      toast.success(`${sharesToDownload.length} fichiers téléchargés`);
    } catch (error) {
      toast.error('Erreur téléchargement');
      console.error(error);
    }
  };

  const handleRevoke = async () => {
    if (!revokeShare) return;

    try {
      await ShareHelpers.delete(revokeShare.id);

      toast.success('Accès révoqué');
      setRevokeShare(null);
      fetchShares();
    } catch (error) {
      toast.error('Erreur révocation');
      console.error(error);
    }
  };

  const handlePreview = (share: ShareWithDetails) => {
    setPreviewShare(share);
  };

  const toggleSelectShare = (shareId: string) => {
    const newSelected = new Set(selectedShares);
    if (newSelected.has(shareId)) {
      newSelected.delete(shareId);
    } else {
      newSelected.add(shareId);
    }
    setSelectedShares(newSelected);
  };

  const filterShares = (shares: ShareWithDetails[]) => {
    return shares.filter(share => {
      const matchesSearch = share.document?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        share.shared_with_user?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        share.shared_by_user?.full_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = filterType === 'all' ||
        (filterType === 'link' && share.is_link_share) ||
        (filterType === 'user' && !share.is_link_share);

      const matchesCategory = filterCategory === 'all' ||
        share.document?.category === filterCategory;

      const matchesPermission = filterPermission === 'all' ||
        (filterPermission === 'read' && share.can_read) ||
        (filterPermission === 'write' && share.can_write) ||
        (filterPermission === 'share' && share.can_share);

      return matchesSearch && matchesType && matchesCategory && matchesPermission;
    });
  };

  const filteredSharedByMe = filterShares(sharedByMe);
  const filteredSharedWithMe = filterShares(sharedWithMe);

  const ShareCard = ({ share, isSharedByMe }: { share: ShareWithDetails; isSharedByMe: boolean }) => {
    const isSelected = selectedShares.has(share.id);

    return (
      <Card className={`group hover:shadow-lg transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-4">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelectShare(share.id)}
              className="mt-1 flex-shrink-0"
            />

            <div className="flex-shrink-0 hidden sm:block">
              {share.document && getFileIcon(share.document.file_type)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 break-words line-clamp-2 text-sm md:text-base">
                    {share.document?.name}
                  </h3>
                  <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    {share.is_link_share ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Link2 className="h-3 w-3 mr-1" />
                        Lien public
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        <Users className="h-3 w-3 mr-1" />
                        Utilisateur
                      </Badge>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                  {isSharedByMe ? (
                    <>
                      <UserCheck className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {share.is_link_share
                          ? 'Partagé par lien'
                          : `Partagé avec ${share.shared_with_user?.full_name}`
                        }
                      </span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Partagé par {share.shared_by_user?.full_name}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {share.created_at && formatDistanceToNow(new Date(share.created_at), {
                      addSuffix: true,
                      locale: fr
                    })}
                  </span>
                </div>

                {share.document && (
                  <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500 flex-wrap">
                    <File className="h-4 w-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{formatFileSize(share.document.file_size)}</span>
                    <span>•</span>
                    <span className="capitalize truncate">{share.document.category}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap mt-3">
                {share.can_read && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    Lecture
                  </Badge>
                )}
                {share.can_write && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Écriture
                  </Badge>
                )}
                {share.can_share && (
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                    Partage
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex sm:flex-col gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handlePreview(share)}
                title="Détails"
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDownload(share)}
                title="Télécharger"
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>

              {share.share_token && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopyLink(share)}
                  title="Copier lien"
                  className="h-8 w-8 sm:h-10 sm:w-10"
                >
                  {copiedLink === share.id ? (
                    <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                  ) : (
                    <Link2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                </Button>
              )}

              {isSharedByMe && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setRevokeShare(share)}
                  title="Révoquer"
                  className="h-8 w-8 sm:h-10 sm:w-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white">
        <Image
          src="/logo-navbare.png"
          alt="Chargement PMN"
          width={96}
          height={96}
          className="animate-pulse"
        />
        <p className="mt-6 text-gray-600 text-sm md:text-base font-medium">Chargement de vos documents partagés...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 p-4 md:p-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg flex-shrink-0">
          <Share2 className="h-8 w-8 sm:h-10 sm:w-10 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Documents Partagés</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Gérez vos partages et accédez aux documents partagés
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Documents reçus
                </p>
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">{receivedCount}</p>
              </div>
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-green-500 shadow-lg flex-shrink-0">
                <Download className="h-5 w-5 sm:h-7 sm:w-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Documents partagés
                </p>
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">{sharedCount}</p>
              </div>
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-600 shadow-lg flex-shrink-0">
                <Share2 className="h-5 w-5 sm:h-7 sm:w-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Partages récents
                </p>
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">{recentCount}</p>
              </div>
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-purple-600 shadow-lg flex-shrink-0">
                <Clock className="h-5 w-5 sm:h-7 sm:w-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-gray-50 p-4 md:p-6">
          <div className="flex flex-col gap-4">
            <div className="w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                <SelectTrigger className="w-full sm:w-[160px] bg-white">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="link">Par lien</SelectItem>
                  <SelectItem value="user">Utilisateur</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[160px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="Archive">Archive</SelectItem>
                  <SelectItem value="Administrative">Administrative</SelectItem>
                  <SelectItem value="Technique">Technique</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPermission} onValueChange={setFilterPermission}>
                <SelectTrigger className="w-full sm:w-[160px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="read">Lecture</SelectItem>
                  <SelectItem value="write">Écriture</SelectItem>
                  <SelectItem value="share">Partage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedShares.size > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <span className="text-sm font-medium text-blue-900">
                {selectedShares.size} sélectionné(s)
              </span>
              <Button onClick={handleBulkDownload} size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Download className="h-4 w-4 mr-2" />
                ZIP
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Folder className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Par moi</h2>
                <Badge variant="secondary" className="text-xs">{filteredSharedByMe.length}</Badge>
              </div>

              {filteredSharedByMe.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center border-2 border-dashed border-gray-200 rounded-lg">
                  <Share2 className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mb-3" />
                  <p className="text-sm sm:text-base text-gray-500 font-medium">Aucun document</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSharedByMe.map((share) => (
                    <ShareCard key={share.id} share={share} isSharedByMe={true} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Folder className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Avec moi</h2>
                <Badge variant="secondary" className="text-xs">{filteredSharedWithMe.length}</Badge>
              </div>

              {filteredSharedWithMe.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center border-2 border-dashed border-gray-200 rounded-lg">
                  <Share2 className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mb-3" />
                  <p className="text-sm sm:text-base text-gray-500 font-medium">Aucun document</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSharedWithMe.map((share) => (
                    <ShareCard key={share.id} share={share} isSharedByMe={false} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!previewShare} onOpenChange={() => setPreviewShare(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du partage</DialogTitle>
            <DialogDescription>
              Informations sur ce document partagé
            </DialogDescription>
          </DialogHeader>

          {previewShare && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  {previewShare.document && getFileIcon(previewShare.document.file_type)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{previewShare.document?.name}</h3>
                  <p className="text-sm text-gray-500">
                    {previewShare.document && formatFileSize(previewShare.document.file_size)} • {previewShare.document?.category}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">Type</p>
                  <Badge variant={previewShare.is_link_share ? 'default' : 'secondary'}>
                    {previewShare.is_link_share ? 'Lien public' : 'Utilisateur'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">Date</p>
                  <p className="text-sm">
                    {format(new Date(previewShare.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </p>
                </div>

                {!previewShare.is_link_share && previewShare.shared_with_user && (
                  <div className="space-y-2 col-span-2">
                    <p className="text-sm font-medium text-gray-500">Partagé avec</p>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">{previewShare.shared_with_user.full_name}</span>
                    </div>
                  </div>
                )}

                {previewShare.shared_by_user && (
                  <div className="space-y-2 col-span-2">
                    <p className="text-sm font-medium text-gray-500">Partagé par</p>
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">{previewShare.shared_by_user.full_name}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2 col-span-2">
                  <p className="text-sm font-medium text-gray-500">Permissions</p>
                  <div className="flex gap-2 flex-wrap">
                    {previewShare.can_read && (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Lecture
                      </Badge>
                    )}
                    {previewShare.can_write && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        Écriture
                      </Badge>
                    )}
                    {previewShare.can_delete && (
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        Suppression
                      </Badge>
                    )}
                    {previewShare.can_share && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700">
                        Partage
                      </Badge>
                    )}
                  </div>
                </div>

                {previewShare.share_token && (
                  <div className="space-y-2 col-span-2">
                    <p className="text-sm font-medium text-gray-500">Lien</p>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${window.location.origin}/shared/${previewShare.share_token}`}
                        className="text-sm"
                      />
                      <Button size="sm" onClick={() => handleCopyLink(previewShare)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewShare(null)}>
              Fermer
            </Button>
            {previewShare && (
              <Button onClick={() => handleDownload(previewShare)}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeShare} onOpenChange={() => setRevokeShare(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer l'accès</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmer la révocation ?
              {revokeShare && !revokeShare.is_link_share && revokeShare.shared_with_user && (
                <span className="block mt-2 font-medium">
                  {revokeShare.shared_with_user.full_name} ne pourra plus accéder au document.
                </span>
              )}
              {revokeShare && revokeShare.is_link_share && (
                <span className="block mt-2 font-medium">
                  Le lien sera désactivé.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-red-600 hover:bg-red-700">
              <XCircle className="h-4 w-4 mr-2" />
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
