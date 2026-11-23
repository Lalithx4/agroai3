'use client';

import { toWav } from '@/lib/audio-wav';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Image as ImageIcon, Mic, Square, Loader2, Volume2, Stethoscope, Leaf, CheckCircle2, AlertTriangle, HelpCircle, CircleAlert, ScanEye } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DoctorPlant } from '@/lib/doctor-plant-engine';
import './voice-doctor.css';

const FALLBACK_CROPS = [{ id: 'tomato', name: 'Tomato', examples: true }];
const LANGS = [
    { id: 'en', label: 'English' },
    { id: 'hi', label: 'हिन्दी' },
    { id: 'te', label: 'తెలుగు' },
];
const MAX_RECORD_MS = 25000;

// Every visible string, in the three app languages. The plant's spoken sentences come from the server.
const COPY = {
    en: {
        title: 'Voice Doctor',
        sub: 'Show me your plant, tell me what you see, and I will talk to you.',
        status: { ready: 'ready', listening: 'listening', thinking: 'thinking', speaking: 'speaking' },
        emptyTitle: 'Show me any plant',
        emptyBody: 'Pot, soil or open field. Take or choose a photo.',
        canvasLabel: 'Plant photo with talking face. Tap or drag to move the face.',
        dragHint: 'Tap or drag on the photo to move my face. The photo stays on your phone until you press Ask.',
        step1: '1 · Language and plant',
        whichPlant: 'Which plant? Any plant works; I am best at the ones marked ★',
        anyPlant: 'Any other plant',
        step2: '2 · Photo and voice',
        takePhoto: 'Take photo',
        gallery: 'Gallery',
        stop: 'Stop',
        recordAgain: 'Record again',
        tellMe: 'Tell me what you see',
        voiceReady: 'Voice note ready.',
        ask: 'Ask the plant doctor',
        wait: 'Please wait…',
        addPhoto: 'Add a photo first. A voice note is optional.',
        phases: ['Looking at your leaf…', 'Comparing with example photos…', 'Listening to what you said…', 'Finding the words…'],
        hearAgain: 'Hear again',
        heard: 'I heard',
        plant: 'Plant',
        verified: 'Compared with example photos of this crop.',
        general: 'General guess: I have no example photos of this plant yet, so I am less reliable.',
        sure: (n) => `About ${n}% sure.`,
        confirm: 'Please confirm with your agriculture officer before spraying.',
        v: {
            unclear: ['Photo not clear', 'Take another photo in daylight, closer to the leaf.'],
            unsure: ['Not sure yet', 'Take another photo, or ask the agriculture officer.'],
            mayBe: (p) => `It may be ${p}.`,
            mayBeHealthy: 'It may be healthy.',
            healthy: ['Looks healthy', 'Keep checking the plant every few days.'],
            serious: ['Serious problem', (p) => `Likely ${p}. Show it to the agriculture officer soon.`],
            care: ['Needs care', (p) => `Likely ${p}.`],
        },
        err: {
            notImage: 'That is not a picture. Use JPG, PNG or WebP.',
            tooBig: 'That picture is too large (over 30 MB).',
            unread: 'Could not read this picture. Try a JPG or PNG; some phone formats such as HEIC do not open in browsers.',
            noGreen: 'I could not find much green. Drag my face onto the plant, or retake the photo closer, in daylight.',
            noMic: 'Voice recording is not available in this browser. You can still send the photo.',
            mic: 'Could not use the microphone',
            failed: 'Something went wrong',
            sttOnlyPhoto: 'I used only the photo.',
            noSarvam: 'The Sarvam voice is not available, so I am using this phone’s own voice.',
        },
    },
    hi: {
        title: 'वॉइस डॉक्टर',
        sub: 'मुझे अपना पौधा दिखाओ, बताओ क्या दिख रहा है, और मैं तुमसे बात करूँगा।',
        status: { ready: 'तैयार', listening: 'सुन रहा हूँ', thinking: 'सोच रहा हूँ', speaking: 'बोल रहा हूँ' },
        emptyTitle: 'कोई भी पौधा दिखाओ',
        emptyBody: 'गमला, क्यारी या खेत। फोटो लो या चुनो।',
        canvasLabel: 'बोलते चेहरे वाली पौधे की फोटो। चेहरा हटाने के लिए टैप करें या खींचें।',
        dragHint: 'फोटो पर टैप करके या खींचकर मेरा चेहरा हटा सकते हो। पूछने तक फोटो आपके फ़ोन में ही रहती है।',
        step1: '1 · भाषा और पौधा',
        whichPlant: 'कौन सा पौधा? कोई भी चलेगा; ★ वाले पौधों में मैं सबसे अच्छा हूँ',
        anyPlant: 'कोई और पौधा',
        step2: '2 · फोटो और आवाज़',
        takePhoto: 'फोटो लो',
        gallery: 'गैलरी',
        stop: 'रोको',
        recordAgain: 'फिर से बोलो',
        tellMe: 'बताओ क्या दिख रहा है',
        voiceReady: 'आवाज़ रिकॉर्ड हो गई।',
        ask: 'पौधे के डॉक्टर से पूछो',
        wait: 'थोड़ा रुको…',
        addPhoto: 'पहले फोटो डालो। बोलना ज़रूरी नहीं है।',
        phases: ['पत्ता देख रहा हूँ…', 'उदाहरण फोटो से मिला रहा हूँ…', 'आपकी बात सुन रहा हूँ…', 'शब्द ढूँढ रहा हूँ…'],
        hearAgain: 'फिर से सुनो',
        heard: 'मैंने सुना',
        plant: 'पौधा',
        verified: 'इस फसल की उदाहरण फोटो से मिलाया गया।',
        general: 'अंदाज़ा: इस पौधे की उदाहरण फोटो अभी मेरे पास नहीं हैं, इसलिए कम भरोसेमंद।',
        sure: (n) => `लगभग ${n}% पक्का।`,
        confirm: 'छिड़काव से पहले कृषि अधिकारी से ज़रूर पूछें।',
        v: {
            unclear: ['फोटो साफ़ नहीं है', 'दिन की रोशनी में पत्ते के पास से एक और फोटो लो।'],
            unsure: ['अभी पक्का नहीं', 'एक और फोटो लो, या कृषि अधिकारी से पूछो।'],
            mayBe: (p) => `शायद ${p} हो।`,
            mayBeHealthy: 'शायद ठीक है।',
            healthy: ['स्वस्थ लग रहा है', 'हर कुछ दिन में पौधे को देखते रहो।'],
            serious: ['गंभीर समस्या', (p) => `शायद ${p}। जल्दी कृषि अधिकारी को दिखाओ।`],
            care: ['देखभाल चाहिए', (p) => `शायद ${p}।`],
        },
        err: {
            notImage: 'ये फोटो नहीं है। JPG, PNG या WebP इस्तेमाल करो।',
            tooBig: 'फोटो बहुत बड़ी है (30 MB से ज़्यादा)।',
            unread: 'ये फोटो खुल नहीं रही। JPG या PNG आज़माओ।',
            noGreen: 'मुझे ज़्यादा हरा रंग नहीं मिला। मेरा चेहरा पौधे पर खींचो, या दिन की रोशनी में पास से फोटो लो।',
            noMic: 'इस ब्राउज़र में आवाज़ रिकॉर्ड नहीं होती। फोटो फिर भी भेज सकते हो।',
            mic: 'माइक्रोफ़ोन नहीं चला',
            failed: 'कुछ गड़बड़ हो गई',
            sttOnlyPhoto: 'मैंने सिर्फ़ फोटो देखी।',
            noSarvam: 'Sarvam आवाज़ अभी नहीं चल रही, इसलिए फ़ोन की अपनी आवाज़ इस्तेमाल कर रहा हूँ।',
        },
    },
    te: {
        title: 'వాయిస్ డాక్టర్',
        sub: 'మీ మొక్కను చూపించండి, మీరు ఏం చూస్తున్నారో చెప్పండి, నేను మీతో మాట్లాడతాను.',
        status: { ready: 'సిద్ధం', listening: 'వింటున్నాను', thinking: 'ఆలోచిస్తున్నాను', speaking: 'మాట్లాడుతున్నాను' },
        emptyTitle: 'ఏ మొక్కైనా చూపించండి',
        emptyBody: 'కుండీ, మడి లేదా పొలం. ఫోటో తీయండి లేదా ఎంచుకోండి.',
        canvasLabel: 'మాట్లాడే ముఖంతో మొక్క ఫోటో. ముఖాన్ని జరపడానికి తాకండి లేదా లాగండి.',
        dragHint: 'ఫోటోపై తాకి లేదా లాగి నా ముఖాన్ని జరపవచ్చు. అడిగే వరకు ఫోటో మీ ఫోన్‌లోనే ఉంటుంది.',
        step1: '1 · భాష మరియు మొక్క',
        whichPlant: 'ఏ మొక్క? ఏదైనా సరే; ★ ఉన్న వాటిలో నేను బాగా చెప్పగలను',
        anyPlant: 'వేరే మొక్క',
        step2: '2 · ఫోటో మరియు గొంతు',
        takePhoto: 'ఫోటో తీయండి',
        gallery: 'గ్యాలరీ',
        stop: 'ఆపండి',
        recordAgain: 'మళ్ళీ చెప్పండి',
        tellMe: 'ఏం కనిపిస్తోందో చెప్పండి',
        voiceReady: 'మీ మాట రికార్డ్ అయింది.',
        ask: 'మొక్కల డాక్టర్‌ని అడగండి',
        wait: 'కొంచెం ఆగండి…',
        addPhoto: 'ముందు ఫోటో పెట్టండి. మాట్లాడటం తప్పనిసరి కాదు.',
        phases: ['ఆకును చూస్తున్నాను…', 'ఉదాహరణ ఫోటోలతో పోలుస్తున్నాను…', 'మీరు చెప్పింది వింటున్నాను…', 'మాటలు కూర్చుతున్నాను…'],
        hearAgain: 'మళ్ళీ వినండి',
        heard: 'నేను విన్నది',
        plant: 'మొక్క',
        verified: 'ఈ పంట ఉదాహరణ ఫోటోలతో పోల్చాను.',
        general: 'అంచనా మాత్రమే: ఈ మొక్క ఉదాహరణ ఫోటోలు నా దగ్గర లేవు, కాబట్టి తక్కువ నమ్మదగినది.',
        sure: (n) => `సుమారు ${n}% ఖచ్చితం.`,
        confirm: 'పిచికారీ చేసే ముందు వ్యవసాయ అధికారిని తప్పక అడగండి.',
        v: {
            unclear: ['ఫోటో స్పష్టంగా లేదు', 'పగటి వెలుగులో ఆకుకు దగ్గరగా ఇంకో ఫోటో తీయండి.'],
            unsure: ['ఇంకా ఖచ్చితంగా తెలియదు', 'ఇంకో ఫోటో తీయండి, లేదా వ్యవసాయ అధికారిని అడగండి.'],
            mayBe: (p) => `బహుశా ${p} కావచ్చు.`,
            mayBeHealthy: 'బహుశా బాగానే ఉంది.',
            healthy: ['ఆరోగ్యంగా ఉంది', 'కొన్ని రోజులకు ఒకసారి మొక్కను చూస్తూ ఉండండి.'],
            serious: ['తీవ్రమైన సమస్య', (p) => `బహుశా ${p}. త్వరగా వ్యవసాయ అధికారికి చూపించండి.`],
            care: ['జాగ్రత్త అవసరం', (p) => `బహుశా ${p}.`],
        },
        err: {
            notImage: 'ఇది ఫోటో కాదు. JPG, PNG లేదా WebP వాడండి.',
            tooBig: 'ఫోటో చాలా పెద్దది (30 MB కంటే ఎక్కువ).',
            unread: 'ఈ ఫోటో తెరవలేకపోయాను. JPG లేదా PNG ప్రయత్నించండి.',
            noGreen: 'నాకు పచ్చదనం పెద్దగా కనిపించలేదు. నా ముఖాన్ని మొక్కపైకి లాగండి, లేదా పగటి వెలుగులో దగ్గరగా ఫోటో తీయండి.',
            noMic: 'ఈ బ్రౌజర్‌లో గొంతు రికార్డ్ కాదు. ఫోటో మాత్రం పంపవచ్చు.',
            mic: 'మైక్ పనిచేయలేదు',
            failed: 'ఏదో తప్పు జరిగింది',
            sttOnlyPhoto: 'నేను ఫోటో మాత్రమే చూశాను.',
            noSarvam: 'Sarvam గొంతు అందుబాటులో లేదు, కాబట్టి ఫోన్ సొంత గొంతు వాడుతున్నాను.',
        },
    },
};

