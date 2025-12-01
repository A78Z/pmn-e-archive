'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/parse-auth';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
    const router = useRouter();
    const { profile, loading } = useAuth();

    useEffect(() => {
        if (!loading) {
            if (profile) {
                // Si l'utilisateur est connecté, rediriger vers le dashboard
                router.push('/dashboard');
            } else {
                // Sinon, rediriger vers la page de connexion
                router.push('/login');
            }
        }
    }, [profile, loading, router]);

    // Afficher un loader pendant la vérification
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-gray-600">Chargement...</p>
            </div>
        </div>
    );
}
