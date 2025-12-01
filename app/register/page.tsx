'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/parse-auth';
import { Parse } from '@/lib/parse';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const FUNCTIONS = [
  'Coordonnateur du Projet Mobilier National',
  'Coordonnateur adjoint du Projet Mobilier National',
  'Responsable Administratif et Financier',
  'Comptable',
  'Comptable des matières',
  'Ressources humaines',
  'Pôle programmes et projets',
  'Pôle Passation des marchés',
  'Responsable Courriers',
  'Assistante',
  "Agent d'archive",
  'Développeur web',
];

const ROLES = [
  { value: 'super_admin', label: 'Super Administrateur' },
  { value: 'admin', label: 'Administrateur' },
  { value: 'user', label: 'Agent Standard' },
  { value: 'guest', label: 'Agent Invité' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [fonction, setFonction] = useState('');
  const [role, setRole] = useState('user');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    fonction?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@pmn\.sn$/i;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!fullName || fullName.trim().length < 2) {
      newErrors.fullName = "Nom d'utilisateur requis (min. 2 caractères)";
    }

    if (!email) {
      newErrors.email = 'Email requis';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Email doit être au format @pmn.sn';
    }

    if (!fonction) {
      newErrors.fonction = 'Veuillez sélectionner une fonction';
    }

    if (!password) {
      newErrors.password = 'Mot de passe requis';
    } else if (password.length < 6) {
      newErrors.password = 'Mot de passe trop court (min. 6 caractères)';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmation requise';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const userQuery = new Parse.Query(Parse.User);
      userQuery.equalTo('email', normalizedEmail);
      const existingUser = await userQuery.first();

      if (existingUser) {
        toast.error('Cet utilisateur existe déjà. Essayez de vous connecter ou utilisez un autre email.');
        setLoading(false);
        return;
      }

      // Sign up the user - Always create as 'user' role for security
      await signUp(normalizedEmail, password, fullName, {
        fonction,
        role: 'user', // Force user role, admin must upgrade later
      });

      toast.success('✅ Compte créé avec succès. En attente de validation par le Super Administrateur.', {
        duration: 4000,
      });

      // Sign out immediately after registration (user needs to be verified first)
      await Parse.User.logOut();

      setTimeout(() => {
        router.push('/login');
      }, 4000);
    } catch (error: any) {
      console.error('Registration error:', error);

      if (error.message.includes('already') || error.message.includes('taken')) {
        toast.error('Cet utilisateur existe déjà. Essayez de vous connecter ou utilisez un autre email.');
      } else {
        toast.error(error.message || 'Erreur lors de la création du compte. Veuillez vérifier vos informations.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-navbare.png"
              alt="Logo Projet Mobilier National"
              width={120}
              height={120}
              priority
              className="drop-shadow-xl"
            />
          </div>
          <h1 className="text-3xl font-semibold text-primary mb-1">Créer un compte</h1>
          <p className="text-base text-foreground/70 font-medium">Nouveau compte agent PMN</p>
          <p className="text-xs uppercase tracking-[0.3em] text-secondary mt-3">Archive numérique</p>
        </div>

        <div className="surface p-8">
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium text-primary/80">
                Nom d'utilisateur
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="MOUSSA SYLLA"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setErrors({ ...errors, fullName: undefined });
                }}
                className={cn(
                  'h-12 rounded-xl bg-transparent focus-visible:ring-4 focus-visible:ring-ring/20',
                  errors.fullName ? 'border-destructive focus-visible:ring-destructive/30' : 'border-border'
                )}
              />
              {errors.fullName && (
                <p className="text-destructive text-sm mt-1 font-medium">{errors.fullName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-primary/80">
                Email
              </Label>
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
                  'h-12 rounded-xl bg-transparent focus-visible:ring-4 focus-visible:ring-ring/20',
                  errors.email ? 'border-destructive focus-visible:ring-destructive/30' : 'border-border'
                )}
              />
              {errors.email && (
                <p className="text-destructive text-sm mt-1 font-medium">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fonction" className="text-sm font-medium text-primary/80">
                Fonction
              </Label>
              <Select value={fonction} onValueChange={(value) => {
                setFonction(value);
                setErrors({ ...errors, fonction: undefined });
              }}>
                <SelectTrigger
                  className={cn(
                    'h-12 rounded-xl',
                    errors.fonction ? 'border-destructive focus-visible:ring-destructive/30' : 'border-border'
                  )}
                >
                  <SelectValue placeholder="Sélectionner une fonction" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {FUNCTIONS.map((func) => (
                    <SelectItem key={func} value={func} className="py-2">
                      {func}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fonction && (
                <p className="text-destructive text-sm mt-1 font-medium">{errors.fonction}</p>
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
                  placeholder="•••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors({ ...errors, password: undefined });
                  }}
                  className={cn(
                    'h-12 pr-20 rounded-xl bg-transparent focus-visible:ring-4 focus-visible:ring-ring/20',
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
                <p className="text-destructive text-sm mt-1 font-medium">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-primary/80">
                Confirmer le mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrors({ ...errors, confirmPassword: undefined });
                  }}
                  className={cn(
                    'h-12 pr-10 rounded-xl bg-transparent focus-visible:ring-4 focus-visible:ring-ring/20',
                    errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive/30' : 'border-border'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3.5 text-primary/40 hover:text-primary/80 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-destructive text-sm mt-1 font-medium">{errors.confirmPassword}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-xl shadow-primary/30 transition-all hover:scale-[1.01] hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/30"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                  <span>Création...</span>
                </div>
              ) : (
                'Créer le compte'
              )}
            </Button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="text-sm font-medium text-primary hover:text-secondary transition-colors"
              >
                Retour à la connexion
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
