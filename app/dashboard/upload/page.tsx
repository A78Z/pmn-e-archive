'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Folder, X, AlertCircle, CheckCircle, RefreshCw, FolderInput, ChevronDown, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/parse-auth';
import { FolderHelpers, DocumentHelpers, FileHelpers } from '@/lib/parse-helpers';
import { Parse } from '@/lib/parse';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { sanitizeFilenames, needsSanitization, validateFilename } from '@/lib/filename-utils';
import { ExtBadge } from '@/components/pmn-icons';
import { DestinationPicker } from '@/components/destination-picker';
import { computeSHA256, formatBytes } from '@/lib/file-hash';

interface FolderOption {
  id: string;
  name: string;
  path: string;
}

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

interface DuplicateInfo {
  type: 'exact' | 'probable';
  name: string;
  path: string;
}

interface FileUploadState {
  file: File;
  originalName: string;
  sanitizedName: string;
  renamed: boolean;
  status: FileStatus;
  error?: string;
  progress: number;
  // Détection de doublons (additif)
  fileHash?: string;
  fileSize?: number;
  checking?: boolean;        // détection de doublon en cours
  duplicate?: DuplicateInfo; // doublon détecté (avertissement non bloquant)
  skip?: boolean;            // « Ignorer ce fichier » choisi par l'utilisateur
}

