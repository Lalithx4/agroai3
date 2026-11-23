'use client';

import { useEffect } from 'react';

// Registers the service worker so CropMagix installs and works offline.
// Only in production: dev-server output changes constantly and caching it breaks hot reload.
export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') return;
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        const register = () => {
            navigator.serviceWorker
                .register('/sw.js', { scope: '/' })
                .catch((err) => console.warn('Service worker registration failed:', err));
        };

        if (document.readyState === 'complete') register();
        else window.addEventListener('load', register, { once: true });
    }, []);

    return null;
}
