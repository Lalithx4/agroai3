'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf } from 'lucide-react';

// Splash: first visit goes to Landing, later visits straight to Home.
export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        const seen = localStorage.getItem('cropmagix_seen_landing');
        const timer = setTimeout(() => router.replace(seen ? '/home' : '/landing'), 300);
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="splash" role="status" aria-label="Loading CropMagix">
            <span className="splash-mark"><Leaf size={30} strokeWidth={2} aria-hidden="true" /></span>
            <span className="splash-word">CropMagix</span>
            <style jsx>{`
                .splash {
                    min-height: 100vh;
                    min-height: 100dvh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 14px;
                    background: var(--paper);
                }
                .splash-mark {
                    width: 60px;
                    height: 60px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 14px;
                    background: var(--leaf);
                    color: var(--on-leaf);
                }
                .splash-word {
                    font-family: var(--font-display);
                    font-size: 1.6rem;
                    font-weight: 600;
                    color: var(--ink);
                    letter-spacing: -0.02em;
                }
            `}</style>
        </div>
    );
}
