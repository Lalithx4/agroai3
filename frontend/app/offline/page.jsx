'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { WifiOff, RotateCw } from 'lucide-react';

// Shown by the service worker when a page isn't cached and there's no network.
const COPY = {
    en: { title: 'You are offline', body: 'Check your connection and try again. Pages you opened before still work.', retry: 'Try again' },
    hi: { title: 'आप ऑफ़लाइन हैं', body: 'अपना कनेक्शन जाँचें और फिर कोशिश करें। पहले खोले पेज अब भी चलेंगे।', retry: 'फिर कोशिश करें' },
    te: { title: 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు', body: 'కనెక్షన్ తనిఖీ చేసి మళ్ళీ ప్రయత్నించండి. ఇంతకుముందు తెరిచిన పేజీలు ఇప్పటికీ పనిచేస్తాయి.', retry: 'మళ్ళీ ప్రయత్నించండి' },
};

export default function OfflinePage() {
    const { language } = useLanguage();
    const c = COPY[language] || COPY.en;

    return (
        <div className="offline">
            <span className="offline-icon" aria-hidden="true"><WifiOff size={36} strokeWidth={1.75} /></span>
            <h1>{c.title}</h1>
            <p>{c.body}</p>
            <button type="button" className="nb-btn nb-btn-primary" onClick={() => window.location.reload()}>
                <RotateCw size={18} aria-hidden="true" /> {c.retry}
            </button>
            <style jsx>{`
                .offline {
                    min-height: 100vh;
                    min-height: 100dvh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 14px;
                    text-align: center;
                    padding: 24px;
                    background: var(--paper);
                }
                .offline-icon {
                    width: 72px;
                    height: 72px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 18px;
                    background: var(--paper-2, #ECE5D8);
                    color: var(--ink);
                }
                h1 {
                    font-family: var(--font-display);
                    font-size: 1.6rem;
                    color: var(--ink);
                    margin: 0;
                }
                p {
                    max-width: 34ch;
                    color: var(--ink-2, #5B564A);
                    line-height: 1.55;
                    margin: 0;
                }
            `}</style>
        </div>
    );
}
