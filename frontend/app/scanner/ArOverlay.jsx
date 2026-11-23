'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Lightbulb, BookOpen, Droplets, Sun, FileText, Mic, Square, Loader2, PhoneOff, Volume2 } from 'lucide-react';
import { PlantVoice } from './plant-voice';
import './ar-overlay.css';

/**
 * Live AR overlay for the scanner (EXPERIENCE.md · Scan).
 * Scans a frame every ~1.5 s, locks a reticle onto the plant, draws an animated map over it,
 * gives the plant a face, and lets the farmer talk with it out loud, turn by turn.
 */

const SCAN_GAP_MS = 1400;
const REQUEST_TIMEOUT_MS = 9000;
const MISSES_BEFORE_CLEAR = 2;
const FRAME_EDGE_PX = 640;
const GRID = 9;

const COPY = {
    en: {
        searching: 'Looking for a plant', reading: 'Reading the leaf', live: 'Live', sure: (n) => `${n}% sure`,
        health: 'Health', tip: 'Do today', fact: 'Good to know', report: 'Full report',
        talk: 'Talk to me', hearMe: 'Tap to hear me', end: 'End', you: 'You', listening: 'Listening… just talk', thinking: 'Thinking…', speaking: 'Speaking…',
        noMic: 'The microphone is not available here.', notHeard: 'I did not catch that. Tap to try again.',
        water: { low: 'Little water', medium: 'Moderate water', high: 'Lots of water' },
        sun: { 'full sun': 'Full sun', 'part shade': 'Part shade', shade: 'Shade' },
        status: { healthy: 'Healthy', mild: 'Mostly fine', needs_attention: 'Needs attention', serious: 'Serious' },
    },
    hi: {
        searching: 'पौधा ढूँढ रहा हूँ', reading: 'पत्ता पढ़ रहा हूँ', live: 'लाइव', sure: (n) => `${n}% पक्का`,
        health: 'सेहत', tip: 'आज करें', fact: 'काम की बात', report: 'पूरी रिपोर्ट',
        talk: 'मुझसे बात करो', hearMe: 'सुनने के लिए टैप करें', end: 'बंद करो', you: 'आप', listening: 'सुन रहा हूँ… बोलिए', thinking: 'सोच रहा हूँ…', speaking: 'बोल रहा हूँ…',
        noMic: 'यहाँ माइक्रोफ़ोन नहीं चल रहा।', notHeard: 'सुनाई नहीं दिया। फिर से टैप करें।',
        water: { low: 'कम पानी', medium: 'मध्यम पानी', high: 'ज़्यादा पानी' },
        sun: { 'full sun': 'पूरी धूप', 'part shade': 'आधी छाया', shade: 'छाया' },
        status: { healthy: 'स्वस्थ', mild: 'ज़्यादातर ठीक', needs_attention: 'ध्यान चाहिए', serious: 'गंभीर' },
    },
    te: {
        searching: 'మొక్క కోసం చూస్తున్నాను', reading: 'ఆకును చదువుతున్నాను', live: 'లైవ్', sure: (n) => `${n}% ఖచ్చితం`,
        health: 'ఆరోగ్యం', tip: 'ఈ రోజు చేయండి', fact: 'తెలుసుకోండి', report: 'పూర్తి రిపోర్ట్',
        talk: 'నాతో మాట్లాడండి', hearMe: 'వినడానికి తాకండి', end: 'ఆపండి', you: 'మీరు', listening: 'వింటున్నాను… మాట్లాడండి', thinking: 'ఆలోచిస్తున్నాను…', speaking: 'మాట్లాడుతున్నాను…',
        noMic: 'ఇక్కడ మైక్ అందుబాటులో లేదు.', notHeard: 'సరిగ్గా వినపడలేదు. మళ్ళీ తాకండి.',
        water: { low: 'తక్కువ నీరు', medium: 'మధ్యస్థ నీరు', high: 'ఎక్కువ నీరు' },
        sun: { 'full sun': 'పూర్తి ఎండ', 'part shade': 'పాక్షిక నీడ', shade: 'నీడ' },
        status: { healthy: 'ఆరోగ్యంగా ఉంది', mild: 'దాదాపు బాగుంది', needs_attention: 'జాగ్రత్త అవసరం', serious: 'తీవ్రం' },
    },
};

const TONE = { healthy: 'ok', mild: 'mild', needs_attention: 'warn', serious: 'bad' };
const LEVEL = { healthy: 0, mild: 1, needs_attention: 2, serious: 3 };

/** How the video frame is laid out on screen (object-fit: cover). */
function frameLayout(video) {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const vw = video?.videoWidth || cw;
    const vh = video?.videoHeight || ch;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    return { cw, ch, dw, dh, ox: (cw - dw) / 2, oy: (ch - dh) / 2 };
}

