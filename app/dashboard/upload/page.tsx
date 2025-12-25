'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Folder, X, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/parse-auth';
import { FolderHelpers, DocumentHelpers, FileHelpers } from '@/lib/parse-helpers';
import { Parse } from '@/lib/parse';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { sanitizeFilenames, needsSanitization, validateFilename } from '@/lib/filename-utils';

interface FolderOption {
  id: string;
  name: string;
  path: string;
}

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileUploadState {
  file: File;
  originalName: string;
  sanitizedName: string;
  renamed: boolean;
  status: FileStatus;
  error?: string;
  progress: number;
}

export default function UploadPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [fileStates, setFileStates] = useState<FileUploadState[]>([]);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [destinationFolder, setDestinationFolder] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showRenamedWarning, setShowRenamedWarning] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchFolders();
    }
  }, [profile]);

  // Helper to safely get parent ID from various formats
  const getParentId = (folder: any): string | null => {
    if (!folder || !folder.parent_id) return null;

    // If it's already a string
    if (typeof folder.parent_id === 'string') {
      return folder.parent_id;
    }

    // If it's a Parse Pointer or Object (has .id or .objectId)
    if (typeof folder.parent_id === 'object') {
      // Check for common ID fields
      if (folder.parent_id.id) return folder.parent_id.id;
      if (folder.parent_id.objectId) return folder.parent_id.objectId;
    }

    return null;
  };

  // Helper to get full path of a folder
  const getFolderPath = (folderId: string, allFolders: any[]): string => {
    const folder = allFolders.find(f => f.id === folderId);
    if (!folder) return '';

    // Safety check for circular references or deep nesting
    const parts = [folder.name];
    let current = folder;
    let depth = 0;

    // Navigate up the tree
    while (depth < 20) { // Increased depth limit to support deep archiving
      const parentId = getParentId(current);

      if (!parentId) break;

      const parent = allFolders.find(f => f.id === parentId);
      if (parent) {
        parts.unshift(parent.name);
        current = parent;
        depth++;
      } else {
        break;
      }
    }

    return parts.join(' > ');
  };

  const fetchFolders = async () => {
    try {
      // Get current user from Parse
      const currentUser = Parse.User.current();
      if (!currentUser || !profile) {
        console.warn('No authenticated user, skipping folder fetch');
        return;
      }

      // Check for admin role
      const isAdmin = ['super_admin', 'admin'].includes(profile.role);

      // Fetch folders based on role
      const data = isAdmin
        ? await FolderHelpers.getAllForAdmin()
        : await FolderHelpers.getAllByUser(currentUser.id as string);

      // Map folders with full path
      const options = data.map((f: any) => ({
        id: f.id,
        name: f.name,
        path: getFolderPath(f.id, data)
      })).sort((a: FolderOption, b: FolderOption) => a.path.localeCompare(b.path));

      setFolders(options);
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFolderSelect = () => {
    folderInputRef.current?.click();
  };

  const processFiles = (files: File[]) => {
    const newFileStates: FileUploadState[] = files.map((file) => {
      const { valid, errors } = validateFilename(file.name);

      return {
        file,
        originalName: file.name,
        sanitizedName: file.name, // Keep original name by default
        renamed: false,
        status: valid ? 'pending' : 'error',
        error: valid ? undefined : errors.join(', '),
        progress: 0
      };
    });

    setFileStates(prev => [...prev, ...newFileStates]);
  };

  const handleRename = (index: number, newName: string) => {
    const { valid, errors } = validateFilename(newName);

    setFileStates(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        sanitizedName: newName,
        status: valid ? 'pending' : 'error',
        error: valid ? undefined : errors.join(', ')
      };
      return updated;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      processFiles(newFiles);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      processFiles(newFiles);
    }
  };

  const removeFile = (index: number) => {
    setFileStates(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      processFiles(newFiles);
    }
  };

  const uploadSingleFile = async (fileState: FileUploadState, index: number): Promise<void> => {
    try {
      // Update status to uploading
      setFileStates(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'uploading', progress: 10 };
        return updated;
      });

      // Check file size
      const fileSizeInMB = fileState.file.size / (1024 * 1024);
      if (fileSizeInMB > 50) {
        throw new Error('Le fichier dépasse la taille limite de 50MB');
      }

      // Upload file to Parse
      // We use uploadFile which handles the Parse.File creation and saving
      // It also calls sanitizeFilename internally, but we've relaxed it to be permissive
      setFileStates(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], progress: 30 };
        return updated;
      });

      const parseFile = await FileHelpers.uploadFile(fileState.file, fileState.sanitizedName);
      const fileUrl = FileHelpers.getFileUrl(parseFile);

      setFileStates(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], progress: 70 };
        return updated;
      });

      // Create document record
      await DocumentHelpers.create({
        name: fileState.sanitizedName,
        description: description || null,
        file_path: fileUrl,
        file_size: fileState.file.size,
        file_type: fileState.file.type,
        folder_id: destinationFolder || null,
        category: category,
        uploaded_by: profile?.id,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
      });

      // Update status to success
      setFileStates(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'success', progress: 100 };
        return updated;
      });

    } catch (error: any) {
      console.error('Error uploading file:', error);
      setFileStates(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: 'error',
          error: error.message || 'Erreur lors de l\'upload'
        };
        return updated;
      });
    }
  };

  const handleUpload = async () => {
    if (fileStates.length === 0) {
      toast.error('Veuillez sélectionner au moins un fichier');
      return;
    }

    if (!category) {
      toast.error('Veuillez sélectionner une catégorie');
      return;
    }

    setUploading(true);

    // Filter pending files
    const pendingFiles = fileStates.map((fs, index) => ({ fs, index }))
      .filter(({ fs }) => fs.status === 'pending');

    if (pendingFiles.length === 0) {
      toast.error('Aucun fichier en attente');
      setUploading(false);
      return;
    }

    // Process files sequentially to avoid overwhelming the server
    for (const { fs, index } of pendingFiles) {
      await uploadSingleFile(fs, index);
    }

    setUploading(false);

    const successCountAfterUpload = fileStates.filter(fs => fs.status === 'success').length;
    const errorCountAfterUpload = fileStates.filter(fs => fs.status === 'error').length;

    if (errorCountAfterUpload === 0) {
      toast.success(
        `✅ Upload terminé avec succès`,
        {
          description: `${successCountAfterUpload} fichier(s) uploadé(s).`,
          duration: 5000
        }
      );
      setTimeout(() => {
        router.push('/dashboard/documents');
      }, 2000);
    } else if (successCountAfterUpload === 0) {
      toast.error(
        `❌ Échec de l'upload`,
        {
          description: `${errorCountAfterUpload} fichier(s) ont échoué. Vérifiez les erreurs ci-dessous.`,
          duration: 6000
        }
      );
    } else {
      toast.warning(
        `⚠️ Upload partiel`,
        {
          description: `${successCountAfterUpload} réussi(s), ${errorCountAfterUpload} échoué(s). Vous pouvez relancer les fichiers échoués.`,
          duration: 6000
        }
      );
    }
  };

  const retryFailedFiles = async () => {
    // Reset failed files to pending
    setFileStates(prev =>
      prev.map(fs =>
        fs.status === 'error' && !fs.error?.includes('interdits') // Don't retry validation errors without rename
          ? { ...fs, status: 'pending' as FileStatus, error: undefined, progress: 0 }
          : fs
      )
    );

    // Trigger upload
    await handleUpload();
  };

  const handleCancel = () => {
    router.push('/dashboard/documents');
  };

  const totalFiles = fileStates.length;
  const successCount = fileStates.filter(fs => fs.status === 'success').length;
  const errorCount = fileStates.filter(fs => fs.status === 'error').length;
  const pendingCount = fileStates.filter(fs => fs.status === 'pending').length;
  const uploadingCount = fileStates.filter(fs => fs.status === 'uploading').length;
  // const renamedCount = fileStates.filter(fs => fs.renamed).length; // No longer used

  const overallProgress = totalFiles > 0
    ? Math.round((successCount / totalFiles) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Uploader</h1>
        <p className="text-gray-600 mt-1">Téléchargez de nouveaux documents</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-base font-semibold">
            Fichiers <span className="text-red-500">*</span>
          </Label>

          <div
            className={`border-2 border-dashed rounded-lg p-12 transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-500" />
              </div>

              <div className="text-center">
                <p className="text-base font-medium text-gray-900 mb-1">
                  Cliquez pour sélectionner ou glissez vos fichiers ici
                </p>
                <p className="text-sm text-gray-500">
                  Supports: PDF, DOC, DOCX, JPG, PNG (max. 50MB par fichier)
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFileSelect}
                  className="gap-2"
                  disabled={uploading}
                >
                  <FileText className="w-4 h-4" />
                  Sélectionner des fichiers
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFolderSelect}
                  className="gap-2"
                  disabled={uploading}
                >
                  <Folder className="w-4 h-4" />
                  Sélectionner un dossier
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFolderChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
            </div>
          </div>

          {/* File list */}
          {fileStates.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {totalFiles} fichier(s) • {successCount} réussi(s) • {errorCount} échoué(s)
                </p>
                {errorCount > 0 && !uploading && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={retryFailedFiles}
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Relancer les fichiers échoués
                  </Button>
                )}
              </div>

              <div className="space-y-1 max-h-96 overflow-y-auto">
                {fileStates.map((fileState, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between border rounded-md px-3 py-2 text-sm ${fileState.status === 'success' ? 'bg-green-50 border-green-200' :
                      fileState.status === 'error' ? 'bg-red-50 border-red-200' :
                        fileState.status === 'uploading' ? 'bg-blue-50 border-blue-200' :
                          'bg-white'
                      }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {fileState.status === 'success' && (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      )}
                      {fileState.status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      )}
                      {fileState.status === 'uploading' && (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      )}
                      {fileState.status === 'pending' && (
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        {fileState.status === 'error' && fileState.error?.includes('interdits') ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={fileState.sanitizedName}
                              onChange={(e) => handleRename(index, e.target.value)}
                              className="h-7 text-sm py-0 px-2 w-full max-w-md border-red-300 focus:border-red-500"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleRename(index, fileState.sanitizedName)} // Re-validate
                            >
                              Valider
                            </Button>
                          </div>
                        ) : (
                          <p className={`truncate font-medium ${fileState.status === 'error' ? 'text-red-700' : 'text-gray-700'}`}>
                            {fileState.sanitizedName}
                          </p>
                        )}

                        {fileState.status === 'error' && (
                          <p className="text-xs text-red-600 mt-0.5">
                            {fileState.error}
                          </p>
                        )}
                        {fileState.status === 'uploading' && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${fileState.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {(fileState.file.size / 1024).toFixed(1)} KB
                      </span>
                      {!uploading && fileState.status !== 'success' && (
                        <button
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overall progress */}
          {uploading && (
            <div className="mt-6 space-y-3 bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-900">
                    Upload en cours...
                  </p>
                  <p className="text-xs text-blue-700">
                    {successCount} / {totalFiles} fichiers uploadés
                  </p>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {overallProgress}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category" className="text-base font-semibold">
              Catégorie <span className="text-red-500">*</span> (pour tous les fichiers)
            </Label>
            <Select value={category} onValueChange={(value) => setCategory(value)}>
              <SelectTrigger className="h-11 border-2 border-green-600">
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Archives">Archives</SelectItem>
                <SelectItem value="Administration">Administration</SelectItem>
                <SelectItem value="Comptabilité">Comptabilité</SelectItem>
                <SelectItem value="Ressources Humaines">Ressources Humaines</SelectItem>
                <SelectItem value="Logistique">Logistique</SelectItem>
                <SelectItem value="Communication">Communication</SelectItem>
                <SelectItem value="Planification / Suivi-Évaluation">Planification / Suivi-Évaluation</SelectItem>
                <SelectItem value="Procédures & Marchés Publics">Procédures & Marchés Publics</SelectItem>
                <SelectItem value="Rapports & Études">Rapports & Études</SelectItem>
                <SelectItem value="Correspondances">Correspondances</SelectItem>
                <SelectItem value="Documents Techniques">Documents Techniques</SelectItem>
                <SelectItem value="Partenariats">Partenariats</SelectItem>
                <SelectItem value="Ateliers & Formations">Ateliers & Formations</SelectItem>
                <SelectItem value="Patrimoine / Inventaire">Patrimoine / Inventaire</SelectItem>
                <SelectItem value="Photos & Multimédia">Photos & Multimédia</SelectItem>
                <SelectItem value="Autres Documents">Autres Documents</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="destinationFolder" className="text-base font-semibold">
              Dossier de destination
            </Label>
            <Select value={destinationFolder} onValueChange={(value) => setDestinationFolder(value === 'root' ? undefined : value)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Racine (aucun dossier)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Racine (aucun dossier)</SelectItem>
                {folders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-base font-semibold">
            Description (optionnelle, appliquée à tous)
          </Label>
          <Textarea
            id="description"
            placeholder="Décrivez le contenu des documents..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags" className="text-base font-semibold">
            Mots-clés (optionnels, appliqués à tous)
          </Label>
          <Input
            id="tags"
            placeholder="mobilier, inventaire, historique (séparés par des virgules)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="h-11"
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={uploading}
            className="h-11 px-6 w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading || fileStates.length === 0 || !category || pendingCount === 0}
            className="h-11 px-6 bg-green-600 hover:bg-green-700 gap-2 w-full sm:w-auto"
          >
            <Upload className="w-4 h-4" />
            {uploading
              ? 'Upload en cours...'
              : `Uploader ${pendingCount} document(s)`
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
