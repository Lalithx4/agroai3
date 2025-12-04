'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import BackButton from '@/components/layout/BackButton';
import Link from 'next/link';
import { getScanHistory as getLocalHistory, clearAll } from '@/services/cache';
import { getScanHistory as getSupabaseHistory, deleteScan } from '@/lib/supabase';
import { Trash2, ClipboardList, Camera, CheckCircle, AlertTriangle, Sprout, Loader2, RefreshCw, Cloud, HardDrive } from 'lucide-react';

export default function HistoryPage() {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [source, setSource] = useState('cloud'); // 'cloud' or 'local'

    // Load history on mount
    useEffect(() => { 
        loadHistory();
    }, [source]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            if (source === 'cloud') {
                // Load from Supabase
                const cloudHistory = await getSupabaseHistory(20);
                if (cloudHistory && cloudHistory.length > 0) {
                    const formatted = cloudHistory.map(item => ({
                        id: item.id,
                        plant_name: item.plant_name || 'Unknown Plant',
                        health_status: item.health_status || 'unknown',
                        timestamp: item.created_at,
                        image: item.image_base64,
                        ...item.full_analysis
                    }));
                    setHistory(formatted);
                } else {
                    // Fallback to local
                    setHistory(getLocalHistory());
                }
            } else {
                // Load from local storage
                setHistory(getLocalHistory());
            }
        } catch (err) {
            console.log('Failed to load history:', err);
            setHistory(getLocalHistory());
        } finally {
            setIsLoading(false);
        }
    };

    const clearHistory = async () => { 
        if (confirm(t('confirmClear'))) { 
            clearAll(); 
            setHistory([]); 
            showToast(t('resetData'), 'success'); 
        } 
    };

    const deleteItem = async (id) => {
        if (source === 'cloud') {
            await deleteScan(id);
        }
        setHistory(prev => prev.filter(item => item.id !== id));
        showToast('Item deleted', 'success');
    };

    return (
        <section className="screen active">
            <div className="history-header">
                <BackButton />
                <h2>{t('scanHistory')}</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        className="source-btn" 
                        onClick={() => setSource(source === 'cloud' ? 'local' : 'cloud')}
                        title={source === 'cloud' ? 'Cloud Storage' : 'Local Storage'}
                        style={{ 
                            padding: '8px', 
                            borderRadius: '8px', 
                            background: source === 'cloud' ? 'var(--primary)' : 'var(--bg-elevated)',
                            color: source === 'cloud' ? 'white' : 'var(--text-primary)',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {source === 'cloud' ? <Cloud size={18} /> : <HardDrive size={18} />}
                    </button>
                    <button 
                        className="refresh-btn" 
                        onClick={loadHistory}
                        style={{ 
                            padding: '8px', 
                            borderRadius: '8px', 
                            background: 'var(--bg-elevated)',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
                    </button>
                    <button className="clear-btn" onClick={clearHistory}><Trash2 size={18} /></button>
                </div>
            </div>

            <div className="history-list">
                {isLoading ? (
                    <div className="empty-state">
                        <Loader2 size={48} className="spinning" />
                        <p>Loading history...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon"><ClipboardList size={64} strokeWidth={1} /></span>
                        <p>{t('noHistory')}</p>
                        <Link href="/scanner" className="start-btn"><Camera size={18} /> {t('scanPlant')}</Link>
                    </div>
                ) : history.slice(0, 20).map(item => (
                    <div key={item.id} className="history-item">
                        {item.image ? <img src={item.image} alt="" className="history-img" /> : <div style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sprout size={24} /></div>}
                        <div className="history-info">
                            <span className="history-plant">{item.plant_name || 'Unknown Plant'}</span>
                            <span className={`history-status ${item.health_status === 'healthy' ? 'healthy' : 'unhealthy'}`}>
                                {item.health_status === 'healthy' ? <><CheckCircle size={14} /> {t('healthy')}</> : <><AlertTriangle size={14} /> {t('issues')}</>}
                            </span>
                            <span className="history-date">{new Date(item.timestamp || item.created_at).toLocaleDateString()}</span>
                        </div>
                        <button 
                            onClick={() => deleteItem(item.id)}
                            style={{ 
                                padding: '8px', 
                                background: 'var(--bg-elevated)', 
                                border: 'none', 
                                borderRadius: '8px',
                                cursor: 'pointer',
                                marginLeft: 'auto'
                            }}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>

            <style jsx>{`
                .spinning {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </section>
    );
}
