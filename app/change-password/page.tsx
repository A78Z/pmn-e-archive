'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Parse } from '@/lib/parse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = Parse.User.current();
    if (!user) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (password !== confirm) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      const user = Parse.User.current();
      if (!user) {
        router.replace('/login');
        return;
      }
      user.set('password', password);
      user.set('must_change_password', false);
      await user.save();
      toast.success('Mot de passe modifié avec succès');
      router.replace('/dashboard');
    } catch (error: any) {
      console.error('Change password error:', error);
      toast.error(error?.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <Image src="/assets/pmn-logo.png" alt="Logo PMN" width={96} height={96} priority className="drop-shadow-xl" />
          </div>
          <h1 className="text-2xl font-semibold text-pmn-ink">Changer votre mot de passe</h1>
          <p className="mt-2 text-sm text-pmn-subtle">
            Pour votre sécurité, définissez un nouveau mot de passe avant d&apos;accéder à la plateforme.
          </p>
        </div>

        <div className="surface p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pmn-faint" />
                <Input
                  id="new-password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 8 caractères"
                  className="pl-9 pr-10"
                  autoFocus
                />
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-pmn-faint">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pmn-faint" />
                <Input
                  id="confirm-password"
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="pl-9"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] font-semibold text-white shadow-cta transition-[filter] hover:brightness-110"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer et continuer
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
