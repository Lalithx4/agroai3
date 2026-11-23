'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Lightbulb, BookOpen, Droplets, Sun, FileText } from 'lucide-react';
import './ar-overlay.css';

/**
 * Live AR overlay for the scanner (EXPERIENCE.md · Scan).
 * One frame every ~1.5 s goes to /api/ar-scan; the reticle glides to where the plant is
 * and a notebook card rises with what the plant is, how it is doing and one thing to do.
 */

const SCAN_GAP_MS = 1400;
const REQUEST_TIMEOUT_MS = 9000;
const MISSES_BEFORE_CLEAR = 2;
const FRAME_EDGE_PX = 640;

const COPY = {
    en: {
        searching: 'Looking for a plant', reading: 'Reading the leaf', live: 'Live', sure: (n) => `${n}% sure`,
        health: 'Health', tip: 'Do today', fact: 'Good to know', report: 'Full report',
        water: { low: 'Little water', medium: 'Moderate water', high: 'Lots of water' },
        sun: { 'full sun': 'Full sun', 'part shade': 'Part shade', shade: 'Shade' },
        status: { healthy: 'Healthy', mild: 'Mostly fine', needs_attention: 'Needs attention', serious: 'Serious' },
    },
    hi: {
        searching: 'पौधा ढूँढ रहा हूँ', reading: 'पत्ता पढ़ रहा हूँ', live: 'लाइव', sure: (n) => `${n}% पक्का`,
        health: 'सेहत', tip: 'आज करें', fact: 'काम की बात', report: 'पूरी रिपोर्ट',
        water: { low: 'कम पानी', medium: 'मध्यम पानी', high: 'ज़्यादा पानी' },
        sun: { 'full sun': 'पूरी धूप', 'part shade': 'आधी छाया', shade: 'छाया' },
        status: { healthy: 'स्वस्थ', mild: 'ज़्यादातर ठीक', needs_attention: 'ध्यान चाहिए', serious: 'गंभीर' },
    },
    te: {
        searching: 'మొక్క కోసం చూస్తున్నాను', reading: 'ఆకును చదువుతున్నాను', live: 'లైవ్', sure: (n) => `${n}% ఖచ్చితం`,
        health: 'ఆరోగ్యం', tip: 'ఈ రోజు చేయండి', fact: 'తెలుసుకోండి', report: 'పూర్తి రిపోర్ట్',
        water: { low: 'తక్కువ నీరు', medium: 'మధ్యస్థ నీరు', high: 'ఎక్కువ నీరు' },
        sun: { 'full sun': 'పూర్తి ఎండ', 'part shade': 'పాక్షిక నీడ', shade: 'నీడ' },
        status: { healthy: 'ఆరోగ్యంగా ఉంది', mild: 'దాదాపు బాగుంది', needs_attention: 'జాగ్రత్త అవసరం', serious: 'తీవ్రం' },
    },
};

const TONE = { healthy: 'ok', mild: 'mild', needs_attention: 'warn', serious: 'bad' };

/** Map a box measured on the video frame to screen pixels, accounting for object-fit: cover. */
function frameBoxToScreen(video, box, opts) {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const vw = video?.videoWidth || cw;
    const vh = video?.videoHeight || ch;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const ox = (cw - dw) / 2;
    const oy = (ch - dh) / 2;

    let rect;
    if (box) {
        rect = { left: ox + box.x * dw, top: oy + box.y * dh, width: box.w * dw, height: box.h * dh };
    } else {
        const side = Math.min(cw, ch) * (cw < 900 ? 0.68 : 0.46);
        rect = { left: (cw - side) / 2, top: (ch - side) / 2 - ch * 0.06, width: side, height: side };
    }

    // Keep the reticle on screen, clear of the header + name tag above and the info card / dock below.
    const margin = 14;
    const minTop = 150;
    const maxRight = opts.cardSide ? cw - 400 : cw - margin;
    const maxBottom = opts.cardBelow ? ch - 118 - ch * 0.4 - 16 : ch - 130;
    const minSide = 120;
    rect.width = Math.max(minSide, Math.min(rect.width, maxRight - margin));
    rect.height = Math.max(minSide, Math.min(rect.height, maxBottom - minTop));
    rect.left = Math.min(Math.max(margin, rect.left), maxRight - rect.width);
    rect.top = Math.min(Math.max(minTop, rect.top), maxBottom - rect.height);
    return rect;
}

