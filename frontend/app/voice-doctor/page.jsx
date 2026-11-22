'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Image as ImageIcon, Mic, Square, Loader2, Volume2, Stethoscope } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DoctorPlant } from '@/lib/doctor-plant-engine';
import './voice-doctor.css';

const CROPS = [
    { id: '', label: 'Not sure / other' },
    { id: 'tomato', label: 'Tomato' },
    { id: 'chilli', label: 'Chilli' },
    { id: 'cotton', label: 'Cotton' },
    { id: 'paddy', label: 'Paddy (rice)' },
];
const LANGS = [
    { id: 'en', label: 'English' },
    { id: 'hi', label: 'हिन्दी' },
    { id: 'te', label: 'తెలుగు' },
];
const MAX_RECORD_MS = 25000;

const DIAGNOSIS_LABEL = (d) => (d ? d.replace(/_/g, ' ') : '');

function traffic(result) {
    if (!result) return null;
    if (result.diagnosis === 'unclear_photo') return { cls: 'grey', icon: '📷', title: 'Photo not clear', sub: 'Please take another photo in daylight, closer to the leaf.' };
    if (result.uncertain) return { cls: 'amber', icon: '❓', title: 'Not sure', sub: 'Take another photo, or ask the agriculture officer.' };
    if (result.diagnosis === 'healthy') return { cls: 'green', icon: '✅', title: 'Looks healthy', sub: 'Keep checking the plant every few days.' };
    if (result.level >= 3) return { cls: 'red', icon: '⚠️', title: 'Serious problem', sub: `Possible: ${DIAGNOSIS_LABEL(result.diagnosis)}. Show it to the agriculture officer soon.` };
    return { cls: 'amber', icon: '🟠', title: 'Needs care', sub: `Possible: ${DIAGNOSIS_LABEL(result.diagnosis)}.` };
}

