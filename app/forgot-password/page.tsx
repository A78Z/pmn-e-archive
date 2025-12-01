'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileArchive, Shield, ArrowLeft } from 'lucide-react';
import { Parse } from '@/lib/parse';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Email requis');
      return;
    }

    if (!validateEmail(email)) {
      setError('Format email invalide');
      return;
    }

    setLoading(true);

    try {
      await Parse.User.requestPasswordReset(email.toLowerCase());
      setSent(true);
      toast.success('Email de réinitialisation envoyé');
    } catch (error: any) {
      setError(error.message || 'Erreur lors de l\'envoi');
      toast.error('Erreur lors de l\'envoi de l\'email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-700 shadow-lg">
              <FileArchive className="h-10 w-10 text-yellow-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mot de passe oublié</h1>
          <p className="text-gray-600 text-sm">Réinitialisez votre mot de passe</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Shield className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Email envoyé
                </h3>
                <p className="text-gray-600 text-sm">
                  Consultez votre boîte email pour réinitialiser votre mot de passe.
                </p>
              </div>
              <Link href="/login">
                <Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-white">
                  Retour à la connexion
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <p className="text-gray-600 text-sm text-center mb-6">
                Entrez votre adresse email pour recevoir un lien de réinitialisation
              </p>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
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
                      setError('');
                    }}
                    className={`h-12 pr-10 ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  <Shield className="absolute right-3 top-3.5 h-5 w-5 text-gray-400" />
                </div>
                {error && (
                  <p className="text-red-500 text-sm mt-1">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-medium text-base rounded-xl shadow-lg transition-all"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span>Envoi...</span>
                  </div>
                ) : (
                  'Envoyer le lien'
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-sm text-green-700 hover:text-green-800 font-medium inline-flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
