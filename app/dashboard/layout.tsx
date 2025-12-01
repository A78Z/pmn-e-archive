'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { NotificationsBell } from '@/components/notifications-bell';
import { useAuth } from '@/lib/parse-auth';
import { Parse, ParseClasses } from '@/lib/parse';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

  const menuItems = useMemo(() => [
    { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard', badge: null },
    { icon: FileText, label: 'Documents', href: '/dashboard/documents', badge: null },
    { icon: Upload, label: 'Uploader', href: '/dashboard/upload', badge: null },
    { icon: MessageSquare, label: 'Messages', href: '/dashboard/messages', badge: messageCount },
    { icon: Share2, label: 'Partages', href: '/dashboard/shares', badge: null },
    { icon: ShieldCheck, label: "Demandes d'accès", href: '/dashboard/access-requests', badge: requestCount },
  ], [messageCount, requestCount]);

  const NavLinks = () => (
    <>
      <div className="space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
              pathname === item.href
                ? 'bg-secondary text-secondary-foreground shadow-md ring-1 ring-secondary/40'
                : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </div>
            {item.badge !== null && item.badge > 0 && (
              <Badge className="bg-secondary text-secondary-foreground font-semibold ring-1 ring-secondary/30">
                {item.badge}
              </Badge>
            )}
          </Link>
        ))}
      </div>

      {profile && ['admin', 'super_admin'].includes(profile.role) && (
        <div className="mt-6 space-y-2">
          <p className="px-4 text-xs font-semibold uppercase tracking-widest text-secondary/80">
            Administration
          </p>
          <Link
            href="/dashboard/administration"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
              pathname === '/dashboard/administration'
                ? 'bg-secondary text-secondary-foreground shadow-md ring-1 ring-secondary/40'
                : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'
            )}
          >
            <Settings className="h-5 w-5" />
            <span>Administration</span>
          </Link>
          {profile.role === 'super_admin' && (
            <Link
              href="/dashboard/users"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                pathname === '/dashboard/users'
                  ? 'bg-secondary text-secondary-foreground shadow-md ring-1 ring-secondary/40'
                  : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'
              )}
            >
              <Users className="h-5 w-5" />
              <span>Gestion Utilisateurs</span>
            </Link>
          )}
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-base font-medium text-gray-700">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:flex lg:w-72 lg:flex-col border-r border-border bg-primary text-primary-foreground shadow-xl shadow-primary/30">
        <div className="flex h-20 items-center gap-3 border-b border-primary-foreground/20 px-6">
          <Image
            src="/logo-navbare.png"
            alt="Logo PMN"
            width={48}
            height={48}
            className="drop-shadow-md"
          />
          <div>
            <h1 className="text-lg font-semibold leading-tight">Archive PMN</h1>
            <p className="text-xs font-medium text-secondary">Plateforme numérique</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          <NavLinks />
        </nav>

        <div className="border-t border-primary-foreground/15 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-primary-foreground/10 p-3 backdrop-blur-sm">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-semibold">
                {getInitials(profile?.full_name || 'User')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {profile?.full_name || 'Utilisateur'}
              </p>
              <p className="text-xs text-secondary/90 truncate">
                {profile?.role === 'super_admin' ? 'Super Administr...' : profile?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-4 md:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/15">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 border-none bg-primary text-primary-foreground">
                <div className="flex h-20 items-center gap-3 border-b border-primary-foreground/20 px-6">
                  <Image
                    src="/logo-navbare.png"
                    alt="Logo PMN"
                    width={48}
                    height={48}
                    className="drop-shadow-md"
                  />
                  <div>
                    <h1 className="text-lg font-semibold leading-tight">Archive PMN</h1>
                    <p className="text-xs font-medium text-secondary">Plateforme numérique</p>
                  </div>
                </div>

                <nav className="flex-1 space-y-2 overflow-y-auto p-4 max-h-[calc(100vh-200px)]">
                  <NavLinks />
                </nav>

                <div className="border-t border-primary-foreground/15 p-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-primary-foreground/10 p-3 backdrop-blur-sm">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-semibold">
                        {getInitials(profile?.full_name || 'User')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {profile?.full_name || 'Utilisateur'}
                      </p>
                      <p className="text-xs text-secondary/90 truncate">
                        {profile?.role === 'super_admin' ? 'Super Administrateur' : profile?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSignOut}
                      className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <Image
                src="/logo-navbare.png"
                alt="Logo PMN"
                width={32}
                height={32}
              />
              <h1 className="text-base font-semibold text-primary">Archive PMN</h1>
            </div>
          </div>
          <NotificationsBell />
        </header>

        <main className="flex-1 overflow-y-auto bg-transparent px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardContent>{children}</DashboardContent>;
}
