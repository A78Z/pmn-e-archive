import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Folder as FolderIcon, GripVertical } from 'lucide-react';

interface SortableFolderItemProps {
    folder: any;
    children: React.ReactNode;
    isDragging?: boolean;
    isOver?: boolean;
    canMove: boolean;
}

export function SortableFolderItem({ folder, children, isDragging, isOver, canMove }: SortableFolderItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging,
    } = useSortable({ id: folder.id, disabled: !canMove });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isSortableDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
        ${isOver ? 'bg-blue-50 border-blue-300' : ''}
        ${isSortableDragging ? 'z-50' : ''}
      `}
        >
            <div className="flex items-center gap-2">
                {canMove && (
                    <button
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded"
                        aria-label="Déplacer le dossier"
                    >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                    </button>
                )}
                {children}
            </div>
        </div>
    );
}
