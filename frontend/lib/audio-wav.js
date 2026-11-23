/**
 * Browser-only: convert a recorded clip (webm/opus on Android/desktop Chrome, mp4/aac on iPhone)
 * to 16 kHz mono WAV. Sarvam speech-to-text rejects webm, but always accepts WAV.
 * Falls back to the original blob if the browser cannot decode it.
 */
const TARGET_RATE = 16000;

export async function toWav(blob) {
    if (!blob || /wav/i.test(blob.type)) return blob;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC();
        const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
        ctx.close?.();

        // Resample to 16 kHz mono with an OfflineAudioContext.
        const length = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
        const offline = new OfflineAudioContext(1, length, TARGET_RATE);
        const src = offline.createBufferSource();
        src.buffer = decoded;
        src.connect(offline.destination);
        src.start();
        const rendered = await offline.startRendering();
        return encodeWav(rendered.getChannelData(0), TARGET_RATE);
    } catch {
        return blob;
    }
}

function encodeWav(samples, rate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const v = new DataView(buffer);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, samples.length * 2, true);
    let o = 44;
    for (let i = 0; i < samples.length; i++, o += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
}