export default function UploadPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [fileStates, setFileStates] = useState<FileUploadState[]>([]);
  const fileStatesRef = useRef<FileUploadState[]>([]);
  useEffect(() => { fileStatesRef.current = fileStates; }, [fileStates]);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [destinationFolder, setDestinationFolder] = useState<string | undefined>(undefined);
  const [destinationPath, setDestinationPath] = useState<string>('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // Suggestion IA (optionnelle, dégradation propre)
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ id: string; path: string }>>([]);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showRenamedWarning, setShowRenamedWarning] = useState(false);

  // Le sélecteur de destination charge les dossiers à la demande
  // (recherche + arbre paresseux) : plus de chargement massif ici.

  // Health-check IA (une fois) : la suggestion n'est proposée que si l'IA
  // répond OK. Sinon, section masquée — aucune erreur, aucun blocage.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai-search')
      .then(r => r.json())
      .then(d => { if (!cancelled) setAiAvailable(Boolean(d?.keyPresent && d?.testCall === 'ok')); })
      .catch(() => { if (!cancelled) setAiAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  // Suggestions IA de destination à partir des noms de fichiers + catégorie
  const fileNamesKey = fileStates.map(f => f.sanitizedName).join('|');
  useEffect(() => {
    if (!aiAvailable) { setAiSuggestions([]); return; }
    const names = fileStates.map(f => f.sanitizedName).slice(0, 10);
    if (names.length === 0) { setAiSuggestions([]); return; }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const query = [category, ...names].filter(Boolean).join(' ');
        const res = await fetch('/api/ai-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && Array.isArray(data?.results)) {
          const dossiers = data.results
            .filter((r: any) => r.type === 'dossier')
            .slice(0, 3)
            .map((r: any) => ({ id: r.objectId, path: r.path }));
          setAiSuggestions(dossiers);
        } else {
          setAiSuggestions([]);
        }
      } catch {
        if (!cancelled) setAiSuggestions([]);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiAvailable, fileNamesKey, category]);

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
  const getFolderPath = (folderId: string, folderMap: Map<string, any>): string => {
    const folder = folderMap.get(folderId);
    if (!folder) return '';

    // Safety check for circular references or deep nesting
    const parts = [folder.name];
    let current = folder;
    let depth = 0;

    // Navigate up the tree
    while (depth < 20) { // Increased depth limit to support deep archiving
      const parentId = getParentId(current);

      if (!parentId) break;

      const parent = folderMap.get(parentId);
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

      // Create a Map for O(1) access to folders by ID
      const folderMap = new Map();
      data.forEach((f: any) => folderMap.set(f.id, f));

      // Map folders with full path using the Map
      const options = data.map((f: any) => ({
        id: f.id,
        name: f.name,
        path: getFolderPath(f.id, folderMap)
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
    const baseIndex = fileStatesRef.current.length;
    const newFileStates: FileUploadState[] = files.map((file) => {
      const { valid, errors } = validateFilename(file.name);

      return {
        file,
        originalName: file.name,
        sanitizedName: file.name, // Keep original name by default
        renamed: false,
        status: valid ? 'pending' : 'error',
        error: valid ? undefined : errors.join(', '),
        progress: 0,
        fileSize: file.size,
        checking: true,
      };
    });

    setFileStates(prev => [...prev, ...newFileStates]);

    // Détection de doublons en arrière-plan (non bloquante)
    files.forEach((file, i) => {
      detectDuplicate(file, baseIndex + i);
    });
  };

  // Calcule l'empreinte SHA-256 et cherche un doublon existant (exact puis
  // nom+taille). N'empêche jamais l'upload : simple avertissement.
  const detectDuplicate = async (file: File, index: number) => {
    let hash: string | undefined;
    try {
      hash = await computeSHA256(file);
    } catch (e) {
      console.warn('Hash impossible pour', file.name, e);
    }
    try {
      const match = await DocumentHelpers.findDuplicate({ hash, name: file.name, size: file.size });
      let duplicate: DuplicateInfo | undefined;
      if (match) {
        const folderId = match.doc.folder_id as string | undefined;
        const path = folderId
          ? (await FolderHelpers.resolvePaths([folderId]))[folderId] || 'Racine'
          : 'Racine';
        duplicate = { type: match.type, name: match.doc.name, path };
      }
      setFileStates(prev => {
        const updated = [...prev];
        // Retrouver la ligne par référence de fichier (l'index peut avoir bougé)
        const idx = updated.findIndex(fs => fs.file === file);
        const target = idx >= 0 ? idx : index;
        if (updated[target]) {
          updated[target] = { ...updated[target], fileHash: hash, checking: false, duplicate };
        }
        return updated;
      });
    } catch (e) {
      console.warn('Détection doublon échouée pour', file.name, e);
      setFileStates(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(fs => fs.file === file);
        if (idx >= 0) updated[idx] = { ...updated[idx], fileHash: hash, checking: false };
        return updated;
      });
    }
  };

  // « Ignorer ce fichier » / « Importer quand même »
  const setSkipFile = (index: number, skip: boolean) => {
    setFileStates(prev => {
      const updated = [...prev];
      if (updated[index]) updated[index] = { ...updated[index], skip };
      return updated;
    });
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

      // Create document record (empreinte enregistrée pour accélérer les
      // futures détections de doublons)
      await DocumentHelpers.create({
        name: fileState.sanitizedName,
        description: description || null,
        file_path: fileUrl,
        file_size: fileState.file.size,
        file_type: fileState.file.type,
        file_hash: fileState.fileHash || null,
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

    // Filter pending files (hors fichiers explicitement ignorés pour doublon)
    const pendingFiles = fileStates.map((fs, index) => ({ fs, index }))
      .filter(({ fs }) => fs.status === 'pending' && !fs.skip);

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
  const pendingCount = fileStates.filter(fs => fs.status === 'pending' && !fs.skip).length;
  const uploadingCount = fileStates.filter(fs => fs.status === 'uploading').length;
  // const renamedCount = fileStates.filter(fs => fs.renamed).length; // No longer used

  const overallProgress = totalFiles > 0
    ? Math.round((successCount / totalFiles) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-[960px] animate-fade-up space-y-5 px-6 pb-12 pt-[34px] md:px-10">
      <div>
        <h1 className="text-[34px] font-semibold leading-tight tracking-[-.4px] text-pmn-ink-strong">
          Uploader des documents
        </h1>
        <p className="mt-[5px] text-[15px] text-pmn-subtle">
          Ajoutez vos fichiers à l&apos;archive et classez-les par catégorie
        </p>
      </div>

      <div className="surface space-y-6 p-[26px]">
        <div className="space-y-2">
          <div
            className={`rounded-[14px] border-2 border-dashed p-12 transition-colors ${isDragging
              ? 'border-pmn-gold bg-pmn-gold/[.06]'
              : 'border-pmn-green/[.28] bg-[linear-gradient(180deg,rgba(21,101,75,.03),rgba(228,180,41,.03))]'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-pmn-green/10 text-pmn-green">
                <Upload className="h-[34px] w-[34px]" strokeWidth={1.8} />
              </div>

              <div className="text-center">
                <p className="text-lg font-bold text-pmn-ink">
                  Glissez vos fichiers ici
                </p>
                <p className="mt-1.5 text-[13.5px] text-pmn-faint">
                  ou parcourez votre ordinateur — PDF, Word, Excel, images (max 50 Mo)
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  type="button"
                  onClick={handleFileSelect}
                  className="h-11 gap-2 rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] px-[22px] text-sm font-semibold text-white shadow-cta transition-[filter] hover:brightness-110"
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4" />
                  Parcourir les fichiers
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFolderSelect}
                  className="h-11 gap-2 rounded-[11px] border-pmn-green/30 text-sm font-semibold text-pmn-green hover:bg-pmn-green/[.06] hover:text-pmn-green"
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
                <div>
                  <p className="text-base font-bold text-pmn-ink">Fichiers en cours</p>
                  <p className="text-[12.5px] text-pmn-faint">
                    {totalFiles} fichier(s) sélectionné(s) • {successCount} réussi(s) • {errorCount} échoué(s)
                  </p>
                </div>
                {errorCount > 0 && !uploading && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={retryFailedFiles}
                    className="gap-2 rounded-[9px] border-pmn-green/30 text-pmn-green hover:bg-pmn-green/[.06] hover:text-pmn-green"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Relancer les fichiers échoués
                  </Button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {fileStates.map((fileState, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between gap-3 border-t border-[rgba(20,33,28,.06)] px-1 py-[13px] text-sm ${
                      fileState.status === 'error' ? 'bg-red-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="relative flex-none">
                        <ExtBadge name={fileState.sanitizedName} size={40} />
                        {fileState.status === 'success' && (
                          <CheckCircle className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-pmn-online" />
                        )}
                        {fileState.status === 'error' && (
                          <AlertCircle className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-destructive" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {fileState.status === 'error' && fileState.error?.includes('interdits') ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={fileState.sanitizedName}
                              onChange={(e) => handleRename(index, e.target.value)}
                              className="h-7 w-full max-w-md rounded-[9px] border-red-300 px-2 py-0 text-sm focus:border-red-500"
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
                          <p className={`truncate text-sm font-semibold ${fileState.status === 'error' ? 'text-destructive' : 'text-pmn-ink'}`}>
                            {fileState.sanitizedName}
                          </p>
                        )}

                        {fileState.status === 'error' && (
                          <p className="mt-0.5 text-xs text-destructive">
                            {fileState.error}
                          </p>
                        )}
                        {(fileState.status === 'uploading' || fileState.status === 'success') && (
                          <div className="mt-2 h-[7px] w-full overflow-hidden rounded-md bg-[#EDECE6]">
                            <div
                              className="h-full rounded-md bg-gradient-to-r from-[#1F8A63] to-[#15654B] transition-all duration-300"
                              style={{ width: `${fileState.status === 'success' ? 100 : fileState.progress}%` }}
                            />
                          </div>
                        )}

                        {/* Avertissement de doublon (non bloquant) */}
                        {fileState.duplicate && fileState.status !== 'success' && (
                          <div className={`mt-2 rounded-[9px] border p-2 text-xs ${fileState.skip ? 'border-border bg-pmn-hover' : 'border-pmn-gold/40 bg-pmn-gold/[.08]'}`}>
                            {fileState.skip ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-pmn-faint">Fichier ignoré (doublon) — ne sera pas importé.</span>
                                <button
                                  onClick={() => setSkipFile(index, false)}
                                  className="flex-none font-semibold text-pmn-green hover:underline"
                                >
                                  Rétablir
                                </button>
                              </div>
                            ) : (
                              <>
                                <p className="font-semibold text-pmn-gold-dark">
                                  {fileState.duplicate.type === 'exact'
                                    ? '⚠️ Fichier identique déjà présent'
                                    : '⚠️ Ce fichier semble déjà présent'}
                                </p>
                                <p className="mt-0.5 text-pmn-text2">
                                  « {fileState.duplicate.name} » dans <span className="font-medium">{fileState.duplicate.path}</span>
                                  {fileState.duplicate.type === 'probable' && ' (même nom et taille)'}
                                </p>
                                <div className="mt-1.5 flex gap-2">
                                  <button
                                    onClick={() => setSkipFile(index, true)}
                                    className="rounded-[7px] border border-pmn-green/30 px-2 py-0.5 font-semibold text-pmn-green hover:bg-pmn-green/[.06]"
                                  >
                                    Ignorer ce fichier
                                  </button>
                                  <span className="py-0.5 text-pmn-faint">ou</span>
                                  <span className="py-0.5 text-pmn-faint">Importer quand même (par défaut)</span>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {fileState.checking && fileState.status !== 'success' && (
                          <p className="mt-1 text-[11px] text-pmn-faint">Vérification des doublons…</p>
                        )}
                      </div>
                    </div>

                    <div className="ml-2 flex flex-none items-center gap-3">
                      <span className="whitespace-nowrap text-xs text-pmn-faint">
                        {(fileState.file.size / 1024).toFixed(1)} KB
                      </span>
                      {fileState.status === 'uploading' && (
                        <span className="w-[42px] text-right text-[12.5px] font-semibold text-pmn-green">
                          {fileState.progress}%
                        </span>
                      )}
                      {!uploading && fileState.status !== 'success' && (
                        <button
                          onClick={() => removeFile(index)}
                          className="text-pmn-faint transition-colors hover:text-pmn-subtle"
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
            <div className="mt-6 space-y-3 rounded-[14px] border border-pmn-green/20 bg-pmn-green/[.05] p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-pmn-green-dark">
                    Upload en cours...
                  </p>
                  <p className="text-xs text-pmn-green">
                    {successCount} / {totalFiles} fichiers uploadés
                  </p>
                </div>
                <span className="font-display text-2xl font-semibold text-pmn-green">
                  {overallProgress}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-pmn-green/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1F8A63] to-[#15654B] transition-all duration-300 ease-out"
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
              <SelectTrigger className="h-[46px] rounded-[11px] border-[rgba(20,33,28,.08)] bg-[#F6F5F0] text-sm">
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
            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="flex h-[46px] w-full items-center justify-between gap-2 rounded-[11px] border border-[rgba(20,33,28,.08)] bg-[#F6F5F0] px-3.5 text-left text-sm transition-colors hover:border-pmn-green/30"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FolderInput className="h-4 w-4 flex-none text-pmn-faint" />
                <span className={`truncate ${destinationFolder ? 'font-medium text-pmn-ink' : 'text-pmn-subtle'}`}>
                  {destinationFolder ? destinationPath : 'Racine (aucun dossier)'}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 flex-none text-pmn-faint" />
            </button>

            {/* Suggestions IA (Partie 2) — masquées si l'IA est indisponible */}
            {aiAvailable && aiSuggestions.length > 0 && (
              <div className="mt-2 rounded-[11px] border border-pmn-gold/30 bg-pmn-gold/[.06] p-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-pmn-gold-dark">
                  <Sparkles className="h-3.5 w-3.5" />
                  Destinations suggérées
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {aiSuggestions.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setDestinationFolder(s.id); setDestinationPath(s.path); }}
                      className="max-w-full truncate rounded-[8px] border border-pmn-green/25 bg-white px-2.5 py-1 text-[12px] font-medium text-pmn-green transition-colors hover:bg-pmn-green/[.06]"
                      title={s.path}
                    >
                      {s.path}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
            className="h-11 w-full gap-2 rounded-[11px] bg-gradient-to-br from-[#15654B] to-[#0E3B2E] px-6 font-semibold text-white shadow-cta transition-[filter] hover:brightness-110 sm:w-auto"
          >
            <Upload className="w-4 h-4" />
            {uploading
              ? 'Upload en cours...'
              : `Uploader ${pendingCount} document(s)`
            }
          </Button>
        </div>
      </div>

      {/* Sélecteur de destination intelligent */}
      <DestinationPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        category={category}
        createdBy={profile?.id}
        onSelect={(id, path) => {
          setDestinationFolder(id);
          setDestinationPath(path);
        }}
      />
    </div>
  );
}
