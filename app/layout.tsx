import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AutoRefresh } from '@/components/auto-refresh';
import { AuthProvider } from '@/lib/parse-auth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Archive PMN - Projet Mobilier National',
  description: 'Plateforme d\'archivage numérique du Projet Mobilier National',
  icons: {
    icon: '/logo-navbare.png',
    apple: '/logo-navbare.png',
  },
};

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <AutoRefresh />
          {children}
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
