/**
 * Sarvam AI client: Saaras (speech to text) and Bulbul (text to speech). Server-only.
 * Docs: https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe
 *       https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert
 *
 * Needs SARVAM_API_KEY in the environment (frontend/.env.local and Vercel). Never NEXT_PUBLIC_.
 * NOTE: written from the docs; not yet run against the live API (no key at the time of writing).
 */

const BASE = 'https://api.sarvam.ai';
const STT_MODEL = process.env.SARVAM_STT_MODEL || 'saaras:v4';
const TTS_MODEL = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';

export class SarvamNotConfigured extends Error {
  constructor() { super('SARVAM_API_KEY is not set'); this.name = 'SarvamNotConfigured'; }
}

function key() {
  const k = process.env.SARVAM_API_KEY;
  if (!k) throw new SarvamNotConfigured();
  return k;
}

export function isSarvamConfigured() { return !!process.env.SARVAM_API_KEY; }

// BCP-47 codes used by Sarvam <-> our short language codes
const TO_BCP = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };
export function fromBcp(code) {
  if (!code) return null;
  const p = String(code).slice(0, 2).toLowerCase();
  return p === 'en' || p === 'hi' || p === 'te' ? p : null;
}

// bulbul:v3 speaker names (see the speaker list in the docs). Check by ear and change if you prefer another.
const SPEAKERS = { en: 'ritu', hi: 'priya', te: 'kavitha' };

/** Words that help Saaras recognise farm vocabulary (max 50, each up to 64 chars). */
export const KEYTERMS = [
  'tomato', 'chilli', 'cotton', 'paddy', 'blight', 'leaf curl', 'leaf spot', 'mildew', 'blast', 'neem oil', 'fungicide', 'pesticide',
  'aphids', 'thrips', 'whitefly', 'mosaic', 'wilt', 'yellow leaves', 'brown spots',
];

/**
 * @param {Blob} audio  recorded clip (webm/ogg/wav/mp3...), under about 30 seconds
 * @returns {Promise<{transcript: string, language: string|null, languageCode: string|null}>}
 */
export async function transcribe(audio, { language } = {}) {
  const form = new FormData();
  form.append('file', audio, audio.name || 'speech.webm');
  form.append('model', STT_MODEL);
  form.append('mode', 'codemix');                       // Indic words in native script, English words in English
  form.append('language_code', language && TO_BCP[language] ? TO_BCP[language] : 'unknown');
  form.append('keyterms', JSON.stringify(KEYTERMS));
  const res = await fetch(`${BASE}/speech-to-text`, { method: 'POST', headers: { 'api-subscription-key': key() }, body: form });
  if (!res.ok) throw new Error(`Sarvam speech-to-text failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return { transcript: j.transcript || '', language: fromBcp(j.language_code), languageCode: j.language_code || null };
}

/**
 * @returns {Promise<Buffer>} mp3 audio
 */
export async function speak(text, { language = 'en', pace = 1, pitch = 0 } = {}) {
  const body = {
    text: String(text).slice(0, 2400),
    language_code: TO_BCP[language] || 'en-IN',
    speaker: SPEAKERS[language] || SPEAKERS.en,
    model: TTS_MODEL,
    pace: Math.max(0.5, Math.min(2, pace)),
    pitch: Math.max(-0.5, Math.min(0.5, pitch)),
    output_audio_codec: 'mp3',
    speech_sample_rate: 24000,
  };
  const res = await fetch(`${BASE}/text-to-speech`, {
    method: 'POST',
    headers: { 'api-subscription-key': key(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Sarvam text-to-speech failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  if (!j.audios || !j.audios[0]) throw new Error('Sarvam returned no audio');
  return Buffer.from(j.audios[0], 'base64');
}

/** Same mood table as the talking-plant demo: health level 0..4 -> Bulbul pace and pitch. */
export const MOOD = [
  { pace: 1.10, pitch: 0.10 },
  { pace: 1.05, pitch: 0.05 },
  { pace: 1.00, pitch: 0.00 },
  { pace: 0.90, pitch: -0.15 },
  { pace: 0.80, pitch: -0.25 },
];
