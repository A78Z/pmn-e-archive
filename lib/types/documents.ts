export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  category: string;
  folder_number: string | null;
  status: string;
  created_at: string;
  created_by: string;
  description?: string | null;
  isOpen?: boolean;
  children?: Folder[];
  documents?: Document[];
}

export interface Document {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  file_size: number;
  file_type: string;
  folder_id: string | null;
  category: string;
  created_at: string;
  uploaded_by: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  display_mode: 'very_large' | 'large' | 'medium';
  created_at: string;
  updated_at: string;
}

export type DisplayMode = 'very_large' | 'large' | 'medium';

export const DISPLAY_MODES = {
  very_large: { size: 80, label: 'Très grandes icônes', icon: '🔲' },
  large: { size: 60, label: 'Grandes icônes', icon: '🟦' },
  medium: { size: 40, label: 'Icônes moyennes', icon: '🟩' }
} as const;

export const STATUS_COLORS = {
  Archive: { bg: 'bg-destructive/15', text: 'text-destructive', dot: '🔴' },
  'En cours': { bg: 'bg-secondary/25', text: 'text-secondary-foreground', dot: '🟡' },
  Nouveau: { bg: 'bg-primary/15', text: 'text-primary', dot: '🟢' }
} as const;

export const categoryColors: Record<string, string> = {
  Administrative: 'badge-chart-2',
  Technique: 'badge-chart-4',
  Financière: 'badge-chart-1',
  Légale: 'badge-chart-5',
  Projet: 'badge-chart-3',
  Formation: 'badge-chart-2',
  Communication: 'badge-chart-4',
  Archive: 'badge-chart-5',
};
