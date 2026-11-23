'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getStats, clearAll } from '@/services/cache';
import {
  Camera, Mic, Mountain, Cloud, MessageCircle, CalendarDays, Pill, Bug,
  History, ChevronRight, ArrowRight, WifiOff,
} from 'lucide-react';
import './home.css';

const TOOLS = [
  { href: '/soil', icon: Mountain, title: 'soilTest', desc: 'soilTestDesc' },
  { href: '/weather', icon: Cloud, title: 'weather', desc: 'weatherDesc' },
  { href: '/chat', icon: MessageCircle, title: 'talkToPlant', desc: 'chatDesc' },
  { href: '/calendar', icon: CalendarDays, title: 'cropCalendar', desc: 'calendarDesc' },
  { href: '/medicine', icon: Pill, title: 'medicine', desc: 'medicineDesc' },
  { href: '/pest', icon: Bug, title: 'pestTracker', desc: 'pestDesc' },
  { href: '/history', icon: History, title: 'history', desc: 'historyDesc' },
];

const LOCALE = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };

const subscribeOnline = (cb) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

export default function HomePage() {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState(() => getStats());
  const isOnline = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [now] = useState(() => new Date());

  // Stats can change in another tab (e.g. a scan finished); refresh when the page regains focus.
  useEffect(() => {
    const refresh = () => setStats(getStats());
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const hour = now.getHours();
  const greeting = t(hour < 12 ? 'greetMorning' : hour < 17 ? 'greetAfternoon' : 'greetEvening');
  const dateLabel = now.toLocaleDateString(LOCALE[language] || 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const resetData = () => {
    if (confirm(t('confirmReset'))) {
      clearAll();
      setStats(getStats());
    }
  };

  return (
    <div className="home">
      {!isOnline && (
        <div className="home-offline" role="status">
          <WifiOff size={16} aria-hidden="true" />
          <span>{t('offlineMode')}</span>
        </div>
      )}

      <header className="home-intro">
        <p className="nb-overline">{dateLabel}</p>
        <h1 className="home-title">
          {greeting}.<br />
          <span>{t('homeQuestion')}</span>
        </h1>
      </header>

      <section className="home-actions" aria-label={t('checkSickPlant')}>
        <Link href="/scanner" className="home-primary">
          <div className="home-primary-photo">
            <img src="/images/leaves/tomato-early-blight.jpg" alt="" width={256} height={256} />
            <span className="home-photo-tag">Tomato · early blight</span>
          </div>
          <div className="home-primary-body">
            <span className="home-primary-icon" aria-hidden="true"><Camera size={22} /></span>
            <h2>{t('checkSickPlant')}</h2>
            <p>{t('checkSickPlantDesc')}</p>
            <span className="nb-btn nb-btn-primary home-primary-cta">
              {t('openCamera')} <ArrowRight size={18} aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link href="/voice-doctor" className="home-secondary">
          <span className="home-secondary-icon" aria-hidden="true"><Mic size={22} /></span>
          <div>
            <h2>{t('askAloud')}</h2>
            <p>{t('askAloudDesc')}</p>
          </div>
          <ChevronRight className="home-chevron" size={20} aria-hidden="true" />
        </Link>
      </section>

      <section className="home-stats" aria-label={t('yourScans')}>
        <div className="home-section-head">
          <h2 className="nb-overline">{t('yourScans')}</h2>
          {stats.total > 0 && <Link href="/history" className="home-link">{t('seeHistory')}</Link>}
        </div>
        {stats.total > 0 ? (
          <dl className="home-stat-row">
            <div><dt>{t('totalScans')}</dt><dd className="nb-numeral">{stats.total}</dd></div>
            <div><dt>{t('healthyPlants')}</dt><dd className="nb-numeral is-healthy">{stats.healthy}</dd></div>
            <div><dt>{t('issuesFound')}</dt><dd className="nb-numeral is-issue">{stats.issues}</dd></div>
          </dl>
        ) : (
          <p className="home-empty">{t('noScansYet')}</p>
        )}
      </section>

      <section className="home-tools" aria-labelledby="home-tools-title">
        <h2 id="home-tools-title" className="nb-overline">{t('toolsHeading')}</h2>
        <ul className="home-tool-list">
          {TOOLS.map(({ href, icon: Icon, title, desc }) => (
            <li key={href}>
              <Link href={href} className="home-tool">
                <span className="home-tool-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.75} /></span>
                <span className="home-tool-text">
                  <span className="home-tool-title">{t(title)}</span>
                  <span className="home-tool-desc">{t(desc)}</span>
                </span>
                <ChevronRight className="home-chevron" size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="home-foot">
        <span>{t('photoCredit')}</span>
        {stats.total > 0 && (
          <button type="button" className="home-reset" onClick={resetData}>{t('resetData')}</button>
        )}
      </footer>
    </div>
  );
}
