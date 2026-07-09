'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/parse-auth';
import { UserHelpers } from '@/lib/parse-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  UserCheck,
  UserX,
  Loader2,
  Shield,
  User as UserIcon,
  Crown,
  UserPlus,
  Mail,
  MessageSquare,
  KeyRound,
  Power,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Phone,
  Send
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import Parse from 'parse';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  fonction?: string;
  is_verified: boolean;
  is_active: boolean;
  assigned_zone?: string;
  telephone?: string;
  service?: string;
  notify_channel?: string;
  created_at: string;
  last_login?: string;
}

// Rôles Archive PMN (façon INP, adaptés à une plateforme d'archives)
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'super_admin', label: 'Super administrateur' },
  { value: 'admin', label: 'Administrateur' },
  { value: 'hr', label: 'Ressources humaines' },
  { value: 'manager', label: 'Responsable / Manager' },
  { value: 'user', label: 'Employé' },
  { value: 'editor', label: 'Rédacteur' },
  { value: 'researcher', label: 'Chercheur' },
  { value: 'partner', label: 'Partenaire' },
];
const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]));
ROLE_LABELS.guest = 'Agent Invité';

const SECTIONS = ['Dakar', 'Thiès', 'Diourbel', 'Fatick', 'Kaffrine', 'Kaolack', 'Kédougou', 'Kolda', 'Louga', 'Matam', 'Saint-Louis', 'Sédhiou', 'Tambacounda', 'Ziguinchor'];

