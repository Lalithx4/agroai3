'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Leaf, Sun, Moon } from 'lucide-react';
import { NAV_ITEMS, isActive } from './nav-items';

const LANGS = [
    { id: 'en', label: 'EN', name: 'English' },
    { id: 'hi', label: 'हि', name: 'हिन्दी' },
    { id: 'te', label: 'తె', name: 'తెలుగు' },
];

export default function Header() {
    const pathname = usePathname();
    const { language, setLanguage, t } = useLanguage();
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="app-header">
            <Link href="/home" className="logo" aria-label="CropMagix home">
                <span className="logo-mark"><Leaf size={20} strokeWidth={2.5} /></span>
                <span className="logo-text">CropMagix <span className="logo-ai">AI</span></span>
            </Link>

            <nav className="header-nav" aria-label={t('mainNav')}>
                {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
                    const active = isActive(pathname, href);
                    return (
                        <Link key={href} href={href} className={`header-nav-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
                            <Icon size={16} strokeWidth={2} />
                            <span>{t(labelKey)}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="header-right">
                <div className="language-selector" role="group" aria-label="Language">
                    {LANGS.map((l) => (
                        <button
                            key={l.id}
                            type="button"
                            className={`lang-btn ${language === l.id ? 'active' : ''}`}
                            onClick={() => setLanguage(l.id)}
                            aria-pressed={language === l.id}
                            aria-label={l.name}
                            lang={l.id}
                        >
                            {l.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="theme-toggle"
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
        </header>
    );
}
