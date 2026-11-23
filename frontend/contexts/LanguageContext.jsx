'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, t as translate } from '@/services/i18n';
import { useIsClient } from '@/contexts/ThemeContext';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'cropmagix-lang';

function readInitialLanguage() {
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && translations[saved] ? saved : 'en';
}

export function LanguageProvider({ children }) {
    const isClient = useIsClient();
    const [language, setLanguageState] = useState(readInitialLanguage);

    // Screen readers and fonts pick the right script from <html lang>.
    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const setLanguage = useCallback((lang) => {
        if (translations[lang]) {
            setLanguageState(lang);
            localStorage.setItem(STORAGE_KEY, lang);
        }
    }, []);

    const t = useCallback((key) => translate(key, language), [language]);

    if (!isClient) return null;

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