export default function ArOverlay({ videoRef, language = 'en', onFullReport }) {
    const c = COPY[language] || COPY.en;
    const [data, setData] = useState(null);
    const [hint, setHint] = useState('');
    const [reading, setReading] = useState(false);
    const [rect, setRect] = useState(() => frameBoxToScreen(videoRef.current, null, {}));
    const [lockCount, setLockCount] = useState(0);

    const missesRef = useRef(0);
    const lockedRef = useRef(false);
    const boxRef = useRef(null);

    const place = useCallback((box, locked) => {
        boxRef.current = box;
        const wide = window.innerWidth >= 900;
        setRect(frameBoxToScreen(videoRef.current, box, { cardBelow: locked && !wide, cardSide: locked && wide }));
    }, [videoRef]);

    // Keep the reticle right on rotate/resize.
    useEffect(() => {
        const onResize = () => place(boxRef.current, lockedRef.current);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [place]);

    // The scan loop: one request at a time, paused while the tab is hidden.
    useEffect(() => {
        let alive = true;
        let timer = null;
        let controller = null;
        const canvas = document.createElement('canvas');

        const schedule = (ms) => { if (alive) timer = setTimeout(tick, ms); };

        const miss = (h) => {
            missesRef.current += 1;
            if (missesRef.current >= MISSES_BEFORE_CLEAR) {
                lockedRef.current = false;
                setData(null);
                place(null, false);
            }
            if (h) setHint(h);
        };

        async function tick() {
            if (!alive) return;
            const video = videoRef.current;
            if (document.hidden || !video || !video.videoWidth) { schedule(700); return; }

            const k = Math.min(1, FRAME_EDGE_PX / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * k);
            canvas.height = Math.round(video.videoHeight * k);
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72));
            if (!alive || !blob) { schedule(SCAN_GAP_MS); return; }

            setReading(true);
            controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            try {
                const form = new FormData();
                form.append('image', blob, 'frame.jpg');
                form.append('language', language);
                const res = await fetch('/api/ar-scan', { method: 'POST', body: form, signal: controller.signal });
                const json = await res.json();
                if (!alive) return;
                if (json.identified && json.plant_name) {
                    missesRef.current = 0;
                    if (!lockedRef.current) {
                        lockedRef.current = true;
                        setLockCount((n) => n + 1);
                        navigator.vibrate?.(12);
                    }
                    setData(json);
                    setHint('');
                    place(json.box, true);
                } else {
                    miss(json.hint);
                }
            } catch {
                if (alive) miss('');
            } finally {
                clearTimeout(timeout);
                if (alive) setReading(false);
                schedule(SCAN_GAP_MS);
            }
        }

        tick();
        return () => {
            alive = false;
            clearTimeout(timer);
            controller?.abort();
        };
    }, [language, place, videoRef]);

    const locked = !!data;
    const tone = data ? TONE[data.health_status] || 'mild' : 'none';
    const score = data ? data.health_score : 0;
    const plantKey = data ? `${data.plant_name}-${lockCount}` : 'none';
    const statusText = locked ? data.plant_name : reading ? c.reading : (hint || c.searching);

    return (
        <div className={`arx ${locked ? 'is-locked' : 'is-searching'} ${reading ? 'is-reading' : ''} tone-${tone}`}>
            {rect && (
                <div className="arx-reticle" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} aria-hidden="true">
                    <i className="arx-c tl" /><i className="arx-c tr" /><i className="arx-c bl" /><i className="arx-c br" />
                    {reading && <span className="arx-sweep" />}
                    {locked && <span key={`ping-${lockCount}`} className="arx-ping" />}
                    {locked && (
                        <span key={plantKey} className="arx-tag">
                            <span className="arx-tag-dot" />
                            {data.plant_name}
                            <b className="nb-numeral">{score}</b>
                        </span>
                    )}
                </div>
            )}

            <div className="arx-status" role="status" aria-live="polite">
                <span className="arx-status-dot" />
                {statusText}
            </div>

            {locked && (
                <section key={plantKey} className="arx-card" aria-label={data.plant_name}>
                    <p className="arx-over" style={{ '--i': 0 }}>
                        <span className="arx-live">{c.live}</span>
                        {data.confidence ? c.sure(Math.round(data.confidence * 100)) : null}
                    </p>
                    <h2 className="arx-name" style={{ '--i': 1 }}>{data.plant_name}</h2>
                    {data.scientific_name && <p className="arx-sci" style={{ '--i': 1 }}>{data.scientific_name}</p>}

                    <div className="arx-meter" style={{ '--i': 2 }}>
                        <span className="arx-meter-label">{c.health} · {c.status[data.health_status] || ''}</span>
                        <span className="arx-meter-bar"><span style={{ width: `${score}%` }} /></span>
                        <span className="arx-meter-num nb-numeral">{score}</span>
                    </div>

                    {data.headline && <p className="arx-headline" style={{ '--i': 3 }}>{data.headline}</p>}

                    <ul className="arx-rows">
                        {data.issue && (
                            <li style={{ '--i': 4 }} className="arx-row warn"><AlertTriangle size={16} aria-hidden="true" /><span>{data.issue}</span></li>
                        )}
                        {data.tip && (
                            <li style={{ '--i': 5 }} className="arx-row"><Lightbulb size={16} aria-hidden="true" /><span><b>{c.tip}.</b> {data.tip}</span></li>
                        )}
                        {data.fact && (
                            <li style={{ '--i': 6 }} className="arx-row"><BookOpen size={16} aria-hidden="true" /><span><b>{c.fact}.</b> {data.fact}</span></li>
                        )}
                    </ul>

                    <div className="arx-foot" style={{ '--i': 7 }}>
                        <span className="arx-chips">
                            {data.water && <span className="arx-chip"><Droplets size={14} aria-hidden="true" />{c.water[data.water] || data.water}</span>}
                            {data.sun && <span className="arx-chip"><Sun size={14} aria-hidden="true" />{c.sun[data.sun] || data.sun}</span>}
                        </span>
                        <button type="button" className="arx-report" onClick={onFullReport}>
                            <FileText size={16} aria-hidden="true" /> {c.report}
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}
