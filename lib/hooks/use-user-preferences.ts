'use client';

import { useEffect, useState } from 'react';
import { DisplayMode } from '@/lib/types/documents';

export function useUserPreferences(userId: string | undefined) {
    const [displayMode, setDisplayMode] = useState<DisplayMode>('grid');

    useEffect(() => {
        if (!userId) return;

        // Load from localStorage
        const savedMode = localStorage.getItem(`display_mode_${userId}`);
        if (savedMode && ['grid', 'list', 'columns'].includes(savedMode)) {
            setDisplayMode(savedMode as DisplayMode);
        }
    }, [userId]);

    const updateDisplayMode = (mode: DisplayMode) => {
        setDisplayMode(mode);
        if (userId) {
            localStorage.setItem(`display_mode_${userId}`, mode);
        }
    };

    return {
        displayMode,
        setDisplayMode: updateDisplayMode,
    };
}
