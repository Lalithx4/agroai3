'use client';

import { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'cropmagix-theme';

const noopSubscribe = () => () => {};
// false during SSR and hydration, true afterwards, without setState-in-effect.
export const useIsClient = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

function readInitialTheme() {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem(STORAGE_KEY);
    // Light ("paper") is the default on first open; dark is opt-in and remembered.
    return saved === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
    const isClient = useIsClient();
    const [theme, setThemeState] = useState(readInitialTheme);

    // Keep the <html data-theme> attribute (read by the CSS) in sync.
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#161A15' : '#F6F1E7');
    }, [theme]);

    const setTheme = useCallback((newTheme) => {
        if (newTheme === 'dark' || newTheme === 'light') {
            setThemeState(newTheme);
            localStorage.setItem(STORAGE_KEY, newTheme);
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setTheme]);

    // Pages read localStorage/window while rendering, so they render on the client only.
    if (!isClient) return null;

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
