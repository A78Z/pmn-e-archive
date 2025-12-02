'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Folder,
    GripVertical,
    ChevronDown,
    ChevronRight,
    Loader2,
    MoreVertical,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReactNode } from 'react';

interface SortableFolderRowProps {
    folder: any;
    isExpanded: boolean;
    isOverThis: boolean;
    canMove: boolean;
    onToggle: () => void;
    children: ReactNode;
}

export function SortableFolderRow({
    folder,
    isExpanded,
    isOverThis,
    canMove,
    onToggle,
    children,
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
    };

    return (
        <div ref={setNodeRef} style={style}>
            <div
                className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors ${isOverThis ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
            >
                {canMove && (
                    <div
                        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                    </div>
                )}
                <button
                    onClick={onToggle}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                    {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-600" />
                    ) : (
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                    )}
                </button>

                <div
                    className={`flex items-center gap-3 flex-1 min-w-0 ${folder._isCreating ? 'opacity-60' : ''
                        }`}
                >
                    <Folder
                        className={`h-5 w-5 ${folder._isCreating ? 'text-gray-400' : 'text-blue-600'
                            } flex-shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            {folder.folder_number && (
                                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                    {folder.folder_number}
                                </span>
                            )}
                            <h3 className="font-semibold text-gray-900 truncate">
                                {folder.name}
                            </h3>
                            {folder._isCreating && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Création...
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-gray-500">
                            {folder.createdAt && new Date(folder.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                    </div>
                    {folder.status && !folder._isCreating && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            {folder.status}
                        </Badge>
                    )}
                </div>

                {children}
            </div>
        </div>
    );
}
