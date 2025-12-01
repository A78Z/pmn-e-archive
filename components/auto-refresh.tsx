'use client';

import { useEffect } from 'react';

export function AutoRefresh() {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && process.env.NODE_ENV === 'development') {
        const lastUpdate = sessionStorage.getItem('lastUpdate');
        const now = Date.now();

        if (!lastUpdate || now - parseInt(lastUpdate) > 30000) {
          sessionStorage.setItem('lastUpdate', now.toString());
          window.location.reload();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
