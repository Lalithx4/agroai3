'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import BottomNav from './BottomNav';
import { NO_HEADER_ROUTES, NO_BOTTOM_NAV_ROUTES } from './nav-items';
import IncomingCall from '@/components/call/IncomingCall';

export default function AppShell({ children }) {
    const pathname = usePathname() || '/';
    const showHeader = !NO_HEADER_ROUTES.includes(pathname);
    const showBottomNav = !NO_BOTTOM_NAV_ROUTES.includes(pathname);

    return (
        <>
            <a href="#main" className="skip-link">Skip to content</a>
            {showHeader && <Header />}
            <main
                id="main"
                className={`app-main${showHeader ? '' : ' no-header'}${showBottomNav ? ' has-bottom-nav' : ''}`}
            >
                {children}
            </main>
            {showBottomNav && <BottomNav />}
            <IncomingCall />
        </>
    );
}
