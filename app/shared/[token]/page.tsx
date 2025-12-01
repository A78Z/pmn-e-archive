'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShareHelpers, FileHelpers } from '@/lib/parse-helpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Folder, Download, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function SharedPage() {
    const params = useParams();
    const token = params?.token as string;
    const [share, setShare] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            fetchShare();
        }
    }, [token]);

    const fetchShare = async () => {
        try {
            const data = await ShareHelpers.getByToken(token);
            if (!data) {
                setError('Lien de partage invalide ou expiré.');
            } else {
                setShare(data);
            }
        } catch (err) {
            console.error('Error fetching share:', err);
            setError('Une erreur est survenue lors du chargement du partage.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!share || !share.document) return;

        try {
            // Assuming document has a file field which is a Parse File
            // Or we use FileHelpers if we have a file ID.
            // But usually document object has the file.
            // Let's check how we handle downloads in other places.
            // In app/dashboard/shares/page.tsx we used fetch on the file URL.

            const fileUrl = share.document.file?.url;
            if (fileUrl) {
                const response = await fetch(fileUrl);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = share.document.name;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                alert("Fichier introuvable");
            }

        } catch (err) {
            console.error('Download error:', err);
            alert('Erreur lors du téléchargement');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
                <Card className="w-full max-w-md border-red-200 bg-red-50">
                    <CardContent className="flex flex-col items-center py-8 text-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                        <h2 className="text-xl font-semibold text-red-700 mb-2">Erreur</h2>
                        <p className="text-red-600">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!share) return null;

    const isExpired = share.expires_at && new Date(share.expires_at) < new Date();

    if (isExpired) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
                <Card className="w-full max-w-md border-orange-200 bg-orange-50">
                    <CardContent className="flex flex-col items-center py-8 text-center">
                        <AlertCircle className="h-12 w-12 text-orange-500 mb-4" />
                        <h2 className="text-xl font-semibold text-orange-700 mb-2">Lien expiré</h2>
                        <p className="text-orange-600">Ce lien de partage a expiré.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Partage de document</h1>
                    <p className="text-gray-600 mt-2">
                        {share.shared_by_user ? `Partagé par ${share.shared_by_user.full_name}` : 'Document partagé'}
                    </p>
                </div>

                <Card className="border-0 shadow-lg">
                    <CardHeader className="border-b bg-white rounded-t-lg">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                {share.document ? (
                                    <FileText className="h-6 w-6 text-blue-600" />
                                ) : (
                                    <Folder className="h-6 w-6 text-yellow-600" />
                                )}
                            </div>
                            <div>
                                <CardTitle className="text-xl">
                                    {share.document?.name || share.folder?.name || 'Élément partagé'}
                                </CardTitle>
                                <CardDescription>
                                    {share.document && (
                                        <span>
                                            {share.document.size ? `${(share.document.size / 1024 / 1024).toFixed(2)} MB • ` : ''}
                                            {format(new Date(share.createdAt), 'dd MMM yyyy', { locale: fr })}
                                        </span>
                                    )}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="flex flex-col items-center gap-6">
                            <div className="text-center space-y-2">
                                <p className="text-gray-600">
                                    Vous avez accès à ce {share.document ? 'document' : 'dossier'}.
                                    {share.can_write && ' Vous pouvez le modifier.'}
                                </p>
                                {share.expires_at && (
                                    <p className="text-sm text-orange-600">
                                        Expire le {format(new Date(share.expires_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                                    </p>
                                )}
                            </div>

                            {share.document && (
                                <Button size="lg" className="w-full sm:w-auto" onClick={handleDownload}>
                                    <Download className="h-5 w-5 mr-2" />
                                    Télécharger le document
                                </Button>
                            )}

                            {/* Folder content display could go here if implemented */}
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-8 text-center text-sm text-gray-400">
                    &copy; {new Date().getFullYear()} Mobilier National. Tous droits réservés.
                </div>
            </div>
        </div>
    );
}
