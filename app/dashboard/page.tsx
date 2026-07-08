'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Share2, MessageSquare, Users, Activity, ChevronRight } from 'lucide-react';
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
import { format, subDays, isSameDay } from 'date-fns';
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
          category: d.category || null,
          icon: FileText,
        }));

        const recentShares = sharedWithMe.slice(0, 2).map((s: any) => ({
          type: 'share',
          title: `Document reçu : ${s.document?.name || 'Inconnu'}`,
          date: s.createdAt,
          category: null,
          icon: Share2,
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

  // Palette charte PMN pour les graphes
  const COLORS = ['#15654B', '#E4B429', '#1F8A63', '#C7961A', '#66746E', '#B8871A'];

  const statCards = [
    {
      title: 'Documents',
      value: stats.documents,
      icon: FileText,
      tile: 'bg-pmn-green/10 text-pmn-green',
      foot: stats.documents > 0 ? `${stats.documents.toLocaleString('fr-FR')} archivés` : 'Aucun document',
      footClass: 'text-pmn-green font-semibold',
    },
    {
      title: 'Partages',
      value: stats.shares,
      icon: Share2,
      tile: 'bg-pmn-gold/[.16] text-pmn-gold-dark',
      foot: stats.shares > 0 ? `${stats.shares} partage(s)` : 'Aucun partage actif',
      footClass: 'text-pmn-faint',
    },
    {
      title: 'Messages non lus',
      value: stats.messages,
      icon: MessageSquare,
      tile: 'bg-pmn-green/10 text-pmn-green',
      foot: stats.messages > 0 ? 'À consulter' : 'Boîte à jour',
      footClass: 'text-pmn-faint',
    },
    {
      title: 'Utilisateurs actifs',
      value: stats.users,
      icon: Users,
      tile: 'bg-pmn-gold/[.16] text-pmn-gold-dark',
      foot: 'Comptes actifs',
      footClass: 'text-pmn-green font-semibold',
      dot: true,
    },
  ];

  return (
    <div className="mx-auto max-w-[1320px] animate-fade-up px-6 pb-12 pt-[34px] md:px-10">
      {/* Header */}
      <div>
        <span className="inline-flex items-center gap-2 rounded-[20px] bg-pmn-green/[.09] px-[11px] py-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-pmn-green">
          Vue d&apos;ensemble
        </span>
        <h1 className="mb-1.5 mt-3.5 text-[38px] font-semibold leading-tight tracking-[-.5px] text-pmn-ink-strong">
          Tableau de bord
        </h1>
        <p className="text-[15px] text-pmn-subtle">
          Bienvenue, <span className="font-semibold text-pmn-ink">{profile?.full_name || 'Utilisateur'}</span>
        </p>
      </div>

      {/* KPI Cards */}
      <div className="mt-[26px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="rounded-[16px] border border-border bg-white p-0 shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[13px] font-medium text-pmn-subtle">{stat.title}</p>
                  <h3 className="font-display mt-1.5 text-[34px] font-semibold leading-none text-pmn-ink-strong">
                    {stat.value.toLocaleString('fr-FR')}
                  </h3>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.tile}`}>
                  <stat.icon className="h-[21px] w-[21px]" strokeWidth={1.9} />
                </div>
              </div>
              <div className={`mt-3 flex items-center gap-1.5 text-[12.5px] ${stat.footClass}`}>
                {stat.dot && <span className="h-2 w-2 rounded-full bg-pmn-online" />}
                {stat.foot}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="mt-[22px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1.7fr_1fr]">
        {/* Activity Chart */}
        <Card className="rounded-[16px] border border-border bg-white p-0 shadow-card">
          <CardHeader className="px-6 pb-2 pt-[22px]">
            <CardTitle className="flex items-center gap-[9px] text-base font-bold text-pmn-ink">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-pmn-green/10 text-pmn-green">
                <Activity className="h-4 w-4" strokeWidth={2} />
              </span>
              Activité récente (7 jours)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.activityLast7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pmnBarGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1F8A63" />
                      <stop offset="100%" stopColor="#15654B" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(20,33,28,.07)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#93A099', fontSize: 11.5 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#93A099', fontSize: 11.5 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '11px', border: '1px solid rgba(20,33,28,.08)', boxShadow: '0 6px 18px rgba(20,33,28,.08)' }}
                    cursor={{ fill: '#FAFAF7' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '12.5px', color: '#66746E' }} />
                  <Bar dataKey="documents" name="Documents ajoutés" fill="url(#pmnBarGreen)" radius={[7, 7, 0, 0]} barSize={34} />
                  <Bar dataKey="shares" name="Partages effectués" fill="#E4B429" radius={[7, 7, 0, 0]} barSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Categories Donut */}
        <Card className="rounded-[16px] border border-border bg-white p-0 shadow-card">
          <CardHeader className="px-6 pb-0 pt-[22px]">
            <CardTitle className="text-base font-bold text-pmn-ink">Répartition par catégorie</CardTitle>
            <p className="text-[12.5px] text-pmn-faint">
              {stats.documents.toLocaleString('fr-FR')} documents classés
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="relative h-[260px] w-full">
              {chartData.documentsByCategory.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.documentsByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.documentsByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '11px', border: '1px solid rgba(20,33,28,.08)', boxShadow: '0 6px 18px rgba(20,33,28,.08)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* centre du donut */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="font-display text-[26px] font-semibold leading-none text-pmn-ink-strong">
                      {stats.documents.toLocaleString('fr-FR')}
                    </div>
                    <div className="mt-1 text-[11px] text-pmn-faint">documents</div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-pmn-faint">
                  Aucune donnée disponible
                </div>
              )}
            </div>
            {chartData.documentsByCategory.length > 0 && (
              <div className="mt-1 flex flex-col gap-[9px]">
                {chartData.documentsByCategory.slice(0, 4).map((entry, index) => {
                  const total = chartData.documentsByCategory.reduce((s, e) => s + e.value, 0) || 1;
                  return (
                    <div key={entry.name} className="flex items-center gap-2 text-[13px] text-pmn-text2">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLORS[index % COLORS.length] }} />
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                      <strong className="font-semibold">{Math.round((entry.value / total) * 100)}%</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Derniers documents ajoutés */}
      <Card className="mt-[22px] rounded-[16px] border border-border bg-white p-0 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between px-6 pb-1.5 pt-[22px]">
          <CardTitle className="text-base font-bold text-pmn-ink">Derniers documents ajoutés</CardTitle>
          <Link
            href="/dashboard/documents"
            className="flex items-center gap-1 text-[13px] font-semibold text-pmn-green transition-colors hover:text-pmn-green-dark"
          >
            Tout voir <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
          </Link>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {recentActivity.length > 0 ? (
            <div>
              {recentActivity.map((item, index) => (
                <div key={index} className="flex items-center gap-3.5 border-t border-[rgba(20,33,28,.06)] py-[13px]">
                  <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-pmn-green/[.08] text-pmn-green">
                    <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-pmn-ink">{item.title}</p>
                    <p className="mt-0.5 text-xs text-pmn-faint">
                      {format(new Date(item.date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                  {item.category && (
                    <span className="flex-none rounded-[20px] bg-pmn-gold/[.14] px-2.5 py-1 text-[11.5px] font-semibold text-pmn-gold-dark">
                      {item.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-pmn-faint">Aucune activité récente</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
