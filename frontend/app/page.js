'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, Loader2 } from 'lucide-react';

export default function RootPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check if user has seen landing page
        const hasSeenLanding = localStorage.getItem('cropmagix_seen_landing');
        
        // Small delay for smooth transition
        setTimeout(() => {
            if (hasSeenLanding) {
                router.replace('/home');
            } else {
                router.replace('/landing');
            }
        }, 500);
    }, [router]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a0f1a 0%, #1a1f2e 100%)',
            gap: '20px'
        }}>
            <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 20px 60px rgba(16, 185, 129, 0.3)'
            }}>
                <Leaf size={40} strokeWidth={1.5} />
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#94a3b8',
                fontSize: '0.9rem'
            }}>
                <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Loading CropmagiX AI...</span>
            </div>
            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
