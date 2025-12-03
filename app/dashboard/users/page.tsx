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
  Crown
} from 'lucide-react';
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
  created_at: string;
  last_login?: string;
}

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

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      super_admin: 'Super Administrateur',
      admin: 'Administrateur',
      user: 'Agent Standard',
      guest: 'Agent Invité',
    };
    return roles[role] || role;
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-purple-100 text-purple-800 border-purple-300',
      admin: 'bg-blue-100 text-blue-800 border-blue-300',
      user: 'bg-green-100 text-green-800 border-green-300',
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
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Users className="h-8 w-8 text-green-600" />
          Gestion des Utilisateurs
        </h1>
        <p className="text-gray-600 mt-2">Gérez les comptes, validations et permissions</p>
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
                <SelectItem value="super_admin">Super Administrateur</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="user">Agent Standard</SelectItem>
                <SelectItem value="guest">Agent Invité</SelectItem>
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
                      <Shield className="h-6 w-6 text-blue-600" />
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

                {!u.is_verified && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-600 hover:bg-green-50"
                      onClick={() => setActionDialog({ open: true, type: 'approve', user: u })}
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-600 hover:bg-red-50"
                      onClick={() => setActionDialog({ open: true, type: 'reject', user: u })}
                    >
                      <UserX className="h-4 w-4 mr-1" />
                      Refuser
                    </Button>
                  </div>
                )}
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
    </div>
  );
}
