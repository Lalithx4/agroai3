import { Fraunces, Public_Sans, Noto_Sans_Devanagari, Noto_Sans_Telugu } from 'next/font/google';
import './tokens.css';
import './globals.css';
import './pages.css';
import './shell.css';
import AppShell from '@/components/layout/AppShell';
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';

// Field-notebook type: Fraunces for titles and numbers, Public Sans for UI, Noto for Hindi and Telugu script.
const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-fraunces', axes: ['opsz', 'SOFT'] });
const publicSans = Public_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-public-sans' });
const notoDeva = Noto_Sans_Devanagari({ subsets: ['devanagari'], weight: ['400', '600', '700'], display: 'swap', variable: '--font-noto-deva' });
const notoTelugu = Noto_Sans_Telugu({ subsets: ['telugu'], weight: ['400', '600', '700'], display: 'swap', variable: '--font-noto-telugu' });

export const metadata = {
  title: 'CropMagix - AI Farming Assistant',
  description: 'CropMagix - AI-powered agricultural assistant for plant health analysis and farming guidance',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'CropMagix',
    statusBarStyle: 'black-translucent',
  },
};

// Pinch-zoom stays enabled: many farmers need larger text, and blocking zoom fails WCAG 1.4.4.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F6F1E7',
};

// Applies the saved theme before first paint (light by default) so there is no flash.
const themeScript = `try{var t=localStorage.getItem('cropmagix-theme');if(t!=='dark'&&t!=='light'){t='light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable} ${notoDeva.variable} ${notoTelugu.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            <ServiceWorkerRegister />
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