export default function UsersManagementPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'approve' | 'reject' | null;
    user: User | null;
  }>({ open: false, type: null, user: null });
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Configuration des canaux (email/SMS) — pour désactiver proprement le SMS
  const [channels, setChannels] = useState<{ email: boolean; sms: boolean }>({ email: false, sms: false });

  // Dialogues « Nouvel utilisateur » / message / édition / renvoyer / supprimer
  const emptyForm = { firstName: '', lastName: '', email: '', fonction: '', section: 'Dakar', role: 'user', telephone: '', service: '', channel: 'email' };
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);

  const [msgUser, setMsgUser] = useState<User | null>(null);
  const [msg, setMsg] = useState({ channel: 'email', subject: '', body: '' });

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [resendUser, setResendUser] = useState<User | null>(null);
  const [resendChannel, setResendChannel] = useState('email');

  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
    fetch('/api/users').then(r => r.json()).then(d => setChannels({ email: !!d.email, sms: !!d.sms })).catch(() => {});
  }, []);

  // Appel générique à la route serveur /api/users
  const apiUsers = async (payload: Record<string, any>) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
    return data;
  };

  const deliveryMessage = (delivery: any) => {
    if (!delivery) return '';
    if (delivery.sent) return delivery.channel === 'sms' ? 'Accès envoyés par SMS.' : 'Accès envoyés par e-mail.';
    if (delivery.reason === 'not_configured') return `Compte créé, mais canal ${delivery.channel === 'sms' ? 'SMS' : 'e-mail'} non configuré : accès non envoyés.`;
    if (delivery.reason === 'no_phone') return 'Compte créé, mais aucun téléphone : accès non envoyés.';
    return 'Compte créé, mais l\'envoi des accès a échoué.';
  };

  const handleCreateUser = async () => {
    if (!form.firstName.trim() || !form.email.trim()) {
      toast.error('Prénom et e-mail sont requis');
      return;
    }
    setBusy(true);
    try {
      const data = await apiUsers({ action: 'create', ...form });
      toast.success('Utilisateur créé', { description: deliveryMessage(data.delivery) });
      setNewUserOpen(false);
      setForm({ ...emptyForm });
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async () => {
    if (!msgUser || !msg.body.trim()) { toast.error('Message vide'); return; }
    setBusy(true);
    try {
      const data = await apiUsers({ action: 'send-message', userId: msgUser.id, channel: msg.channel, subject: msg.subject, message: msg.body });
      toast[data.delivered ? 'success' : 'error'](data.delivered ? 'Message envoyé' : 'Échec de l\'envoi');
      setMsgUser(null);
      setMsg({ channel: 'email', subject: '', body: '' });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (!resendUser) return;
    setBusy(true);
    try {
      const data = await apiUsers({ action: 'resend-access', userId: resendUser.id, channel: resendChannel });
      toast[data.delivery?.sent ? 'success' : 'error'](deliveryMessage(data.delivery) || 'Accès renvoyés');
      setResendUser(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setBusy(true);
    try {
      await apiUsers({ action: 'update', userId: editUser.id, fields: editForm });
      toast.success('Utilisateur mis à jour');
      setEditUser(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    try {
      await apiUsers({ action: 'set-active', userId: u.id, active: !u.is_active });
      toast.success(u.is_active ? 'Compte désactivé' : 'Compte activé');
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setBusy(true);
    try {
      await apiUsers({ action: 'delete', userId: deleteUser.id });
      toast.success('Utilisateur supprimé');
      setDeleteUser(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, statusFilter, roleFilter]);

  const fetchUsers = async () => {
    try {
      // Use Cloud Function to fetch all users with Master Key
      const data = await Parse.Cloud.run('getAllUsers');
      setUsers(data as unknown as User[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchTerm) {
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.fonction?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'verified') {
        filtered = filtered.filter(u => u.is_verified && u.is_active);
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(u => !u.is_verified);
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(u => !u.is_active);
      }
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleVerifyUser = async (userId: string, approve: boolean) => {
    setActionLoading(true);
    try {
      // Use Cloud Code or direct update if allowed
      // Assuming we can update directly as admin or use a cloud function
      // For now, let's try direct update via UserHelpers (which uses Parse.User save)
      // Note: Updating other users usually requires Master Key or Cloud Code 'useMasterKey: true'
      // We'll try to use a Cloud Function 'verifyUser' if available, otherwise fallback to update

      try {
        await Parse.Cloud.run('verifyUser', { userId, approved: approve, notes });
      } catch (e) {
        // Fallback to client-side update (might fail if ACLs are strict)
        await UserHelpers.update(userId, {
          is_verified: approve,
          is_active: approve, // If rejected, maybe deactivate? Or just not verify.
          admin_notes: notes
        });
      }

      toast.success(approve ? 'Utilisateur approuvé avec succès' : 'Utilisateur refusé');
      fetchUsers();
      setActionDialog({ open: false, type: null, user: null });
      setNotes('');
    } catch (error: any) {
      console.error('Error verifying user:', error);
      toast.error(error.message || 'Erreur lors de la validation');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleLabel = (role: string) => ROLE_LABELS[role] || role;

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-purple-100 text-purple-800 border-purple-300',
      admin: 'bg-pmn-green/10 text-pmn-green-dark border-pmn-green/30',
      hr: 'bg-blue-100 text-blue-800 border-blue-300',
      manager: 'bg-amber-100 text-amber-800 border-amber-300',
      user: 'bg-green-100 text-green-800 border-green-300',
      editor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      researcher: 'bg-teal-100 text-teal-800 border-teal-300',
      partner: 'bg-gray-100 text-gray-800 border-gray-300',
      guest: 'bg-gray-100 text-gray-800 border-gray-300',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (user: User) => {
    if (!user.is_verified) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
    }
    if (!user.is_active) {
      return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Désactivé</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Actif</Badge>;
  };

  const pendingCount = users.filter(u => !u.is_verified).length;
  const activeCount = users.filter(u => u.is_verified && u.is_active).length;
  const inactiveCount = users.filter(u => !u.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] animate-fade-up px-6 pb-12 pt-[34px] md:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[34px] font-semibold tracking-[-.4px] text-pmn-ink-strong flex items-center gap-3">
            <Users className="h-8 w-8 text-pmn-green" />
            Gestion des Utilisateurs
          </h1>
          <p className="text-gray-600 mt-2">Gérez les comptes, validations et permissions</p>
        </div>
        <Button
          onClick={() => { setForm({ ...emptyForm, channel: channels.email ? 'email' : (channels.sms ? 'sms' : 'email') }); setNewUserOpen(true); }}
          className="h-11 gap-2 rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110"
        >
          <UserPlus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Utilisateurs actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-green-600">{activeCount}</div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Désactivés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-red-600">{inactiveCount}</div>
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Rechercher par nom, email, fonction..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="verified">Vérifiés</SelectItem>
                <SelectItem value="inactive">Désactivés</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {ROLE_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs ({filteredUsers.length})</CardTitle>
          <CardDescription>Gérez les validations et permissions des utilisateurs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    {u.role === 'super_admin' ? (
                      <Crown className="h-6 w-6 text-purple-600" />
                    ) : u.role === 'admin' ? (
                      <Shield className="h-6 w-6 text-pmn-green" />
                    ) : (
                      <UserIcon className="h-6 w-6 text-green-600" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{u.full_name}</h3>
                      {getStatusBadge(u)}
                    </div>
                    <p className="text-sm text-gray-600">{u.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getRoleBadge(u.role)}>{getRoleLabel(u.role)}</Badge>
                      {u.fonction && (
                        <span className="text-xs text-gray-500">{u.fonction}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1">
                  {!u.is_verified && (
                    <>
                      <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50" onClick={() => setActionDialog({ open: true, type: 'approve', user: u })}>
                        <UserCheck className="h-4 w-4 mr-1" /> Valider
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50" onClick={() => setActionDialog({ open: true, type: 'reject', user: u })}>
                        <UserX className="h-4 w-4 mr-1" /> Refuser
                      </Button>
                    </>
                  )}
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-pmn-subtle hover:text-pmn-green" title="Modifier"
                    onClick={() => { setEditUser(u); setEditForm({ full_name: u.full_name, role: u.role, fonction: u.fonction || '', assigned_zone: u.assigned_zone || '', telephone: u.telephone || '', service: u.service || '', is_active: u.is_active, notify_channel: u.notify_channel || 'email' }); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-pmn-subtle hover:text-pmn-green" title="Envoyer un message"
                    onClick={() => { setMsgUser(u); setMsg({ channel: channels.email ? 'email' : 'sms', subject: '', body: '' }); }}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-pmn-subtle hover:text-pmn-green" title="Renvoyer les accès"
                    onClick={() => { setResendUser(u); setResendChannel(u.notify_channel === 'sms' && channels.sms ? 'sms' : 'email'); }}>
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className={`h-9 w-9 ${u.is_active ? 'text-pmn-subtle hover:text-amber-600' : 'text-green-600 hover:text-green-700'}`} title={u.is_active ? 'Désactiver' : 'Activer'}
                    onClick={() => handleToggleActive(u)}>
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-pmn-subtle hover:text-red-600" title="Supprimer"
                    onClick={() => setDeleteUser(u)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Aucun utilisateur trouvé</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={actionDialog.open} onOpenChange={(open) => {
        if (!open) {
          setActionDialog({ open: false, type: null, user: null });
          setNotes('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.type === 'approve' ? 'Valider le compte' : 'Refuser le compte'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.type === 'approve' ? (
                <>Voulez-vous approuver le compte de <strong>{actionDialog.user?.full_name}</strong> ?</>
              ) : (
                <>Voulez-vous refuser le compte de <strong>{actionDialog.user?.full_name}</strong> ?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Notes (optionnel)
            </label>
            <Textarea
              placeholder="Ajoutez une note pour cet utilisateur..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionDialog.user && handleVerifyUser(
                actionDialog.user.id,
                actionDialog.type === 'approve'
              )}
              disabled={actionLoading}
              className={actionDialog.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                actionDialog.type === 'approve' ? 'Valider' : 'Refuser'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== Nouvel utilisateur ===== */}
      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="text-pmn-ink">Nouvel utilisateur</DialogTitle>
            <DialogDescription>Renseignez les informations puis choisissez le canal d&apos;envoi des accès.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Prénom *</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="Ex. Aminata" /></div>
              <div className="space-y-1.5"><Label>Nom</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Ex. Ba" /></div>
            </div>
            <div className="space-y-1.5"><Label>E-mail *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="prenom.nom@pmn.sn" /></div>
            <div className="space-y-1.5"><Label>Fonction</Label><Input value={form.fonction} onChange={e => setForm({ ...form, fonction: e.target.value })} placeholder="Ex. Archiviste" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Section (région)</Label>
                <Select value={form.section} onValueChange={v => setForm({ ...form, section: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[260px]">{SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rôle</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Téléphone {form.channel === 'sms' && <span className="text-red-500">*</span>}</Label><Input value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} placeholder="+221 77 000 00 00" /></div>
              <div className="space-y-1.5"><Label>Service <span className="text-pmn-faint">(facultatif)</span></Label><Input value={form.service} onChange={e => setForm({ ...form, service: e.target.value })} placeholder="Ex. Archives" /></div>
            </div>

            {/* Choix du canal d'envoi des accès */}
            <div className="space-y-1.5">
              <Label>Envoyer les accès</Label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({ ...form, channel: 'email' })} disabled={!channels.email}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${form.channel === 'email' ? 'border-pmn-green bg-pmn-green/[.08] text-pmn-green' : 'border-border text-pmn-subtle hover:bg-pmn-hover'}`}>
                  <Mail className="h-4 w-4" /> Par e-mail {!channels.email && '(non configuré)'}
                </button>
                <button type="button" onClick={() => channels.sms && setForm({ ...form, channel: 'sms' })} disabled={!channels.sms}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${form.channel === 'sms' ? 'border-pmn-green bg-pmn-green/[.08] text-pmn-green' : 'border-border text-pmn-subtle hover:bg-pmn-hover'}`}>
                  <Phone className="h-4 w-4" /> Par SMS {!channels.sms && '(non configuré)'}
                </button>
              </div>
              <p className="text-xs text-pmn-faint">Un mot de passe temporaire est généré ; l&apos;utilisateur devra le changer à la première connexion.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewUserOpen(false)} disabled={busy}>Annuler</Button>
            <Button onClick={handleCreateUser} disabled={busy} className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer l&apos;utilisateur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Envoyer un message ===== */}
      <Dialog open={msgUser !== null} onOpenChange={o => { if (!o) setMsgUser(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-pmn-ink">Envoyer un message</DialogTitle>
            <DialogDescription>À {msgUser?.full_name} ({msgUser?.email})</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <button type="button" onClick={() => setMsg({ ...msg, channel: 'email' })} disabled={!channels.email}
                className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] border px-3 py-2 text-sm font-medium disabled:opacity-40 ${msg.channel === 'email' ? 'border-pmn-green bg-pmn-green/[.08] text-pmn-green' : 'border-border text-pmn-subtle'}`}>
                <Mail className="h-4 w-4" /> E-mail {!channels.email && '(non configuré)'}
              </button>
              <button type="button" onClick={() => channels.sms && setMsg({ ...msg, channel: 'sms' })} disabled={!channels.sms}
                className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] border px-3 py-2 text-sm font-medium disabled:opacity-40 ${msg.channel === 'sms' ? 'border-pmn-green bg-pmn-green/[.08] text-pmn-green' : 'border-border text-pmn-subtle'}`}>
                <Phone className="h-4 w-4" /> SMS {!channels.sms && '(non configuré)'}
              </button>
            </div>
            {msg.channel === 'email' && (
              <div className="space-y-1.5"><Label>Objet</Label><Input value={msg.subject} onChange={e => setMsg({ ...msg, subject: e.target.value })} placeholder="Objet du message" /></div>
            )}
            <div className="space-y-1.5"><Label>Message</Label><Textarea value={msg.body} onChange={e => setMsg({ ...msg, body: e.target.value })} className="min-h-[120px]" placeholder="Votre message…" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgUser(null)} disabled={busy}>Annuler</Button>
            <Button onClick={handleSendMessage} disabled={busy} className="gap-2 rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Modifier ===== */}
      <Dialog open={editUser !== null} onOpenChange={o => { if (!o) setEditUser(null); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-pmn-ink">Modifier l&apos;utilisateur</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Nom complet</Label><Input value={editForm.full_name || ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Rôle</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Section</Label>
                <Select value={editForm.assigned_zone || 'Dakar'} onValueChange={v => setEditForm({ ...editForm, assigned_zone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[260px]">{SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Fonction</Label><Input value={editForm.fonction || ''} onChange={e => setEditForm({ ...editForm, fonction: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Téléphone</Label><Input value={editForm.telephone || ''} onChange={e => setEditForm({ ...editForm, telephone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Service</Label><Input value={editForm.service || ''} onChange={e => setEditForm({ ...editForm, service: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Canal de notification</Label>
                <Select value={editForm.notify_channel || 'email'} onValueChange={v => setEditForm({ ...editForm, notify_channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="sms" disabled={!channels.sms}>SMS {!channels.sms && '(non configuré)'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-[10px] border border-border p-3 text-sm">
              <input type="checkbox" checked={!!editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} className="h-4 w-4 accent-[#15654B]" />
              Compte actif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={busy}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={busy} className="rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Renvoyer les accès ===== */}
      <Dialog open={resendUser !== null} onOpenChange={o => { if (!o) setResendUser(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-pmn-ink">Renvoyer les accès</DialogTitle>
            <DialogDescription>Un nouveau mot de passe temporaire sera généré pour {resendUser?.full_name} et envoyé.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 py-2">
            <button type="button" onClick={() => setResendChannel('email')} disabled={!channels.email}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] border px-3 py-2.5 text-sm font-medium disabled:opacity-40 ${resendChannel === 'email' ? 'border-pmn-green bg-pmn-green/[.08] text-pmn-green' : 'border-border text-pmn-subtle'}`}>
              <Mail className="h-4 w-4" /> E-mail {!channels.email && '(non configuré)'}
            </button>
            <button type="button" onClick={() => channels.sms && setResendChannel('sms')} disabled={!channels.sms}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] border px-3 py-2.5 text-sm font-medium disabled:opacity-40 ${resendChannel === 'sms' ? 'border-pmn-green bg-pmn-green/[.08] text-pmn-green' : 'border-border text-pmn-subtle'}`}>
              <Phone className="h-4 w-4" /> SMS {!channels.sms && '(non configuré)'}
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendUser(null)} disabled={busy}>Annuler</Button>
            <Button onClick={handleResend} disabled={busy} className="gap-2 rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Renvoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Supprimer ===== */}
      <AlertDialog open={deleteUser !== null} onOpenChange={o => { if (!o) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le compte de <strong>{deleteUser?.full_name}</strong> ({deleteUser?.email}) sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-red-600 hover:bg-red-700">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Suppression…</> : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