export default function VoiceDoctorPage() {
    const { language, setLanguage } = useLanguage();
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const fileRef = useRef(null);
    const recRef = useRef({ rec: null, chunks: [], timer: null });
    const runRef = useRef(0);

    const [lang, setLang] = useState('en');
    const [crop, setCrop] = useState('');
    const [hasPhoto, setHasPhoto] = useState(false);
    const [photoInfo, setPhotoInfo] = useState(null);
    const [recording, setRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [busy, setBusy] = useState(false);
    const [phase, setPhase] = useState('');
    const [result, setResult] = useState(null);
    const [nowIdx, setNowIdx] = useState(-1);
    const [error, setError] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (['en', 'hi', 'te'].includes(language)) setLang(language);
    }, [language]);

    useEffect(() => {
        const engine = new DoctorPlant(canvasRef.current);
        engineRef.current = engine;
        const move = (e) => { const p = e.touches ? e.touches[0] : e; engine.setPointer(p.clientX, p.clientY); };
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: true });
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('touchmove', move);
            engine.destroy();
            engineRef.current = null;
        };
    }, []);

    const onPhoto = useCallback(async (file) => {
        if (!file) return;
        const engine = engineRef.current;
        setError(''); setResult(null); setNowIdx(-1); setNote('');
        if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name || '')) { setError('That is not a picture. Use JPG, PNG or WebP.'); return; }
        if (file.size > 30 * 1024 * 1024) { setError('That picture is too large (over 30 MB).'); return; }
        try {
            const stats = await engine.loadImage(file);
            engine.setLevel(0); engine.showRings = false; engine.showDamage = false;
            canvasRef.current.style.display = 'block';
            setHasPhoto(true); setPhotoInfo(stats);
            if (!stats.found) setNote('I could not find much green. Drag my face onto the plant, or retake the photo closer, in daylight.');
        } catch (e) {
            setError('Could not read this picture. Try a JPG or PNG (some phone formats such as HEIC are not supported by browsers).');
        }
    }, []);

    const stopRecording = useCallback(() => {
        const r = recRef.current;
        if (r.timer) { clearTimeout(r.timer); r.timer = null; }
        if (r.rec && r.rec.state !== 'inactive') r.rec.stop();
    }, []);

    const toggleRecord = useCallback(async () => {
        const engine = engineRef.current;
        if (recording) { stopRecording(); return; }
        setError('');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
            setError('Voice recording is not available in this browser. You can still send the photo.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const rec = new MediaRecorder(stream);
            recRef.current.rec = rec; recRef.current.chunks = [];
            rec.ondataavailable = (e) => { if (e.data && e.data.size) recRef.current.chunks.push(e.data); };
            rec.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(recRef.current.chunks, { type: rec.mimeType || 'audio/webm' });
                setAudioBlob(blob.size > 0 ? blob : null);
                setRecording(false);
                if (engine && engine.mode === 'listening') engine.setMode('idle');
            };
            rec.start();
            setRecording(true); setAudioBlob(null);
            if (engine) engine.setMode('listening');
            recRef.current.timer = setTimeout(stopRecording, MAX_RECORD_MS);
        } catch (e) {
            setError('Could not use the microphone: ' + e.message);
        }
    }, [recording, stopRecording]);

    const speakAll = useCallback(async (res, runId) => {
        const engine = engineRef.current;
        let sarvamFailed = !res.sarvam;
        for (let i = 0; i < res.sentences.length; i++) {
            if (runRef.current !== runId) return;
            setNowIdx(i);
            const spot = engine.hs.length ? i % engine.hs.length : -1;
            if (!sarvamFailed) {
                try {
                    const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: res.sentences[i], language: res.language, level: res.level }) });
                    if (!r.ok) throw new Error('tts ' + r.status);
                    const blob = await r.blob();
                    if (runRef.current !== runId) return;
                    await engine.playAudio(blob, spot);
                    continue;
                } catch (e) {
                    sarvamFailed = true;
                    setNote('Sarvam voice is not available, so I am using this phone\'s own voice.');
                }
            }
            await engine.speakBrowser(res.sentences[i], res.language, spot);
        }
        if (runRef.current === runId) setNowIdx(-1);
    }, []);

    const ask = useCallback(async () => {
        const engine = engineRef.current;
        if (!engine || !engine.ready || busy) return;
        const runId = ++runRef.current;
        engine.stop(); setBusy(true); setError(''); setResult(null); setNowIdx(-1); setNote('');
        engine.setMode('thinking'); setPhase('Looking at your plant...');
        try {
            const img = await engine.toBlob(0.85);
            const form = new FormData();
            form.append('image', img, 'plant.jpg');
            if (audioBlob) form.append('audio', audioBlob, 'speech.webm');
            if (crop) form.append('crop', crop);
            form.append('language', lang);
            const r = await fetch('/api/voice-doctor', { method: 'POST', body: form });
            const data = await r.json();
            if (!r.ok) throw new Error(data.detail || data.error || 'Request failed');
            if (runRef.current !== runId) return;
            setResult(data);
            if (data.stt && data.stt.error && audioBlob) setNote(data.stt.error + '. I used only the photo.');
            if (data.language && data.language !== lang) { setLang(data.language); setLanguage && setLanguage(data.language); }
            engine.setLevel(data.level);
            engine.showRings = !data.uncertain && data.diagnosis !== 'healthy';
            engine.setMode('idle'); setPhase('');
            setBusy(false);
            await speakAll(data, runId);
        } catch (e) {
            engine.setMode('idle'); setPhase('');
            setError('Something went wrong: ' + e.message);
            setBusy(false);
        }
    }, [audioBlob, busy, crop, lang, setLanguage, speakAll]);

    const replay = useCallback(() => {
        if (!result) return;
        const runId = ++runRef.current;
        engineRef.current.stop();
        speakAll(result, runId);
    }, [result, speakAll]);

    const light = traffic(result);

    return (
        <div className="vd">
            <h1>Voice Doctor</h1>
            <p className="sub">Show me your plant, tell me what you see, and I will talk to you.</p>

            <div className="vd-card">
                <div className="vd-chips" role="group" aria-label="Language">
                    {LANGS.map((l) => (
                        <button key={l.id} type="button" className={'vd-chip' + (lang === l.id ? ' on' : '')} onClick={() => { setLang(l.id); setLanguage && setLanguage(l.id); }}>{l.label}</button>
                    ))}
                </div>
                <label className="small" htmlFor="vd-crop">Which crop? (helps me guess better)</label>
                <select id="vd-crop" value={crop} onChange={(e) => setCrop(e.target.value)}>
                    {CROPS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
            </div>

            <div className="vd-card">
                <div className="vd-stage">
                    <span className="vd-badge">{busy ? 'thinking' : recording ? 'listening' : nowIdx >= 0 ? 'speaking' : 'ready'}</span>
                    {!hasPhoto && (
                        <div className="vd-empty">
                            <b>Show me any plant</b>
                            Pot, soil or open field. Take or choose a photo.
                        </div>
                    )}
                    <canvas ref={canvasRef} aria-label="Plant photo with talking face. Tap or drag to move the face." />
                </div>
                <div className="vd-caption" aria-live="polite">{busy ? phase : nowIdx >= 0 && result ? result.sentences[nowIdx] : ''}</div>

                <div className="vd-row">
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files[0]); e.target.value = ''; }} />
                    <button type="button" className="vd-btn" onClick={() => { fileRef.current.setAttribute('capture', 'environment'); fileRef.current.click(); }}><Camera size={18} /> Take photo</button>
                    <button type="button" className="vd-btn alt" onClick={() => { fileRef.current.removeAttribute('capture'); fileRef.current.click(); }}><ImageIcon size={18} /> Gallery</button>
                </div>

                <div className="vd-row">
                    <button type="button" className={'vd-btn alt' + (recording ? ' rec' : '')} onClick={toggleRecord} disabled={busy || !hasPhoto} style={recording ? { background: '#d94b3d', color: '#fff', borderColor: '#d94b3d' } : undefined}>
                        {recording ? <><Square size={18} /> Stop</> : <><Mic size={18} /> {audioBlob ? 'Record again' : 'Tell me what you see'}</>}
                    </button>
                    {audioBlob && !recording && <span className="vd-meta" style={{ alignSelf: 'center' }}>Voice note ready</span>}
                </div>
                <div className="vd-row">
                    <button type="button" className="vd-btn big" onClick={ask} disabled={!hasPhoto || busy || recording}>
                        {busy ? <><Loader2 size={20} className="spin" /> {phase || 'Please wait...'}</> : <><Stethoscope size={20} /> Ask the plant doctor</>}
                    </button>
                </div>
                {photoInfo && photoInfo.found && !result && <div className="vd-note">Tap or drag on the photo to move my face. The photo stays on your phone until you press Ask.</div>}
                {note && <div className="vd-warn">{note}</div>}
                {error && <div className="vd-warn" role="alert" style={{ background: '#fde4e1', color: '#8a1c12' }}>{error}</div>}
            </div>

            {result && light && (
                <div className="vd-card">
                    <div className={'vd-light ' + light.cls}>
                        <div className="dot" aria-hidden="true">{light.icon}</div>
                        <div><h2>{light.title}</h2><p>{light.sub}</p></div>
                    </div>
                    <ul className="vd-says">
                        {result.sentences.map((s, i) => <li key={i} className={i === nowIdx ? 'now' : ''}>{s}</li>)}
                    </ul>
                    <div className="vd-row">
                        <button type="button" className="vd-btn alt" onClick={replay}><Volume2 size={18} /> Hear again</button>
                    </div>
                    {result.transcript && <div className="vd-meta">I heard: “{result.transcript}”</div>}
                    <div className="vd-meta">AI guess, about {Math.round(result.confidence)}% sure. Please confirm with your agriculture officer before spraying. {Math.round(result.latency_ms / 100) / 10}s</div>
                </div>
            )}
        </div>
    );
}
