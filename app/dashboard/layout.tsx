'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  FileText,
  Upload,
  MessageSquare,
  Share2,
  ShieldCheck,
  Settings,
  Menu,
  LogOut,
  Users,
  ChevronRight,
} from 'lucide-react';
import { NotificationsBell } from '@/components/notifications-bell';
import { useAuth } from '@/lib/parse-auth';
import { Parse, ParseClasses } from '@/lib/parse';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CRUMBS: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/dashboard/documents': 'Documents',
  '/dashboard/upload': 'Uploader',
  '/dashboard/messages': 'Messages',
  '/dashboard/shares': 'Partages',
  '/dashboard/access-requests': "Demandes d'accès",
  '/dashboard/administration': 'Administration',
  '/dashboard/users': 'Gestion Utilisateurs',
  '/dashboard/cleanup': 'Nettoyage',
};

function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();
  const [messageCount, setMessageCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchCounts = useCallback(async () => {
    if (!profile || !user) return;

    try {
      // Count unread messages
      try {
        const messagesQuery = new Parse.Query(ParseClasses.MESSAGE);
        messagesQuery.equalTo('is_read', false);
        messagesQuery.notEqualTo('sender_id', profile.id);
        const messagesCount = await messagesQuery.count();
        setMessageCount(messagesCount);
      } catch (msgError) {
        console.warn('Unable to fetch message count (permissions may be restricted):', msgError);
        setMessageCount(0);
      }

      // Count pending access requests
      try {
        const requestsQuery = new Parse.Query(ParseClasses.ACCESS_REQUEST);
        requestsQuery.equalTo('status', 'pending');
        const requestsCount = await requestsQuery.count();
        setRequestCount(requestsCount);
      } catch (reqError) {
        console.warn('Unable to fetch request count (permissions may be restricted):', reqError);
        setRequestCount(0);
      }
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  }, [profile, user]);

  useEffect(() => {
    fetchCounts();

    // Refresh counts every 30 seconds
    const interval = setInterval(fetchCounts, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchCounts]);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Clear session cookie
      document.cookie = 'parse-session-token=; path=/; max-age=0';
      router.push('/login');
    } catch (error) {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const roleLabel =
    profile?.role === 'super_admin'
      ? 'Super Administrateur'
      : profile?.role === 'admin'
        ? 'Administrateur'
        : 'Utilisateur';

  const crumb = CRUMBS[pathname] || 'Documents';

  const mainItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard', badge: null as number | null },
    { icon: FileText, label: 'Documents', href: '/dashboard/documents', badge: null },
    { icon: Upload, label: 'Uploader', href: '/dashboard/upload', badge: null },
    { icon: MessageSquare, label: 'Messages', href: '/dashboard/messages', badge: messageCount },
    { icon: Share2, label: 'Partages', href: '/dashboard/shares', badge: null },
    { icon: ShieldCheck, label: "Demandes d'accès", href: '/dashboard/access-requests', badge: requestCount },
  ];

  const NavButton = ({
    icon: Icon,
    label,
    href,
    badge,
  }: {
    icon: any;
    label: string;
    href: string;
    badge: number | null;
  }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-[11px] px-[13px] py-[11px] text-sm font-medium text-[#E7F1EB] transition-colors duration-150 border-l-[3px]',
          active
            ? 'border-l-[#E4B429] bg-[rgba(228,180,41,.16)]'
            : 'border-l-transparent hover:bg-[rgba(255,255,255,.06)]'
        )}
      >
        <Icon className="h-[19px] w-[19px]" strokeWidth={1.9} />
        <span className="flex-1">{label}</span>
        {badge !== null && badge > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-[10px] bg-[#E4B429] px-1.5 text-[11px] font-extrabold text-[#3A2A00]">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const SidebarInner = () => (
    <>
      {/* marque */}
      <div className="relative flex items-center gap-[13px] border-b border-white/[.07] px-5 py-5">
        <div className="flex h-[46px] w-[46px] flex-none items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,.25)]">
          <Image src="/assets/pmn-logo.png" alt="PMN" width={44} height={44} className="object-contain" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="font-display text-[19px] font-semibold tracking-[.2px]">Archive PMN</div>
          <div className="text-[11.5px] font-semibold tracking-[.3px] text-[#E4B429]">
            Plateforme numérique
          </div>
        </div>
      </div>

      {/* navigation */}
      <nav className="relative flex flex-1 flex-col gap-[3px] overflow-y-auto px-3.5 pb-2.5 pt-4">
        <div className="px-3 pb-2 pt-1.5 text-[10.5px] font-bold tracking-[.14em] text-[#EAF3EE]/[.42]">
          MENU PRINCIPAL
        </div>
        {mainItems.map((item) => (
          <NavButton key={item.href} {...item} />
        ))}

        {profile && ['admin', 'super_admin'].includes(profile.role) && (
          <>
            <div className="px-3 pb-2 pt-4 text-[10.5px] font-bold tracking-[.14em] text-[#EAF3EE]/[.42]">
              ADMINISTRATION
            </div>
            <NavButton icon={Settings} label="Administration" href="/dashboard/administration" badge={null} />
            {profile.role === 'super_admin' && (
              <NavButton icon={Users} label="Gestion Utilisateurs" href="/dashboard/users" badge={null} />
            )}
          </>
        )}
      </nav>

      {/* utilisateur */}
      <div className="relative flex items-center gap-3 border-t border-white/[.08] px-4 py-3.5">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#E4B429] to-[#C7961A] text-[15px] font-extrabold text-[#3A2A00]">
          {getInitials(profile?.full_name || 'User')}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13.5px] font-semibold">{profile?.full_name || 'Utilisateur'}</div>
          <div className="truncate text-[11.5px] text-[#EAF3EE]/60">{roleLabel}</div>
        </div>
        <button
          title="Déconnexion"
          onClick={handleSignOut}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[#EAF3EE]/70 transition-colors hover:bg-white/[.08] hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </button>
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-pmn-green border-t-transparent"></div>
          <p className="mt-4 text-base font-medium text-pmn-text2">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ===== Sidebar desktop ===== */}
      <aside className="relative hidden w-[270px] flex-none flex-col text-[#EAF3EE] lg:flex bg-[linear-gradient(180deg,#0C3327_0%,#0F3D2E_55%,#0B2C22_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_40%_at_100%_0%,rgba(228,180,41,.10),transparent_60%)]" />
        <SidebarInner />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* ===== Barre supérieure ===== */}
        <header className="z-[5] flex h-16 flex-none items-center justify-between border-b border-border bg-white/85 px-4 backdrop-blur-md md:px-7">
          <div className="flex items-center gap-2">
            {/* menu mobile */}
            <div className="lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-pmn-green hover:bg-pmn-green/10">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="flex w-[270px] flex-col border-none p-0 text-[#EAF3EE] bg-[linear-gradient(180deg,#0C3327_0%,#0F3D2E_55%,#0B2C22_100%)]"
                >
                  <SidebarInner />
                </SheetContent>
              </Sheet>
            </div>

            {/* fil d'Ariane */}
            <div className="hidden items-center gap-2.5 text-[13px] text-pmn-subtle sm:flex">
              <span>Espace de travail</span>
              <ChevronRight className="h-[15px] w-[15px]" strokeWidth={2} />
              <span className="font-semibold text-pmn-ink">{crumb}</span>
            </div>
            <span className="text-[14px] font-semibold text-pmn-ink sm:hidden">{crumb}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-[11px] border border-border bg-white">
              <NotificationsBell />
            </div>
            <div className="mx-1 h-[26px] w-px bg-[rgba(20,33,28,.1)]" />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#15654B] to-[#0E3B2E] text-[13px] font-bold text-white">
              {getInitials(profile?.full_name || 'User')}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardContent>{children}</DashboardContent>;
}
