'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldCheck,
  Check,
  X,
  FileText,
  Users2,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  Filter,
  Eye,
  AlertCircle,
  Send,
} from 'lucide-react';
import { useAuth } from '@/lib/parse-auth';
import { AccessRequestHelpers, DocumentHelpers, ShareHelpers, MessageHelpers } from '@/lib/parse-helpers';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

type AccessRequest = {
  id: string;
  document_id: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  reason: string | null;
  requested_permissions: {
    can_read: boolean;
    can_write: boolean;
    can_delete: boolean;
    can_share: boolean;
  };
  rejection_reason: string | null;
  document?: {
    id: string;
    name: string;
    category: string;
    uploaded_by: string;
  };
  requester?: {
    id: string;
    full_name: string;
    email: string;
  };
  reviewer?: {
    id: string;
    full_name: string;
  };
};

export default function AccessRequestsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [incomingRequests, setIncomingRequests] = useState<AccessRequest[]>([]);
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<AccessRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [newRequest, setNewRequest] = useState({
    document_id: '',
    reason: '',
    can_read: true,
    can_write: false,
    can_delete: false,
    can_share: false,
  });

  useEffect(() => {
    if (!profile) return;

    const prefilledDocId = searchParams?.get('document_id');
    if (prefilledDocId) {
      setNewRequest((prev) => ({ ...prev, document_id: prefilledDocId }));
      setShowNewRequestDialog(true);
    }

    fetchRequests();
    fetchDocuments();

    const interval = setInterval(fetchRequests, 10000); // Poll every 10s

    return () => clearInterval(interval);
  }, [profile, searchParams]);

  const fetchDocuments = async () => {
    try {
      const data = await DocumentHelpers.getAll();
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchRequests = async () => {
    if (!profile) return;

    try {
      const incoming = await AccessRequestHelpers.getIncoming(profile.id);
      const mine = await AccessRequestHelpers.getByUser(profile.id);

      setIncomingRequests(incoming as unknown as AccessRequest[]);
      setMyRequests(mine as unknown as AccessRequest[]);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const handleCreateRequest = async () => {
    if (!profile || !newRequest.document_id || !newRequest.reason.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const doc = documents.find((d) => d.id === newRequest.document_id);
    if (!doc) {
      toast.error('Document introuvable');
      return;
    }

    try {
      await AccessRequestHelpers.create({
        document_id: newRequest.document_id,
        document_owner: doc.uploaded_by,
        requested_by: profile.id,
        reason: newRequest.reason,
        status: 'pending',
        requested_permissions: {
          can_read: newRequest.can_read,
          can_write: newRequest.can_write,
          can_delete: newRequest.can_delete,
          can_share: newRequest.can_share,
        },
      });

      toast.success('Demande créée avec succès');
      setShowNewRequestDialog(false);
      setNewRequest({
        document_id: '',
        reason: '',
        can_read: true,
        can_write: false,
        can_delete: false,
        can_share: false,
      });
      fetchRequests();

      if (doc && doc.uploaded_by) {
        await sendNotification(
          doc.uploaded_by,
          'new_access_request',
          `${profile.full_name} a demandé l'accès au document "${doc.name}"`
        );
      }
    } catch (error) {
      toast.error('Erreur lors de la création de la demande');
      console.error(error);
    }
  };

  const handleApprove = async (request: AccessRequest) => {
    if (!profile) return;

    const permissions = request.requested_permissions || {
      can_read: true,
      can_write: false,
      can_delete: false,
      can_share: false,
    };

    try {
      await ShareHelpers.create({
        document_id: request.document_id,
        shared_by: profile.id,
        shared_with: request.requested_by,
        can_read: permissions.can_read,
        can_write: permissions.can_write,
        can_delete: permissions.can_delete,
        can_share: permissions.can_share,
        is_link_share: false,
      });

      await AccessRequestHelpers.update(request.id, {
        status: 'approved',
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
      });

      toast.success('Demande approuvée et accès accordé');
      fetchRequests();

      await sendNotification(
        request.requested_by,
        'request_approved',
        `Votre demande d'accès au document "${request.document?.name}" a été approuvée`
      );
    } catch (error) {
      toast.error("Erreur lors de l'approbation");
      console.error(error);
    }
  };

  const handleReject = async () => {
    if (!profile || !rejectingRequest) return;

    try {
      await AccessRequestHelpers.update(rejectingRequest.id, {
        status: 'rejected',
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason.trim() || null,
      });

      toast.success('Demande rejetée');
      setShowRejectDialog(false);
      setRejectingRequest(null);
      setRejectionReason('');
      fetchRequests();

      await sendNotification(
        rejectingRequest.requested_by,
        'request_rejected',
        `Votre demande d'accès au document "${rejectingRequest.document?.name}" a été rejetée`
      );
    } catch (error) {
      toast.error('Erreur lors du rejet');
      console.error(error);
    }
  };

  const sendNotification = async (userId: string, type: string, message: string) => {
    if (!profile) return;
    try {
      await MessageHelpers.send({
        sender_id: profile.id,
        receiver_id: userId,
        content: message,
        type: 'text',
        read: false
      });
    } catch (error) {
      console.error('Erreur notification:', error);
    }
  };

  const filterRequests = (requests: AccessRequest[]) => {
    return requests.filter((request) => {
      const matchesSearch =
        request.document?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.requester?.full_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = filterStatus === 'all' || request.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  };

  const filteredIncoming = filterRequests(incomingRequests);
  const filteredMyRequests = filterRequests(myRequests);

  const pendingCount = incomingRequests.filter((r) => r.status === 'pending').length;
  const myRequestsCount = myRequests.length;
  const approvedCount = incomingRequests.filter((r) => r.status === 'approved').length;
  const rejectedCount = incomingRequests.filter((r) => r.status === 'rejected').length;

  const RequestCard = ({ request, isIncoming }: { request: AccessRequest; isIncoming: boolean }) => {
    const statusColors = {
      pending: 'bg-orange-100 text-orange-700 border-orange-200',
      approved: 'bg-green-100 text-green-700 border-green-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
    };

    const statusIcons = {
      pending: <Clock className="h-4 w-4" />,
      approved: <CheckCircle2 className="h-4 w-4" />,
      rejected: <XCircle className="h-4 w-4" />,
    };

    const statusLabels = {
      pending: 'En attente',
      approved: 'Approuvée',
      rejected: 'Rejetée',
    };

    return (
      <Card className="group hover:shadow-lg transition-all">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${statusColors[request.status]}`}>
                <FileText className="h-6 w-6" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900 truncate">{request.document?.name}</h3>
                  <p className="text-sm text-gray-500">
                    {isIncoming ? `Par ${request.requester?.full_name}` : `Catégorie: ${request.document?.category}`}
                  </p>
                </div>
                <Badge variant="outline" className={statusColors[request.status]}>
                  {statusIcons[request.status]}
                  <span className="ml-1">{statusLabels[request.status]}</span>
                </Badge>
              </div>

              {request.reason && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{request.reason}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span>
                  {request.created_at && formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: fr })}
                </span>
                {request.reviewed_at && (
                  <span>Traitée {formatDistanceToNow(new Date(request.reviewed_at), { addSuffix: true, locale: fr })}</span>
                )}
              </div>

              <div className="flex gap-2 flex-wrap mb-3">
                {request.requested_permissions?.can_read && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Lecture</Badge>
                )}
                {request.requested_permissions?.can_write && (
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">Écriture</Badge>
                )}
                {request.requested_permissions?.can_delete && (
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700">Suppression</Badge>
                )}
                {request.requested_permissions?.can_share && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Partage</Badge>
                )}
              </div>

              {isIncoming && request.status === 'pending' && profile && ['admin', 'super_admin'].includes(profile.role) && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(request)}>
                    <Check className="h-4 w-4 mr-1" />
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => {
                      setRejectingRequest(request);
                      setShowRejectDialog(true);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Rejeter
                  </Button>
                </div>
              )}

              {!isIncoming && request.status === 'rejected' && request.rejection_reason && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700">
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    Raison: {request.rejection_reason}
                  </p>
                </div>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="mt-2 w-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  setSelectedRequest(request);
                  setShowDetailsDialog(true);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Voir détails
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-600 to-purple-700 shadow-lg">
            <ShieldCheck className="h-10 w-10 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Demandes d'Accès</h1>
            <p className="text-gray-600 mt-1">
              Gérez et approuvez les demandes d'accès aux documents de façon sécurisée
            </p>
          </div>
        </div>

        <Button onClick={() => setShowNewRequestDialog(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle demande
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">En attente</p>
                <p className="text-5xl font-bold text-gray-900">{pendingCount}</p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 shadow-lg">
                <Clock className="h-7 w-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mes demandes</p>
                <p className="text-5xl font-bold text-gray-900">{myRequestsCount}</p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
                <FileText className="h-7 w-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Approuvées</p>
                <p className="text-5xl font-bold text-gray-900">{approvedCount}</p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500 shadow-lg">
                <CheckCircle2 className="h-7 w-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Rejetées</p>
                <p className="text-5xl font-bold text-gray-900">{rejectedCount}</p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500 shadow-lg">
                <XCircle className="h-7 w-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-gray-50">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par document ou utilisateur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white"
                />
              </div>
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[200px] bg-white">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Approuvées</SelectItem>
                <SelectItem value="rejected">Rejetées</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Inbox className="h-5 w-5 text-orange-600" />
                <h2 className="text-lg font-bold text-gray-900">Demandes reçues</h2>
                <Badge variant="secondary">{filteredIncoming.length}</Badge>
              </div>

              {filteredIncoming.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-200 rounded-lg">
                  <Inbox className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">Aucune demande</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredIncoming.map((request) => (
                    <RequestCard key={request.id} request={request} isIncoming={true} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users2 className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">Mes demandes</h2>
                <Badge variant="secondary">{filteredMyRequests.length}</Badge>
              </div>

              {filteredMyRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-200 rounded-lg">
                  <FileText className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">Aucune demande</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMyRequests.map((request) => (
                    <RequestCard key={request.id} request={request} isIncoming={false} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showNewRequestDialog} onOpenChange={setShowNewRequestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle demande d'accès</DialogTitle>
            <DialogDescription>Demandez l'accès à un document protégé</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Document *</Label>
              <Select value={newRequest.document_id} onValueChange={(v) => setNewRequest({ ...newRequest, document_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un document" />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name} ({doc.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Motif de la demande *</Label>
              <Textarea
                placeholder="Expliquez pourquoi vous avez besoin d'accéder à ce document..."
                value={newRequest.reason}
                onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                rows={4}
              />
            </div>

            <div>
              <Label className="mb-3 block">Permissions demandées</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={newRequest.can_read}
                    onCheckedChange={(checked) => setNewRequest({ ...newRequest, can_read: checked as boolean })}
                  />
                  <Label>Lecture</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={newRequest.can_write}
                    onCheckedChange={(checked) => setNewRequest({ ...newRequest, can_write: checked as boolean })}
                  />
                  <Label>Écriture</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={newRequest.can_share}
                    onCheckedChange={(checked) => setNewRequest({ ...newRequest, can_share: checked as boolean })}
                  />
                  <Label>Partage</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRequestDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateRequest} className="bg-purple-600 hover:bg-purple-700">
              <Send className="h-4 w-4 mr-2" />
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la demande</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Document</p>
                  <p className="text-sm font-semibold">{selectedRequest.document?.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Statut</p>
                  <Badge
                    className={
                      selectedRequest.status === 'pending'
                        ? 'bg-orange-100 text-orange-700'
                        : selectedRequest.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                    }
                  >
                    {selectedRequest.status === 'pending'
                      ? 'En attente'
                      : selectedRequest.status === 'approved'
                        ? 'Approuvée'
                        : 'Rejetée'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Demandeur</p>
                  <p className="text-sm">{selectedRequest.requester?.full_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date</p>
                  <p className="text-sm">{format(new Date(selectedRequest.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}</p>
                </div>
              </div>

              {selectedRequest.reason && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Motif</p>
                  <p className="text-sm p-3 bg-gray-50 rounded-lg">{selectedRequest.reason}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Permissions demandées</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedRequest.requested_permissions?.can_read && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">Lecture</Badge>
                  )}
                  {selectedRequest.requested_permissions?.can_write && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700">Écriture</Badge>
                  )}
                  {selectedRequest.requested_permissions?.can_delete && (
                    <Badge variant="outline" className="bg-red-50 text-red-700">Suppression</Badge>
                  )}
                  {selectedRequest.requested_permissions?.can_share && (
                    <Badge variant="outline" className="bg-green-50 text-green-700">Partage</Badge>
                  )}
                </div>
              </div>

              {selectedRequest.rejection_reason && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Raison du rejet</p>
                  <p className="text-sm p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {selectedRequest.rejection_reason}
                  </p>
                </div>
              )}

              {selectedRequest.reviewed_at && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Traitée le</p>
                  <p className="text-sm">{format(new Date(selectedRequest.reviewed_at), 'dd MMM yyyy HH:mm', { locale: fr })}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejectingRequest} onOpenChange={() => setRejectingRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeter la demande</AlertDialogTitle>
            <AlertDialogDescription>
              Veuillez indiquer la raison du rejet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Raison du rejet</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Permissions non nécessaires..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700">
              Rejeter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
