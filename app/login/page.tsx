'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/parse-auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'Email requis';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Invalid email';
    }

    if (!password) {
      newErrors.password = 'Mot de passe requis';
    } else if (password.length < 6) {
      newErrors.password = 'Mot de passe trop court (min. 6 caractères)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);

      // Wait a bit for profile to be set
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check user verification status from profile
      if (profile && !profile.is_verified) {
        toast.error('🔒 Votre compte est en attente de validation par le Super Administrateur.');
        return;
      }

      if (profile && !profile.is_active) {
        toast.error('Votre compte a été désactivé. Contactez l\'administrateur.');
        return;
      }

      const redirectTo = searchParams.get('redirect');
      const destination =
        redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard';

      // Save session token to cookie for middleware
      if (typeof window !== 'undefined') {
        const Parse = (await import('@/lib/parse')).Parse;
        const currentUser = Parse.User.current();
        if (currentUser) {
          document.cookie = `parse-session-token=${currentUser.getSessionToken()}; path=/; max-age=${rememberMe ? 2592000 : 86400}`;
        }
      }

      toast.success('Connexion réussie');
      router.push(destination);
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erreur de connexion';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-navbare.png"
              alt="Logo Projet Mobilier National"
              width={140}
              height={140}
              priority
              className="drop-shadow-xl"
            />
          </div>
          <h1 className="text-3xl font-semibold text-primary mb-1">Archive PMN</h1>
          <p className="text-base text-foreground/70 font-medium">Plateforme d&apos;archivage numérique</p>
          <p className="text-xs uppercase tracking-[0.3em] text-secondary mt-3">Projet Mobilier National</p>
        </div>

        <div className="surface p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-primary/80">
                Email
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="ali@pmn.sn"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors({ ...errors, email: undefined });
                  }}
                  className={cn(
                    'h-12 pr-10 rounded-xl bg-transparent ring-0 focus-visible:ring-4 focus-visible:ring-ring/20',
                    errors.email ? 'border-destructive focus-visible:ring-destructive/30' : 'border-border'
                  )}
                />
                <Shield className="absolute right-3 top-3.5 h-5 w-5 text-primary/40" />
              </div>
              {errors.email && (
                <p className="text-destructive text-sm mt-1 font-medium">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-primary/80">
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors({ ...errors, password: undefined });
                  }}
                  className={cn(
                    'h-12 pr-20 rounded-xl bg-transparent ring-0 focus-visible:ring-4 focus-visible:ring-ring/20',
                    errors.password ? 'border-destructive focus-visible:ring-destructive/30' : 'border-border'
                  )}
                />
                <div className="absolute right-3 top-3.5 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary/40" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-primary/40 hover:text-primary/80 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-foreground/70 cursor-pointer"
                >
                  Se souvenir de moi
                </label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:text-secondary transition-colors"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-xl shadow-primary/30 transition-all hover:scale-[1.01] hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/30"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                  <span>Connexion...</span>
                </div>
              ) : (
                'Se connecter'
              )}
            </Button>

            <div className="text-center pt-2">
              <Link
                href="/register"
                className="text-sm font-medium text-primary hover:text-secondary transition-colors"
              >
                Créer un compte agent
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