/** Map a box measured on the video frame to screen pixels, kept clear of the header, card and dock. */
function frameBoxToScreen(video, box, opts) {
    const { cw, ch, dw, dh, ox, oy } = frameLayout(video);
    let rect;
    if (box) {
        rect = { left: ox + box.x * dw, top: oy + box.y * dh, width: box.w * dw, height: box.h * dh };
    } else {
        const side = Math.min(cw, ch) * (cw < 900 ? 0.68 : 0.46);
        rect = { left: (cw - side) / 2, top: (ch - side) / 2 - ch * 0.06, width: side, height: side };
    }
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

/** Problem spots (frame fractions) -> positions inside the reticle, in %. Off-reticle spots are dropped. */
function spotsInReticle(video, spots, rect) {
    if (!rect || !Array.isArray(spots)) return [];
    const { dw, dh, ox, oy } = frameLayout(video);
    return spots
        .map((p) => ({ x: ((ox + p.x * dw - rect.left) / rect.width) * 100, y: ((oy + p.y * dh - rect.top) / rect.height) * 100 }))
        .filter((p) => p.x > 4 && p.x < 96 && p.y > 4 && p.y < 96);
}

// Dot grid for the scan map; each dot's delay grows with distance from the centre, so it ripples outward.
const DOTS = Array.from({ length: GRID * GRID }, (_, i) => {
    const gx = i % GRID;
    const gy = Math.floor(i / GRID);
    const cx = (gx + 0.5) / GRID;
    const cy = (gy + 0.5) / GRID;
    return { x: cx * 100, y: cy * 100, d: Math.hypot(cx - 0.5, cy - 0.5) };
});

export default function ArOverlay({ videoRef, language = 'en', onFullReport, call = null }) {
    const c = COPY[language] || COPY.en;
    const [data, setData] = useState(null);
    const [hint, setHint] = useState('');
    const [reading, setReading] = useState(false);
    const [rect, setRect] = useState(() => frameBoxToScreen(videoRef.current, null, {}));
    const [lockCount, setLockCount] = useState(0);

    // Conversation
    const [talk, setTalk] = useState('idle'); // idle | listening | thinking | speaking
    const [turns, setTurns] = useState([]);   // {who: 'you'|'plant', text}
    const [talkNote, setTalkNote] = useState('');
    const [needsTap, setNeedsTap] = useState(null);   // text the browser would not let us play yet
    const [onCall, setOnCall] = useState(!!call);
    const [callSecs, setCallSecs] = useState(0);

    const missesRef = useRef(0);
    const lockedRef = useRef(false);
    const boxRef = useRef(null);
    const faceRef = useRef(null);
    const voiceRef = useRef(null);
    const talkRef = useRef('idle');
    const convoOn = useRef(false);
    const greetedFor = useRef(-1);
    const turnsRef = useRef([]);
    const dataRef = useRef(null);

    useEffect(() => { talkRef.current = talk; }, [talk]);
    useEffect(() => { turnsRef.current = turns; }, [turns]);
    useEffect(() => { dataRef.current = data; }, [data]);

    // Voice engine: drives the mouth straight on the DOM, every frame, without re-rendering React.
    useEffect(() => {
        const v = new PlantVoice({ onMouth: (m) => faceRef.current?.style.setProperty('--mouth', m.toFixed(3)) });
        voiceRef.current = v;
        return () => { convoOn.current = false; v.destroy(); voiceRef.current = null; };
    }, []);

    const place = useCallback((box, locked) => {
        boxRef.current = box;
        const wide = window.innerWidth >= 900;
        setRect(frameBoxToScreen(videoRef.current, box, { cardBelow: locked && !wide, cardSide: locked && wide }));
    }, [videoRef]);

    useEffect(() => {
        const onResize = () => place(boxRef.current, lockedRef.current);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [place]);

    // Scan loop: one request at a time; paused while hidden or while the plant is in a conversation.
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
            if (document.hidden || !video || !video.videoWidth || talkRef.current !== 'idle' || convoOn.current) { schedule(700); return; }

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
        return () => { alive = false; clearTimeout(timer); controller?.abort(); };
    }, [language, place, videoRef]);

    const say = useCallback(async (text, lang) => {
        const v = voiceRef.current;
        const d = dataRef.current;
        if (!v || !text) return true;
        setTalk('speaking');
        const played = await v.speak(text, { language: lang || language, level: LEVEL[d?.health_status ?? call?.healthStatus] ?? 1 });
        setTalk('idle');
        if (!played) setNeedsTap({ text, lang });
        return played;
    }, [language, call]);

    // The plant greets the farmer once each time it locks onto a plant.
    useEffect(() => {
        if (call || !data?.say || greetedFor.current === lockCount || convoOn.current) return;
        greetedFor.current = lockCount;
        setTurns([{ who: 'plant', text: data.say }]);
        say(data.say);
    }, [data, lockCount, say]);

    /** One full conversational turn; keeps going until the farmer stops talking or taps End. */
    const conversation = useCallback(async () => {
        const v = voiceRef.current;
        if (!v) return;
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setTalkNote(c.noMic); return; }
        convoOn.current = true;
        setTalkNote('');
        v.unlock();
        while (convoOn.current) {
            setTalk('listening');
            let clip;
            try { clip = await v.listen(); } catch { setTalkNote(c.noMic); break; }
            if (!convoOn.current) break;
            if (!clip) { setTalkNote(c.notHeard); break; }

            setTalk('thinking');
            try {
                const form = new FormData();
                form.append('audio', clip, 'turn.webm');
                form.append('language', language);
                const stt = await (await fetch('/api/transcribe', { method: 'POST', body: form })).json();
                const heard = (stt.transcript || '').trim();
                if (!heard) { setTalkNote(c.notHeard); break; }
                const lang = ['en', 'hi', 'te'].includes(stt.language) ? stt.language : language;
                const history = turnsRef.current.map((t) => ({ role: t.who === 'you' ? 'user' : 'assistant', content: t.text }));
                setTurns((t) => [...t, { who: 'you', text: heard }]);

                const d = dataRef.current;
                const reply = await (await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: heard,
                        plant_type: d?.plant_name || call?.plant || 'plant',
                        health_status: d?.health_status || call?.healthStatus || 'unknown',
                        diseases: d?.issue ? [d.issue] : call?.issue ? [call.issue] : [],
                        conversation_history: history,
                        language: lang,
                        voice: true,
                    }),
                })).json();
                const text = reply.response || reply.reply;
                if (!text || !convoOn.current) break;
                setTurns((t) => [...t, { who: 'plant', text }]);
                await say(text, lang);
            } catch {
                setTalkNote(c.notHeard);
                break;
            }
        }
        convoOn.current = false;
        setTalk('idle');
    }, [c, language, say, call]);

    // Answered call: the plant speaks first, then the conversation runs hands-free.
    useEffect(() => {
        if (!call) return undefined;
        let cancelled = false;
        const start = setTimeout(async () => {
            if (cancelled) return;
            setTurns([{ who: 'plant', text: call.say }]);
            const played = await say(call.say, call.language);
            if (!cancelled && played) conversation();
        }, 1200);
        const tick = setInterval(() => setCallSecs((n) => n + 1), 1000);
        return () => { cancelled = true; clearTimeout(start); clearInterval(tick); };
    }, [call, say, conversation]);

    const hearNow = async () => {
        const pending = needsTap;
        setNeedsTap(null);
        voiceRef.current?.unlock();
        const played = await say(pending.text, pending.lang);
        if (played && onCall && !convoOn.current) conversation();
    };

    const startTalk = () => {
        voiceRef.current?.unlock();
        if (talkRef.current === 'speaking') voiceRef.current.stop();
        if (!convoOn.current) conversation();
        else if (talkRef.current === 'listening') voiceRef.current.endTurn();
    };

    const endTalk = () => {
        setOnCall(false);
        convoOn.current = false;
        voiceRef.current?.endTurn();
        voiceRef.current?.stop();
        setTalk('idle');
    };

    const locked = !!data;
    const tone = data ? TONE[data.health_status] || 'mild' : 'none';
    const score = data ? data.health_score : 0;
    const plantKey = data ? `${data.plant_name}-${lockCount}` : 'none';
    const statusText = locked ? data.plant_name : reading ? c.reading : (hint || c.searching);
    const pins = locked ? spotsInReticle(videoRef.current, data.spots, rect) : [];
    const talking = talk !== 'idle' || turns.length > 1;
    const lastTurns = turns.slice(-3);

    return (
        <div className={`arx ${locked ? 'is-locked' : 'is-searching'} ${reading ? 'is-reading' : ''} tone-${tone} talk-${talk}`}>
            {rect && (
                <div className="arx-reticle" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} aria-hidden="true">
                    {/* Scan map: dot grid ripples out from the centre, outline traces the plant, pins mark problem spots */}
                    {locked && (
                        <svg key={`map-${plantKey}`} className="arx-map" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <rect className="arx-map-outline" x="1.5" y="1.5" width="97" height="97" rx="6" pathLength="100" />
                            {DOTS.map((p, i) => (
                                <circle key={i} className="arx-map-dot" cx={p.x} cy={p.y} r="0.9" style={{ animationDelay: `${(p.d * 0.9).toFixed(2)}s` }} />
                            ))}
                        </svg>
                    )}
                    {pins.map((p, i) => (
                        <span key={`${plantKey}-pin-${i}`} className="arx-pin" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${0.5 + i * 0.15}s` }} />
                    ))}

                    <i className="arx-c tl" /><i className="arx-c tr" /><i className="arx-c bl" /><i className="arx-c br" />
                    {reading && !locked && <span className="arx-sweep" />}
                    {locked && <span key={`ping-${lockCount}`} className="arx-ping" />}

                    {/* The plant's face */}
                    {locked && (
                        <div key={`face-${plantKey}`} ref={faceRef} className={`arx-face is-${talk}`} style={{ '--face': Math.max(0.85, Math.min(1.9, rect.width / 300)).toFixed(2) }}>
                            <span className="arx-eye" /><span className="arx-eye" />
                            <span className="arx-mouth" />
                            {talk === 'listening' && <span className="arx-ears" />}
                        </div>
                    )}

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

            {onCall && (
                <div className="arx-call" role="status">
                    <span className="arx-call-dot" />
                    <span className="arx-call-name">{data?.plant_name || call?.plant}</span>
                    <span className="arx-call-time nb-numeral">{String(Math.floor(callSecs / 60)).padStart(2, '0')}:{String(callSecs % 60).padStart(2, '0')}</span>
                    <button type="button" className="arx-call-end" onClick={endTalk} aria-label={c.end}><PhoneOff size={18} /></button>
                </div>
            )}

            {needsTap && (
                <button type="button" className="arx-hear" onClick={hearNow}><Volume2 size={18} aria-hidden="true" /> {c.hearMe}</button>
            )}

            {onCall && !locked && turns.length > 0 && (
                <p className="arx-caption" aria-live="polite">{turns[turns.length - 1].text}</p>
            )}

            {locked && (
                <section key={plantKey} className={`arx-card ${talking ? 'is-talking' : ''}`} aria-label={data.plant_name}>
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

                    {talking ? (
                        <ol className="arx-convo" aria-live="polite">
                            {lastTurns.map((t, i) => (
                                <li key={`${turns.length}-${i}`} className={`arx-bubble ${t.who}`}>
                                    {t.who === 'you' && <span className="arx-bubble-who">{c.you}</span>}
                                    {t.text}
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <>
                            {data.headline && <p className="arx-headline" style={{ '--i': 3 }}>{data.headline}</p>}
                            <ul className="arx-rows">
                                {data.issue && <li style={{ '--i': 4 }} className="arx-row warn"><AlertTriangle size={16} aria-hidden="true" /><span>{data.issue}</span></li>}
                                {data.tip && <li style={{ '--i': 5 }} className="arx-row"><Lightbulb size={16} aria-hidden="true" /><span><b>{c.tip}.</b> {data.tip}</span></li>}
                                {data.fact && <li style={{ '--i': 6 }} className="arx-row"><BookOpen size={16} aria-hidden="true" /><span><b>{c.fact}.</b> {data.fact}</span></li>}
                            </ul>
                            <span className="arx-chips" style={{ '--i': 7 }}>
                                {data.water && <span className="arx-chip"><Droplets size={14} aria-hidden="true" />{c.water[data.water] || data.water}</span>}
                                {data.sun && <span className="arx-chip"><Sun size={14} aria-hidden="true" />{c.sun[data.sun] || data.sun}</span>}
                            </span>
                        </>
                    )}

                    {talkNote && <p className="arx-note">{talkNote}</p>}

                    <div className="arx-foot" style={{ '--i': 8 }}>
                        <button type="button" className={`arx-talk is-${talk}`} onClick={startTalk} aria-pressed={talk !== 'idle'}>
                            {talk === 'listening' ? <span className="arx-wave" aria-hidden="true"><i /><i /><i /><i /></span>
                                : talk === 'thinking' ? <Loader2 size={16} className="spin" aria-hidden="true" />
                                    : <Mic size={16} aria-hidden="true" />}
                            {talk === 'listening' ? c.listening : talk === 'thinking' ? c.thinking : talk === 'speaking' ? c.speaking : c.talk}
                        </button>
                        {talk !== 'idle' || convoOn.current ? (
                            <button type="button" className="arx-end" onClick={endTalk}><Square size={14} aria-hidden="true" /> {c.end}</button>
                        ) : (
                            <button type="button" className="arx-report" onClick={onFullReport}><FileText size={16} aria-hidden="true" /> {c.report}</button>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
