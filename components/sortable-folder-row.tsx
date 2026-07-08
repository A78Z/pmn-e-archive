'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FolderGlyph } from '@/components/pmn-icons';
import { ReactNode } from 'react';

interface SortableFolderRowProps {
    folder: any;
    isExpanded: boolean;
    isOverThis: boolean;
    canMove: boolean;
    onToggle: () => void;
    children: ReactNode;
    style?: React.CSSProperties;
    /** Nombre de sous-dossiers (calcul local, toujours connu) */
    subCount?: number;
    /** Nombre de documents (count() en cache ; undefined = pas encore connu) */
    docCount?: number;
}

export function SortableFolderRow({
    folder,
    isExpanded,
    isOverThis,
    canMove,
    onToggle,
    children,
    style: propStyle,
    subCount,
    docCount,
}: SortableFolderRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: folder.id, disabled: !canMove });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        ...propStyle,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <div
                className={`flex items-center gap-3 px-[18px] py-[9px] transition-colors duration-150 hover:bg-pmn-hover ${
                    isOverThis ? 'bg-[rgba(228,180,41,.12)] border-l-4 border-pmn-gold' : ''
                }`}
            >
                {canMove && (
                    <div
                        className="cursor-grab active:cursor-grabbing p-1 rounded flex-none text-[#B7BEB9] hover:text-pmn-subtle"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4" />
                    </div>
                )}
                <button
                    onClick={onToggle}
                    className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-pmn-subtle transition-colors hover:bg-[rgba(20,33,28,.06)]"
                >
                    <span
                        className="inline-flex transition-transform duration-200"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    >
                        <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                </button>

                <div
                    className={`flex items-center gap-3 flex-1 min-w-0 ${
                        folder._isCreating ? 'opacity-60' : ''
                    }`}
                >
                    <FolderGlyph size={36} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-[9px]">
                            {folder.folder_number && (
                                <span className="flex-none rounded-[5px] border border-[rgba(20,33,28,.06)] bg-[#F1F0EB] px-1.5 py-0.5 font-mono text-[11px] text-pmn-faint2">
                                    {folder.folder_number}
                                </span>
                            )}
                            <h3 className="truncate text-[14.5px] font-semibold text-pmn-ink">
                                {folder.name}
                            </h3>
                            {folder._isCreating && (
                                <Badge variant="outline" className="bg-pmn-green/5 text-pmn-green border-pmn-green/20">
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Création...
                                </Badge>
                            )}
                        </div>
                        <p className="mt-0.5 text-xs text-pmn-faint">
                            {folder.createdAt && new Date(folder.createdAt).toLocaleDateString('fr-FR')}
                            {subCount !== undefined && (
                                <span> · {subCount} sous-dossier{subCount > 1 ? 's' : ''}</span>
                            )}
                            {docCount !== undefined && (
                                <span> · {docCount} document{docCount > 1 ? 's' : ''}</span>
                            )}
                        </p>
                    </div>
                    {folder.status && !folder._isCreating && (
                        <span className="pill-archive flex-none rounded-[20px] px-[11px] py-[3px] text-[11.5px] font-semibold">
                            {folder.status === 'Archive' ? 'Archivé' : folder.status}
                        </span>
                    )}
                </div>

                {children}
            </div>
        </div>
    );
}
