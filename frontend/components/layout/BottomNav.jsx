'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { NAV_ITEMS, isActive } from './nav-items';

// Thumb-reachable tab bar for phones and tablets; hidden on desktop by CSS.
export default function BottomNav() {
    const pathname = usePathname();
    const { t } = useLanguage();

    return (
        <nav className="bottom-nav" aria-label={t('mainNav')}>
            {NAV_ITEMS.filter((i) => !i.desktopOnly).map(({ href, labelKey, shortKey, icon: Icon, primary }) => {
                const active = isActive(pathname, href);
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`bottom-nav-item${primary ? ' primary' : ''}${active ? ' active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                    >
                        <span className="bottom-nav-icon"><Icon size={primary ? 24 : 22} strokeWidth={active || primary ? 2.25 : 1.75} /></span>
                        <span className="bottom-nav-label">{t(shortKey || labelKey)}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
