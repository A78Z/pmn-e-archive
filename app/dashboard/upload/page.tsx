'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Folder, X } from 'lucide-react';
import { useAuth } from '@/lib/parse-auth';
import { FolderHelpers, DocumentHelpers, FileHelpers } from '@/lib/parse-helpers';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface FolderOption {
  id: string;
  name: string;
}

export default function UploadPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [destinationFolder, setDestinationFolder] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchFolders();
    }
  }, [profile]);

  const fetchFolders = async () => {
    try {
      const data = await FolderHelpers.getAll();
      setFolders(data.map((f: any) => ({ id: f.id, name: f.name })));
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Veuillez sélectionner au moins un fichier');
      return;
    }

    if (!category) {
      toast.error('Veuillez sélectionner une catégorie');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = selectedFiles.length;
      let uploadedCount = 0;

      for (const file of selectedFiles) {
        setCurrentFile(file.name);

        const fileSizeInMB = file.size / (1024 * 1024);
        if (fileSizeInMB > 50) {
          toast.error(`Le fichier ${file.name} dépasse 50MB`);
          uploadedCount++;
          setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
          continue;
        }

        // Upload file to Parse
        const parseFile = await FileHelpers.uploadFile(file);
        const fileUrl = FileHelpers.getFileUrl(parseFile);

        // Create document record
        await DocumentHelpers.create({
          name: file.name,
          description: description || null,
          file_path: fileUrl, // Store URL or Parse File object depending on schema
          file_size: file.size,
          file_type: file.type,
          folder_id: destinationFolder || null,
          category: category,
          uploaded_by: profile?.id,
          tags: tags ? tags.split(',').map(t => t.trim()) : [],
        });

        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      }

      toast.success(
        `✅ Téléchargement terminé avec succès`,
        {
          description: `${selectedFiles.length} fichier(s) ont été ajoutés.`,
          duration: 5000
        }
      );

      setSelectedFiles([]);
      setCategory(undefined);
      setDestinationFolder(undefined);
      setDescription('');
      setTags('');

      setTimeout(() => {
        setUploadProgress(0);
        setCurrentFile('');
        router.push('/dashboard/documents');
      }, 2000);
    } catch (error: any) {
      console.error('Erreur upload:', error);
      toast.error(
        `⚠️ Erreur : le téléchargement n'a pas pu être terminé`,
        {
          description: error.message || 'Erreur inconnue',
          duration: 6000
        }
      );
    } finally {
      setTimeout(() => {
        setUploading(false);
      }, 2000);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/documents');
  };

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
                >
                  <FileText className="w-4 h-4" />
                  Sélectionner des fichiers
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFolderSelect}
                  className="gap-2"
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

          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">
                {selectedFiles.length} fichier(s) sélectionné(s)
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white border rounded-md px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-6 w-6 p-0 flex-shrink-0"
                      disabled={uploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploading && (
            <div className="mt-6 space-y-3 bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-900">
                    Téléchargement en cours...
                  </p>
                  {currentFile && (
                    <p className="text-xs text-blue-700 truncate max-w-md">
                      {currentFile}
                    </p>
                  )}
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${uploadProgress}%` }}
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
                    {folder.name}
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
            disabled={uploading || selectedFiles.length === 0 || !category}
            className="h-11 px-6 bg-green-600 hover:bg-green-700 gap-2 w-full sm:w-auto"
          >
            <Upload className="w-4 h-4" />
            {uploading
              ? 'Upload en cours...'
              : `Uploader ${selectedFiles.length} document(s)`
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
