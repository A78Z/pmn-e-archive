'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { DocumentHelpers } from '@/lib/parse-helpers';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CleanupPage() {
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [stats, setStats] = useState({ total: 0, deleted: 0, errors: 0 });

    const handleCleanup = async () => {
        setIsDeleting(true);
        setStats({ total: 0, deleted: 0, errors: 0 });

        try {
            // Récupérer tous les documents
            const documents = await DocumentHelpers.getAll();
            setStats(prev => ({ ...prev, total: documents.length }));

            if (documents.length === 0) {
                toast.success('Aucun document à supprimer');
                setIsDeleting(false);
                return;
            }

            toast.loading(`Suppression de ${documents.length} documents...`);

            // Supprimer chaque document
            for (const doc of documents) {
                try {
                    await DocumentHelpers.delete(doc.id);
                    setStats(prev => ({ ...prev, deleted: prev.deleted + 1 }));
                } catch (error) {
                    console.error(`Erreur suppression ${doc.id}:`, error);
                    setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
                }
            }

            toast.dismiss();
            toast.success(`✅ ${stats.deleted} documents supprimés`);

            // Rafraîchir le dashboard
            window.dispatchEvent(new Event('refreshDashboard'));

        } catch (error) {
            console.error('Erreur nettoyage:', error);
            toast.error('Erreur lors du nettoyage');
        } finally {
            setIsDeleting(false);
            setShowConfirm(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-8">
            {/* Header */}
            <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    Zone Dangereuse
                </span>
                <h1 className="mt-4 text-3xl md:text-4xl font-bold text-gray-900">
                    Nettoyage de la Base de Données
                </h1>
                <p className="text-gray-500 mt-2">
                    Supprimez tous les documents et fichiers de la base de données
                </p>
            </div>

            {/* Warning Card */}
            <Card className="border-red-200 bg-red-50">
                <CardHeader>
                    <CardTitle className="text-red-900 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Attention !
                    </CardTitle>
                    <CardDescription className="text-red-700">
                        Cette action est <strong>irréversible</strong>. Tous les documents et leurs fichiers associés seront définitivement supprimés de Back4App.
                    </CardDescription>
                </CardHeader>
            </Card>

            {/* Stats Card */}
            {stats.total > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Progression</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Total</span>
                                <span className="font-semibold">{stats.total}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Supprimés</span>
                                <span className="font-semibold text-green-600">{stats.deleted}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Erreurs</span>
                                <span className="font-semibold text-red-600">{stats.errors}</span>
                            </div>
                            {stats.total > 0 && (
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(stats.deleted / stats.total) * 100}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Action Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Supprimer Tous les Documents</CardTitle>
                    <CardDescription>
                        Cette action supprimera tous les documents de la base de données et leurs fichiers associés du stockage Back4App.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="destructive"
                        size="lg"
                        onClick={() => setShowConfirm(true)}
                        disabled={isDeleting}
                        className="w-full"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Suppression en cours...
                            </>
                        ) : (
                            <>
                                <Trash2 className="mr-2 h-5 w-5" />
                                Supprimer Tous les Documents
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Success Message */}
            {stats.deleted > 0 && !isDeleting && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                            <div>
                                <p className="font-semibold text-green-900">
                                    Nettoyage terminé !
                                </p>
                                <p className="text-sm text-green-700">
                                    {stats.deleted} documents et fichiers supprimés avec succès
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Confirmation Dialog */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action ne peut pas être annulée. Cela supprimera définitivement tous les documents et leurs fichiers du stockage Back4App.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCleanup}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Oui, tout supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
