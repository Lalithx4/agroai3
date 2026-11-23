'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneOff, Sprout } from 'lucide-react';
import { getCall, clearCall, answerCall, CALL_EVENT } from '@/lib/plant-call';
import './incoming-call.css';

const COPY = {
    en: { calling: 'calling…', field: 'Your plant', accept: 'Accept', decline: 'Decline', hint: 'Answer to see and talk to your plant in the camera' },
    hi: { calling: 'कॉल कर रहा है…', field: 'आपका पौधा', accept: 'उठाएँ', decline: 'काटें', hint: 'उठाइए और कैमरे में अपने पौधे से बात कीजिए' },
    te: { calling: 'కాల్ చేస్తోంది…', field: 'మీ మొక్క', accept: 'ఎత్తండి', decline: 'కట్ చేయండి', hint: 'ఎత్తి కెమెరాలో మీ మొక్కతో మాట్లాడండి' },
};

/** A two-tone phone ring made with WebAudio, so no sound file is needed. */
function startRing() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return () => {};
    const ctx = new AC();
    ctx.resume?.();
    let stopped = false;
    const burst = () => {
        if (stopped) return;
        const t = ctx.currentTime;
        [0, 0.45].forEach((offset) => {
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t + offset);
            g.gain.linearRampToValueAtTime(0.18, t + offset + 0.03);
            g.gain.setValueAtTime(0.18, t + offset + 0.35);
            g.gain.linearRampToValueAtTime(0, t + offset + 0.4);
            g.connect(ctx.destination);
            [440, 480].forEach((f) => {
                const o = ctx.createOscillator();
                o.frequency.value = f;
                o.connect(g);
                o.start(t + offset);
                o.stop(t + offset + 0.4);
            });
        });
        navigator.vibrate?.([400, 200, 400]);
    };
    burst();
    const id = setInterval(burst, 2600);
    return () => {
        if (stopped) return;
        stopped = true;
        clearInterval(id);
        navigator.vibrate?.(0);
        if (ctx.state !== 'closed') ctx.close?.().catch(() => {});
    };
}

export default function IncomingCall() {
    const router = useRouter();
    const [call, setCall] = useState(null);
    const stopRing = useRef(() => {});

    // Wait for the scheduled time, then ring.
    useEffect(() => {
        let timer = null;
        const arm = () => {
            clearTimeout(timer);
            const c = getCall();
            if (!c || c.answered) return;
            timer = setTimeout(() => {
                setCall(getCall());
                if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification(`${c.plant} is calling`, { body: 'Open CropMagix to answer', icon: '/icons/icon-192x192.png', tag: 'plant-call' });
                }
            }, Math.max(0, c.at - Date.now()));
        };
        arm();
        window.addEventListener(CALL_EVENT, arm);
        return () => { clearTimeout(timer); window.removeEventListener(CALL_EVENT, arm); };
    }, []);

    useEffect(() => {
        if (!call) return undefined;
        stopRing.current = startRing();
        // Missed after 30 s.
        const missed = setTimeout(() => { stopRing.current(); clearCall(); setCall(null); }, 30000);
        return () => { clearTimeout(missed); stopRing.current(); };
    }, [call]);

    if (!call) return null;
    const c = COPY[call.language] || COPY.en;

    const accept = () => {
        stopRing.current();
        answerCall(call);
        setCall(null);
        router.push('/scanner?call=1');
    };
    const decline = () => {
        stopRing.current();
        clearCall();
        setCall(null);
    };

    return (
        <div className="icall" role="alertdialog" aria-label={`${call.plant} ${c.calling}`}>
            <div className="icall-top">
                <p className="icall-over">CropMagix · {c.field}</p>
                <div className="icall-avatar" aria-hidden="true">
                    <span className="icall-ring" /><span className="icall-ring two" />
                    <Sprout size={44} strokeWidth={1.6} />
                </div>
                <h2 className="icall-name">{call.plant}</h2>
                <p className="icall-status">{c.calling}</p>
                {call.issue && <p className="icall-issue">{call.issue}</p>}
            </div>
            <p className="icall-hint">{c.hint}</p>
            <div className="icall-actions">
                <button type="button" className="icall-btn decline" onClick={decline} aria-label={c.decline}>
                    <span><PhoneOff size={28} /></span>{c.decline}
                </button>
                <button type="button" className="icall-btn accept" onClick={accept} aria-label={c.accept}>
                    <span><Phone size={28} /></span>{c.accept}
                </button>
            </div>
        </div>
    );
}