const problemName = (r) => (r.disease_name || (r.diagnosis ? r.diagnosis.replace(/_/g, ' ') : '')).toLowerCase();

function verdict(result, c) {
    if (!result) return null;
    const p = problemName(result);
    if (result.diagnosis === 'unclear_photo') return { cls: 'grey', Icon: ScanEye, title: c.v.unclear[0], sub: c.v.unclear[1] };
    if (result.uncertain) {
        const maybe = result.diagnosis === 'healthy' ? c.v.mayBeHealthy : result.diagnosis !== 'other' && p ? c.v.mayBe(p) : '';
        return { cls: 'grey', Icon: HelpCircle, title: c.v.unsure[0], sub: `${maybe}${maybe ? ' ' : ''}${c.v.unsure[1]}` };
    }
    if (result.diagnosis === 'healthy') return { cls: 'green', Icon: CheckCircle2, title: c.v.healthy[0], sub: c.v.healthy[1] };
    if (result.level >= 3) return { cls: 'red', Icon: AlertTriangle, title: c.v.serious[0], sub: c.v.serious[1](p) };
    return { cls: 'amber', Icon: CircleAlert, title: c.v.care[0], sub: c.v.care[1](p) };
}

export default function VoiceDoctorPage() {
    const { language, setLanguage } = useLanguage();
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const fileRef = useRef(null);
    const recRef = useRef({ rec: null, chunks: [], timer: null });
    const runRef = useRef(0);
    const phaseTimer = useRef(null);

    const [lang, setLang] = useState(() => (['en', 'hi', 'te'].includes(language) ? language : 'en'));
    const [crop, setCrop] = useState('');
    const [crops, setCrops] = useState(FALLBACK_CROPS);
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

    const c = COPY[lang] || COPY.en;

    // Follow the app-wide language switch in the header.
    const [seenLanguage, setSeenLanguage] = useState(language);
    if (language !== seenLanguage) {
        setSeenLanguage(language);
        if (COPY[language]) setLang(language);
    }

    useEffect(() => {
        fetch('/api/voice-doctor').then((r) => r.json()).then((d) => { if (Array.isArray(d.crops) && d.crops.length) setCrops(d.crops); }).catch(() => {});
    }, []);

    useEffect(() => {
        const engine = new DoctorPlant(canvasRef.current);
        engineRef.current = engine;
        const move = (e) => { const p = e.touches ? e.touches[0] : e; engine.setPointer(p.clientX, p.clientY); };
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: true });
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('touchmove', move);
            clearInterval(phaseTimer.current);
            engine.destroy();
            engineRef.current = null;
        };
    }, []);

    const onPhoto = useCallback(async (file) => {
        if (!file) return;
        const engine = engineRef.current;
        setError(''); setResult(null); setNowIdx(-1); setNote('');
        if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name || '')) { setError(c.err.notImage); return; }
        if (file.size > 30 * 1024 * 1024) { setError(c.err.tooBig); return; }
        try {
            const stats = await engine.loadImage(file);
            engine.setLevel(0); engine.showRings = false; engine.showDamage = false;
            canvasRef.current.style.display = 'block';
            setHasPhoto(true); setPhotoInfo(stats);
            if (!stats.found) setNote(c.err.noGreen);
        } catch {
            setError(c.err.unread);
        }
    }, [c]);

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
            setError(c.err.noMic);
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
                setRecording(false);
                // Sarvam speech-to-text only takes WAV/MP3, not the browser's webm.
                if (blob.size > 0) toWav(blob).then((wav) => setAudioBlob(wav)); else setAudioBlob(null);
                if (engine && engine.mode === 'listening') engine.setMode('idle');
            };
            rec.start();
            setRecording(true); setAudioBlob(null);
            if (engine) engine.setMode('listening');
            recRef.current.timer = setTimeout(stopRecording, MAX_RECORD_MS);
        } catch (e) {
            setError(`${c.err.mic}: ${e.message}`);
        }
    }, [recording, stopRecording, c]);

    const speakAll = useCallback(async (res, runId) => {
        const engine = engineRef.current;
        // Ask for every sentence's audio at once, so the plant talks without long silences between sentences.
        const voiced = res.sarvam !== false
            ? res.sentences.map((text) => fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language: res.language, level: res.level }) })
                .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('tts ' + r.status)))))
            : [];
        voiced.forEach((p) => p.catch(() => {}));
        let sarvamFailed = !voiced.length;
        for (let i = 0; i < res.sentences.length; i++) {
            if (runRef.current !== runId) return;
            setNowIdx(i);
            const spot = engine.hs.length ? i % engine.hs.length : -1;
            if (!sarvamFailed) {
                try {
                    const blob = await voiced[i];
                    if (runRef.current !== runId) return;
                    await engine.playAudio(blob, spot);
                    // A short breath between sentences, a little longer when the plant is unwell.
                    await new Promise((r) => setTimeout(r, 180 + (res.level || 0) * 60));
                    continue;
                } catch {
                    sarvamFailed = true;
                    setNote((COPY[res.language] || COPY.en).err.noSarvam);
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
        engine.setMode('thinking');
        // Staged progress text carries the ~4-5 s wait (EXPERIENCE.md "Thinking").
        const steps = c.phases.filter((_, i) => i !== 2 || audioBlob);
        let step = 0;
        setPhase(steps[0]);
        clearInterval(phaseTimer.current);
        phaseTimer.current = setInterval(() => {
            step = Math.min(step + 1, steps.length - 1);
            setPhase(steps[step]);
        }, 1400);
        try {
            const img = await engine.toBlob(0.85);
            const form = new FormData();
            form.append('image', img, 'plant.jpg');
            if (audioBlob) form.append('audio', audioBlob, 'speech.wav');
            if (crop) form.append('crop', crop);
            form.append('language', lang);
            const r = await fetch('/api/voice-doctor', { method: 'POST', body: form });
            const data = await r.json();
            if (!r.ok) throw new Error(data.detail || data.error || 'Request failed');
            if (runRef.current !== runId) return;
            setResult(data);
            if (data.stt && data.stt.error && audioBlob) setNote(`${data.stt.error}. ${c.err.sttOnlyPhoto}`);
            if (data.language && data.language !== lang) { setLang(data.language); setLanguage && setLanguage(data.language); }
            engine.setLevel(data.level);
            engine.showRings = !data.uncertain && data.diagnosis !== 'healthy';
            engine.setMode('idle');
            clearInterval(phaseTimer.current);
            setPhase('');
            setBusy(false);
            await speakAll(data, runId);
        } catch (e) {
            engine.setMode('idle');
            clearInterval(phaseTimer.current);
            setPhase('');
            setBusy(false);
            setError(`${c.err.failed}: ${e.message}`);
        }
    }, [audioBlob, busy, crop, lang, setLanguage, speakAll, c]);

    const replay = useCallback(() => {
        if (!result) return;
        const runId = ++runRef.current;
        engineRef.current.stop();
        speakAll(result, runId);
    }, [result, speakAll]);

    const light = verdict(result, c);
    const status = busy && !result ? 'thinking' : recording ? 'listening' : nowIdx >= 0 ? 'speaking' : 'ready';

    return (
        <div className="vd" lang={lang}>
            <div className="vd-head">
                <span className="vd-head-icon" aria-hidden="true"><Mic size={22} /></span>
                <div>
                    <h1>{c.title}</h1>
                    <p className="sub">{c.sub}</p>
                </div>
            </div>

            <div className="vd-layout">
                <div className="vd-card vd-stage-card">
                    <div className="vd-stage">
                        <span className={'vd-badge ' + status}>{c.status[status]}</span>
                        {!hasPhoto && (
                            <div className="vd-empty">
                                <div className="vd-empty-icon" aria-hidden="true"><Leaf size={30} /></div>
                                <b>{c.emptyTitle}</b>
                                {c.emptyBody}
                            </div>
                        )}
                        <canvas ref={canvasRef} aria-label={c.canvasLabel} />
                    </div>
                    <div className="vd-caption" aria-live="polite">{busy && !result ? phase : nowIdx >= 0 && result ? result.sentences[nowIdx] : ''}</div>
                    {photoInfo && photoInfo.found && !result && <div className="vd-note">{c.dragHint}</div>}
                </div>

                <div className="vd-side">
                    <div className="vd-card">
                        <p className="vd-card-title">{c.step1}</p>
                        <div className="vd-chips" role="group" aria-label="Language">
                            {LANGS.map((l) => (
                                <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} className={'vd-chip' + (lang === l.id ? ' on' : '')} onClick={() => { setLang(l.id); setLanguage && setLanguage(l.id); }}>{l.label}</button>
                            ))}
                        </div>
                        <label className="small" htmlFor="vd-crop">{c.whichPlant}</label>
                        <select id="vd-crop" value={crop} onChange={(e) => setCrop(e.target.value)}>
                            <option value="">{c.anyPlant}</option>
                            {crops.map((cr) => <option key={cr.id} value={cr.id}>{cr.name}{cr.examples ? ' ★' : ''}</option>)}
                        </select>
                    </div>

                    <div className="vd-card">
                        <p className="vd-card-title">{c.step2}</p>
                        <div className="vd-row">
                            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files[0]); e.target.value = ''; }} />
                            <button type="button" className="vd-btn" onClick={() => { fileRef.current.setAttribute('capture', 'environment'); fileRef.current.click(); }}><Camera size={18} /> {c.takePhoto}</button>
                            <button type="button" className="vd-btn alt" onClick={() => { fileRef.current.removeAttribute('capture'); fileRef.current.click(); }}><ImageIcon size={18} /> {c.gallery}</button>
                        </div>
                        <div className="vd-row">
                            <button type="button" className={'vd-btn ' + (recording ? 'rec' : 'alt')} onClick={toggleRecord} disabled={busy || !hasPhoto} aria-pressed={recording}>
                                {recording ? <><Square size={18} /> {c.stop}</> : <><Mic size={18} /> {audioBlob ? c.recordAgain : c.tellMe}</>}
                            </button>
                        </div>
                        {audioBlob && !recording && <div className="vd-note">{c.voiceReady}</div>}
                        <div className="vd-row">
                            <button type="button" className="vd-btn big" onClick={ask} disabled={!hasPhoto || busy || recording}>
                                {busy ? <><Loader2 size={20} className="spin" /> {phase || c.wait}</> : <><Stethoscope size={20} /> {c.ask}</>}
                            </button>
                        </div>
                        {!hasPhoto && <div className="vd-note">{c.addPhoto}</div>}
                        {note && <div className="vd-warn">{note}</div>}
                        {error && <div className="vd-error" role="alert">{error}</div>}
                    </div>

                    {result && light && (
                        <div className="vd-card vd-result" aria-live="polite">
                            <div className={'vd-light ' + light.cls}>
                                <div className="dot" aria-hidden="true"><light.Icon size={26} strokeWidth={2} /></div>
                                <div><h2>{light.title}</h2><p>{light.sub}</p></div>
                            </div>
                            <ul className="vd-says">
                                {result.sentences.map((s, i) => <li key={i} className={i === nowIdx ? 'now' : ''} style={{ '--i': i }}>{s}</li>)}
                            </ul>
                            <div className="vd-row">
                                <button type="button" className="vd-btn alt" onClick={replay}><Volume2 size={18} /> {c.hearAgain}</button>
                            </div>
                            {result.transcript && <div className="vd-meta">{c.heard}: “{result.transcript}”</div>}
                            <div className="vd-meta">
                                {result.plant_name ? <>{c.plant}: <b>{result.plant_name}</b>. </> : null}
                                {result.verified ? c.verified : c.general}
                                {' '}{c.sure(Math.round(result.confidence))} {c.confirm}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
