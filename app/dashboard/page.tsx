'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Share2, MessageSquare, Users, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { useAuth } from '@/lib/parse-auth';
import { CountHelpers, DocumentHelpers, ShareHelpers } from '@/lib/parse-helpers';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    documents: 0,
    shares: 0,
    messages: 0,
    users: 0,
  });
  const [chartData, setChartData] = useState<{
    documentsByCategory: any[];
    activityLast7Days: any[];
    sharesDistribution: any[];
  }>({
    documentsByCategory: [],
    activityLast7Days: [],
    sharesDistribution: [],
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        // 1. Fetch Basic Counts
        const [docsCount, sharesCount, messagesCount, usersCount] = await Promise.all([
          CountHelpers.countDocuments(),
          CountHelpers.countShares(profile.id),
          CountHelpers.countUnreadMessages(profile.id),
          CountHelpers.countUsers(),
        ]);

        setStats({
          documents: docsCount,
          shares: sharesCount,
          messages: messagesCount,
          users: usersCount,
        });

        // 2. Fetch Detailed Data for Charts
        const [allDocs, sharedByMe, sharedWithMe] = await Promise.all([
          DocumentHelpers.getAll(),
          ShareHelpers.getSharedBy(profile.id),
          ShareHelpers.getSharedWith(profile.id),
        ]);

        // Process Documents by Category
        const categoryMap = new Map();
        allDocs.forEach((doc: any) => {
          const cat = doc.category || 'Autre';
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
        });
        const docsByCategory = Array.from(categoryMap.entries()).map(([name, value]) => ({
          name,
          value,
        }));

        // Process Activity (Last 7 Days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = subDays(new Date(), 6 - i);
          return {
            date: d,
            label: format(d, 'dd/MM', { locale: fr }),
            documents: 0,
            shares: 0,
          };
        });

        allDocs.forEach((doc: any) => {
          const docDate = new Date(doc.createdAt);
          const dayStat = last7Days.find(d => isSameDay(d.date, docDate));
          if (dayStat) dayStat.documents++;
        });

        sharedByMe.forEach((share: any) => {
          const shareDate = new Date(share.createdAt);
          const dayStat = last7Days.find(d => isSameDay(d.date, shareDate));
          if (dayStat) dayStat.shares++;
        });

        // Process Shares Distribution
        const sharesDist = [
          { name: 'Envoyés', value: sharedByMe.length },
          { name: 'Reçus', value: sharedWithMe.length },
        ];

        setChartData({
          documentsByCategory: docsByCategory,
          activityLast7Days: last7Days,
          sharesDistribution: sharesDist,
        });

        // Recent Activity List (Combined)
        const recentDocs = allDocs.slice(0, 3).map((d: any) => ({
          type: 'document',
          title: `Document ajouté : ${d.name}`,
          date: d.createdAt,
          icon: FileText,
          color: 'text-blue-500'
        }));

        const recentShares = sharedWithMe.slice(0, 2).map((s: any) => ({
          type: 'share',
          title: `Document reçu : ${s.document?.name || 'Inconnu'}`,
          date: s.createdAt,
          icon: Share2,
          color: 'text-orange-500'
        }));

        const combined = [...recentDocs, ...recentShares]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5);

        setRecentActivity(combined);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();

    const handleRefresh = () => fetchData();
    window.addEventListener('refreshDashboard', handleRefresh);
    return () => window.removeEventListener('refreshDashboard', handleRefresh);
  }, [profile]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 pb-8">
      {/* Header */}
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-blue-600">
          Vue d&apos;ensemble
        </span>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-2">
          Bienvenue, <span className="font-semibold text-gray-700">{profile?.full_name || 'Utilisateur'}</span>
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Documents', value: stats.documents, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { title: 'Partages', value: stats.shares, icon: Share2, color: 'text-orange-600', bg: 'bg-orange-50' },
          { title: 'Messages non lus', value: stats.messages, icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-50' },
          { title: 'Utilisateurs actifs', value: stats.users, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat, index) => (
          <Card key={index} className="border-none shadow-lg shadow-gray-100 hover:shadow-xl transition-shadow duration-200">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</h3>
              </div>
              <div className={`h-12 w-12 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Chart */}
        <Card className="lg:col-span-2 border-none shadow-lg shadow-gray-100">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Activité Récente (7 jours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.activityLast7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#F3F4F6' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="documents" name="Documents ajoutés" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="shares" name="Partages effectués" fill="#F97316" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Categories Pie Chart */}
        <Card className="border-none shadow-lg shadow-gray-100">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-800">Répartition par Catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full relative">
              {chartData.documentsByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.documentsByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.documentsByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Recent List & Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity List */}
        <Card className="lg:col-span-2 border-none shadow-lg shadow-gray-100">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-800">Derniers événements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentActivity.length > 0 ? (
                recentActivity.map((item, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className={`mt-1 h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center ${item.color}`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(item.date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Aucune activité récente
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Access */}
        <Card className="border-none shadow-lg shadow-gray-100 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Accès Rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-blue-100 text-sm">
                Accédez rapidement aux fonctionnalités principales de la plateforme.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <a href="/dashboard/documents" className="flex items-center justify-between rounded-lg bg-white/10 p-3 hover:bg-white/20 transition-colors">
                  <span className="text-sm font-medium">Gérer les documents</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <a href="/dashboard/messages" className="flex items-center justify-between rounded-lg bg-white/10 p-3 hover:bg-white/20 transition-colors">
                  <span className="text-sm font-medium">Messagerie</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <a href="/dashboard/shares" className="flex items-center justify-between rounded-lg bg-white/10 p-3 hover:bg-white/20 transition-colors">
                  <span className="text-sm font-medium">Partages</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
