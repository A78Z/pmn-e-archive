'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Settings, Users, UserPlus, UserCheck, HardDrive, FileText, TrendingUp, Settings2, UserCog, Trash2, Edit, AlertTriangle, User2, UserX, ShieldCheck, Clock, CheckCircle2, XCircle, Activity, BarChart3 } from 'lucide-react';
import { useAuth } from '@/lib/parse-auth';
import { UserHelpers, DocumentHelpers, AccessRequestHelpers, ShareHelpers, MessageHelpers } from '@/lib/parse-helpers';
import { toast } from 'sonner';
import Parse from 'parse';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdministrationPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [changePassword, setChangePassword] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    department: '',
    role: 'user',
    is_active: true,
  });

  useEffect(() => {
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) return;

    fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      const [usersData, docsData, requestsData] = await Promise.all([
        UserHelpers.getAll(),
        DocumentHelpers.getAll(),
        AccessRequestHelpers.getAll()
      ]);

      setUsers(usersData || []);
      setDocuments(docsData || []);
      setAccessRequests(requestsData || []);
      // Shares and messages will be calculated from existing data
      setShares([]);
      setMessages([]);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  const getInitials = (name: string) => {
    return name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  };

  const handleInviteUser = async () => {
    if (!newUser.full_name || !newUser.email) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      // Call Cloud Code function to invite user
      await Parse.Cloud.run('inviteUser', newUser);

      toast.success('Utilisateur invité avec succès');
      setInviteDialogOpen(false);
      setNewUser({
        full_name: '',
        email: '',
        department: '',
        role: 'user',
        is_active: true,
      });
      fetchData();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      if (error.code === 141 && error.message.includes('Invalid function')) {
        toast.error("La fonction d'invitation n'est pas configurée sur le serveur. Veuillez contacter le support.");
      } else {
        toast.error(`Erreur: ${error.message || 'Impossible d\'inviter l\'utilisateur'}`);
      }
    }
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setChangePassword(false);
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser || !selectedUser.full_name || !selectedUser.email) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      await UserHelpers.update(selectedUser.id, {
        full_name: selectedUser.full_name,
        email: selectedUser.email,
        department: selectedUser.department,
        role: selectedUser.role,
        is_active: selectedUser.is_active,
      });

      const statusMessage = selectedUser.is_active ? 'Utilisateur modifié avec succès' : 'Utilisateur désactivé';
      toast.success(statusMessage);
      if (!selectedUser.is_active) {
        toast.info('Le statut de l\'utilisateur a été mis à jour.');
      }
      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const handleDeleteUser = (user: any) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await UserHelpers.delete(selectedUser.id);
      toast.success('Utilisateur supprimé définitivement');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erreur lors de la suppression (nécessite Cloud Code ou Master Key)');
    }
  };

  const handleDeactivateUser = (user: any) => {
    setSelectedUser(user);
    setDeactivateDialogOpen(true);
  };

  const confirmDeactivateUser = async () => {
    if (!selectedUser) return;

    try {
      await UserHelpers.update(selectedUser.id, { is_active: false });
      toast.success('Utilisateur désactivé');
      toast.info('Le statut de l\'utilisateur a été mis à jour.');
      setDeactivateDialogOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast.error('Erreur lors de la désactivation');
    }
  };

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Settings className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Accès refusé</h2>
        <p className="text-muted-foreground">Vous n&apos;avez pas les permissions nécessaires</p>
      </div>
    );
  }

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.is_active !== false).length;

  // Calculate real storage usage
  const totalBytes = documents.reduce((acc, doc) => acc + (doc.file_size || 0), 0);
  const storageUsed = parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(2)); // GB
  const totalStorage = 5; // 5GB limit (Back4App free tier usually)
  const totalDocuments = documents.length;
  const documentsGrowth = 12; // Placeholder
  const pendingRequests = accessRequests.filter((r) => r.status === 'pending').length;
  const approvedRequests = accessRequests.filter((r) => r.status === 'approved').length;
  const rejectedRequests = accessRequests.filter((r) => r.status === 'rejected').length;

  // Chart Data Calculations

  // Role Distribution for Pie Chart
  const roleDistribution = users.reduce((acc: any, user) => {
    const role = user.role || 'user';
    const roleLabel = role === 'super_admin' ? 'Super Admin' :
      role === 'admin' ? 'Admin' :
        role === 'guest' ? 'Invité' : 'Agent Standard';
    acc[roleLabel] = (acc[roleLabel] || 0) + 1;
    return acc;
  }, {});

  const roleChartData = Object.entries(roleDistribution).map(([name, value]) => ({
    name,
    value: value as number
  }));

  // Account Status for Donut Chart
  const verifiedActive = users.filter(u => u.is_verified && u.is_active).length;
  const pending = users.filter(u => !u.is_verified).length;
  const inactive = users.filter(u => !u.is_active).length;

  const statusChartData = [
    { name: 'Actifs', value: verifiedActive },
    { name: 'En attente', value: pending },
    { name: 'Désactivés', value: inactive }
  ];

  // Storage Usage for Donut Chart
  const storageChartData = [
    { name: 'Utilisé', value: storageUsed },
    { name: 'Disponible', value: Math.max(0, totalStorage - storageUsed) }
  ];

  // Monthly Activity for Bar Chart (last 6 months)
  const getLast6Months = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      months.push({
        month: format(date, 'MMM yyyy', { locale: fr }),
        start: startOfMonth(date),
        end: endOfMonth(date)
      });
    }
    return months;
  };

  const monthlyActivityData = getLast6Months().map(({ month, start, end }) => {
    const docsInMonth = documents.filter(doc => {
      const createdAt = new Date(doc.createdAt);
      return createdAt >= start && createdAt <= end;
    }).length;

    const usersInMonth = users.filter(user => {
      const createdAt = new Date(user.createdAt);
      return createdAt >= start && createdAt <= end;
    }).length;

    return {
      month,
      documents: docsInMonth,
      utilisateurs: usersInMonth
    };
  });

  // Chart Colors
  const ROLE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  const STATUS_COLORS = ['#10B981', '#F59E0B', '#EF4444'];
  const STORAGE_COLORS = ['#3B82F6', '#E5E7EB'];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Administration</h1>
        <p className="text-muted-foreground mt-1">Gestion des utilisateurs et des droits d&apos;accès</p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Utilisateurs Totaux</p>
                <p className="text-xl font-bold">Tous les comptes</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <div className="relative flex items-center justify-center">
              <svg className="h-32 w-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#3b82f6"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${(activeUsers / totalUsers || 0) * 351.86} 351.86`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold">{totalUsers}</p>
                  <p className="text-xs text-muted-foreground">utilisateurs</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comptes Actifs</p>
                <p className="text-xl font-bold">Utilisateurs actifs</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="py-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{activeUsers}/{totalUsers}</span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stockage Utilisé</p>
                <p className="text-xl font-bold">Espace total</p>
              </div>
              <HardDrive className="h-8 w-8 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <div className="relative flex items-center justify-center">
              <svg className="h-32 w-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#9333ea"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${(storageUsed / totalStorage) * 351.86} 351.86`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-bold">{storageUsed} MB</p>
                </div>
              </div>
            </div>
            <div className="absolute bottom-6">
              <p className="text-xs text-muted-foreground text-center">/ {totalStorage / 1024} GB</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-xl font-bold">Total fichiers</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="py-6">
            <div className="space-y-2">
              <p className="text-5xl font-bold">{totalDocuments}</p>
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-semibold">+{documentsGrowth}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Role Distribution Pie Chart */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Répartition par Rôle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={roleChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {roleChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Account Status Donut Chart */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-green-600" />
              Statut des Comptes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Storage Usage Donut Chart */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HardDrive className="h-5 w-5 text-purple-600" />
              Utilisation Stockage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={storageChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value.toFixed(2)} GB`}
                >
                  {storageChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STORAGE_COLORS[index % STORAGE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toFixed(2)} GB`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Activity Bar Chart */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Activité Mensuelle (6 derniers mois)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyActivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="documents" fill="#3B82F6" name="Documents" />
              <Bar dataKey="utilisateurs" fill="#10B981" name="Utilisateurs" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-purple-600" />
            <div>
              <CardTitle>Demandes d'Accès</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Suivi des demandes d'accès aux documents</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="p-4 border rounded-lg bg-orange-50 border-orange-200">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">En attente</p>
                  <p className="text-2xl font-bold text-gray-900">{pendingRequests}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg bg-green-50 border-green-200">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Approuvées</p>
                  <p className="text-2xl font-bold text-gray-900">{approvedRequests}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg bg-red-50 border-red-200">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500">
                  <XCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Rejetées</p>
                  <p className="text-2xl font-bold text-gray-900">{rejectedRequests}</p>
                </div>
              </div>
            </div>
          </div>

          {accessRequests.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Dernières demandes</h3>
              {accessRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${request.status === 'pending' ? 'bg-orange-500' :
                      request.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{request.requester?.full_name}</p>
                      <p className="text-xs text-gray-500">{request.document?.name}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={
                    request.status === 'pending' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                      request.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' :
                        'bg-red-100 text-red-700 border-red-200'
                  }>
                    {request.status === 'pending' ? 'En attente' :
                      request.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                  </Badge>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = '/dashboard/access-requests'}
              >
                Voir toutes les demandes
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune demande d'accès</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Gestion des Utilisateurs</h2>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                fetchData();
                toast.success('Liste des utilisateurs actualisée');
              }}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <Activity className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            <Button
              onClick={() => setInviteDialogOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Inviter un utilisateur
            </Button>
          </div>
        </div>

        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Utilisateur</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Service</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Rôle</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Statut</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Dernière connexion</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-gray-600 text-white font-semibold">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-sm">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">{user.department || '-'}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="bg-gray-100">
                          {user.role === 'super_admin' ? 'Super Admin' :
                            user.role === 'admin' ? 'Admin' : 'Agent Standard'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={user.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          <span className={`w-2 h-2 rounded-full mr-2 ${user.is_active !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {user.is_active !== false ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString('fr-FR') : 'Jamais'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditUser(user)}
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeactivateUser(user)}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteUser(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              <DialogTitle>Inviter un utilisateur</DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Créez un nouveau compte utilisateur. Un mot de passe temporaire sera généré automatiquement.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom d&apos;utilisateur</Label>
              <div className="relative">
                <Input
                  id="name"
                  placeholder="Entrez le nom d'utilisateur"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                />
                <UserPlus className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="utilisateur@example.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service">Service</Label>
              <Select
                value={newUser.department}
                onValueChange={(value) => setNewUser({ ...newUser, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direction PMN">Direction PMN</SelectItem>
                  <SelectItem value="Administration">Administration</SelectItem>
                  <SelectItem value="Conservation">Conservation</SelectItem>
                  <SelectItem value="Technique">Technique</SelectItem>
                  <SelectItem value="Juridique">Juridique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <Select
                value={newUser.role}
                onValueChange={(value) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="super_admin">Super Administrateur</SelectItem>
                  <SelectItem value="user">Agent Standard</SelectItem>
                  <SelectItem value="guest">Agent Invité</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="active">Compte actif</Label>
                <p className="text-sm text-muted-foreground">
                  L&apos;utilisateur peut se connecter et accéder au système
                </p>
              </div>
              <Switch
                id="active"
                checked={newUser.is_active}
                onCheckedChange={(checked) => setNewUser({ ...newUser, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleInviteUser} className="bg-green-600 hover:bg-green-700">
              Inviter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              <DialogTitle>Modifier l&apos;utilisateur</DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Modifiez les informations de cet utilisateur.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom d&apos;utilisateur</Label>
              <div className="relative">
                <Input
                  id="edit-name"
                  placeholder="Entrez le nom d'utilisateur"
                  value={selectedUser?.full_name || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                />
                <UserPlus className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="utilisateur@example.com"
                value={selectedUser?.email || ''}
                onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-service">Service</Label>
              <Select
                value={selectedUser?.department || ''}
                onValueChange={(value) => setSelectedUser({ ...selectedUser, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direction PMN">Direction PMN</SelectItem>
                  <SelectItem value="Administration">Administration</SelectItem>
                  <SelectItem value="Conservation">Conservation</SelectItem>
                  <SelectItem value="Technique">Technique</SelectItem>
                  <SelectItem value="Juridique">Juridique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Rôle</Label>
              <Select
                value={selectedUser?.role || 'user'}
                onValueChange={(value) => setSelectedUser({ ...selectedUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="super_admin">Super Administrateur</SelectItem>
                  <SelectItem value="user">Agent Standard</SelectItem>
                  <SelectItem value="guest">Agent Invité</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="change-password">Changer le mot de passe</Label>
              </div>
              <Switch
                id="change-password"
                checked={changePassword}
                onCheckedChange={setChangePassword}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="edit-active">Compte actif</Label>
                <p className="text-sm text-muted-foreground">
                  L&apos;utilisateur peut se connecter et accéder au système
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={selectedUser?.is_active !== false}
                onCheckedChange={(checked) => setSelectedUser({ ...selectedUser, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateUser} className="bg-green-600 hover:bg-green-700">
              Modifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              <AlertDialogTitle className="text-red-600">Supprimer l&apos;utilisateur</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base pt-4">
              Êtes-vous sûr de vouloir supprimer l&apos;utilisateur <strong>{selectedUser?.full_name}</strong> ?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-gray-100 rounded-lg p-4 space-y-2 my-4">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-sm">Email :</span>
              <span className="text-sm text-muted-foreground">{selectedUser?.email}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-sm">Service :</span>
              <span className="text-sm text-muted-foreground">{selectedUser?.department || '-'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-sm">Rôle :</span>
              <span className="text-sm text-muted-foreground">
                {selectedUser?.role === 'super_admin' ? 'super administrateur' :
                  selectedUser?.role === 'admin' ? 'administrateur' : 'agent standard'}
              </span>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-800 text-sm mb-2">
                  Cette action est irréversible et supprimera :
                </p>
                <ul className="space-y-1 text-sm text-orange-700">
                  <li>• Le compte utilisateur</li>
                  <li>• Tous ses documents et fichiers</li>
                  <li>• Tous ses partages de documents</li>
                  <li>• Ses messages et conversations</li>
                  <li>• Son historique d&apos;activité</li>
                </ul>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Utilisateur désactivé</DialogTitle>
            <DialogDescription className="text-base pt-2">
              Le statut de l&apos;utilisateur a été mis à jour.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              onClick={confirmDeactivateUser}
              className="bg-green-600 hover:bg-green-700 min-w-[120px]"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
