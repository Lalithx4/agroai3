/**
 * Voice I/O for the talking plant in live AR.
 * - listen(): records until the person stops talking (simple energy-based voice detection)
 * - speak(): plays Sarvam speech and reports a 0..1 "mouth" level every frame from the real audio
 * Browser-only. One instance per AR session; call destroy() when done.
 */

const SPEECH_RMS = 0.035;       // above this counts as speech
const END_SILENCE_MS = 1100;    // this much quiet after speech ends the turn
const NO_SPEECH_MS = 7000;      // nobody spoke: give up the turn
const MAX_TURN_MS = 15000;

export class PlantVoice {
    constructor({ onMouth } = {}) {
        this.onMouth = onMouth || (() => {});
        this.ctx = null;
        this.audio = null;
        this.raf = 0;
        this.stopListening = null;
    }

    /** Must be called from a tap at least once, so the browser allows audio. */
    unlock() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) this.ctx = new AC();
        }
        this.ctx?.resume?.();
    }

    /** Record one spoken turn. Resolves with a Blob, or null if nobody spoke. */
    async listen() {
        this.unlock();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const rec = new MediaRecorder(stream);
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

        const source = this.ctx ? this.ctx.createMediaStreamSource(stream) : null;
        const analyser = this.ctx ? this.ctx.createAnalyser() : null;
        if (source && analyser) { analyser.fftSize = 1024; source.connect(analyser); }
        const buf = analyser ? new Float32Array(analyser.fftSize) : null;

        return new Promise((resolve) => {
            const started = performance.now();
            let heard = false;
            let lastVoice = started;
            let done = false;
            let timer = 0;

            const finish = (keep) => {
                if (done) return;
                done = true;
                clearInterval(timer);
                this.stopListening = null;
                rec.onstop = () => {
                    stream.getTracks().forEach((t) => t.stop());
                    source?.disconnect();
                    resolve(keep && heard && chunks.length ? new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) : null);
                };
                if (rec.state !== 'inactive') rec.stop(); else rec.onstop();
            };
            this.stopListening = finish;

            rec.start(250);
            timer = setInterval(() => {
                const now = performance.now();
                if (analyser) {
                    analyser.getFloatTimeDomainData(buf);
                    let sum = 0;
                    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
                    const rms = Math.sqrt(sum / buf.length);
                    if (rms > SPEECH_RMS) { heard = true; lastVoice = now; }
                } else if (now - started > 4000) {
                    heard = true; // no analyser: record a fixed 4 s turn
                    finish(true);
                    return;
                }
                if (heard && now - lastVoice > END_SILENCE_MS) finish(true);
                else if (!heard && now - started > NO_SPEECH_MS) finish(false);
                else if (now - started > MAX_TURN_MS) finish(true);
            }, 80);
        });
    }

    /** Stop listening now and send what was heard. */
    endTurn() {
        this.stopListening?.(true);
    }

    /**
     * Speak text in the plant's voice. Resolves true when it played, false when the browser
     * blocked audio because nobody has tapped yet (the caller then shows a "Hear me" button).
     */
    async speak(text, { language = 'en', level = 1 } = {}) {
        this.stop();
        let res;
        try {
            res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language, level }) });
        } catch { res = null; }
        if (res && res.ok) {
            const url = URL.createObjectURL(await res.blob());
            const played = await this.#play(url);
            URL.revokeObjectURL(url);
            return played;
        }
        await this.#speakBrowser(text, language);
        return true;
    }

    #play(url) {
        return new Promise((resolve) => {
            const audio = new Audio(url);
            this.audio = audio;
            let analyser = null;
            if (this.ctx) {
                try {
                    const src = this.ctx.createMediaElementSource(audio);
                    analyser = this.ctx.createAnalyser();
                    analyser.fftSize = 512;
                    src.connect(analyser);
                    analyser.connect(this.ctx.destination);
                } catch { analyser = null; }
            }
            const buf = analyser ? new Uint8Array(analyser.fftSize) : null;
            const tick = () => {
                if (analyser) {
                    analyser.getByteTimeDomainData(buf);
                    let peak = 0;
                    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
                    this.onMouth(Math.min(1, peak / 70));
                } else {
                    this.onMouth(0.35 + 0.35 * Math.sin(performance.now() / 90));
                }
                this.raf = requestAnimationFrame(tick);
            };
            const end = (ok = true) => { cancelAnimationFrame(this.raf); this.onMouth(0); this.audio = null; resolve(ok); };
            audio.onended = () => end(true);
            audio.onerror = () => end(true);
            audio.play().then(() => { this.raf = requestAnimationFrame(tick); }).catch(() => end(false));
        });
    }

    #speakBrowser(text, language) {
        return new Promise((resolve) => {
            if (!window.speechSynthesis) { resolve(); return; }
            const u = new SpeechSynthesisUtterance(text);
            u.lang = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' }[language] || 'en-IN';
            const tick = () => { this.onMouth(0.3 + 0.3 * Math.abs(Math.sin(performance.now() / 85))); this.raf = requestAnimationFrame(tick); };
            u.onstart = () => { this.raf = requestAnimationFrame(tick); };
            u.onend = u.onerror = () => { cancelAnimationFrame(this.raf); this.onMouth(0); resolve(); };
            window.speechSynthesis.speak(u);
        });
    }

    stop() {
        cancelAnimationFrame(this.raf);
        if (this.audio) { this.audio.pause(); this.audio = null; }
        window.speechSynthesis?.cancel();
        this.onMouth(0);
    }

    destroy() {
        this.stopListening?.(false);
        this.stop();
        this.ctx?.close?.();
        this.ctx = null;
    }
}
