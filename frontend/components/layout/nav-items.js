import { Home, Camera, Mic, MessageCircle, Cloud, Mountain } from 'lucide-react';

// Primary destinations shared by the desktop header nav and the mobile bottom bar.
// `labelKey` / `shortKey` are translation keys in services/i18n.js.
export const NAV_ITEMS = [
    { href: '/home', labelKey: 'navHome', icon: Home },
    { href: '/voice-doctor', labelKey: 'navVoiceDoctor', shortKey: 'navVoice', icon: Mic },
    { href: '/scanner', labelKey: 'navScan', icon: Camera, primary: true },
    { href: '/soil', labelKey: 'navSoil', icon: Mountain, desktopOnly: true },
    { href: '/weather', labelKey: 'navWeather', icon: Cloud },
    { href: '/chat', labelKey: 'navChat', icon: MessageCircle },
];

// Routes that own the whole screen (splash, camera) and hide the app header.
export const NO_HEADER_ROUTES = ['/', '/scanner'];
// Routes without the mobile tab bar: onboarding, camera, and chat (which has its own input bar).
export const NO_BOTTOM_NAV_ROUTES = ['/', '/landing', '/scanner', '/chat'];

export const isActive = (pathname, href) => pathname === href || pathname.startsWith(href + '/');
