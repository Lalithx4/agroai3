/**
 * Voice Doctor brain: photo (+ what the farmer said) -> short, honest diagnosis the plant speaks.
 * Server-only. Uses Claude Haiku 4.5 on Bedrock via lib/bedrock.js.
 *
 * Design rules (from our own accuracy test: zero-shot Haiku was only ~25% on 20 tomato leaves):
 *  - closed list of diseases per crop, with "healthy", "other" and "unclear_photo" always allowed
 *  - the plant may say "I am not sure" (Confidence Guard)
 *  - the AI never invents a pesticide dose; it picks from ADVICE_OPTIONS
 */

import { askVision } from './bedrock.js';
import { CROPS, ADVICE_OPTIONS } from './crops.js';

const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', te: 'Telugu' };

// Spoken when the guard fires. Hindi and Telugu lines should be checked by a native speaker.
const NOT_SURE = {
  en: 'I am not completely sure. Please take another photo, or ask the agriculture officer.',
  hi: 'मुझे पूरा यकीन नहीं है। कृपया दूसरी तस्वीर लें या कृषि अधिकारी से पूछें।',
  te: 'నాకు పూర్తిగా నమ్మకం లేదు. దయచేసి మరో ఫోటో తీయండి లేదా వ్యవసాయ అధికారిని అడగండి.',
};
const EXPERT = {
  en: 'This looks serious. Please show me to the agriculture officer soon.',
  hi: 'यह गंभीर लग रहा है। कृपया जल्दी कृषि अधिकारी को दिखाएँ।',
  te: 'ఇది తీవ్రంగా కనిపిస్తోంది. దయచేసి త్వరగా వ్యవసాయ అధికారికి చూపించండి.',
};

const CONFIDENCE_MIN = 70;

function levelFromSeverity(pct, healthy) {
  if (healthy) return 0;
  if (pct < 2) return 1;
  if (pct < 8) return 1;
  if (pct < 20) return 2;
  if (pct < 40) return 3;
  return 4;
}

function buildPrompt({ crop, transcript, language }) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const c = crop && CROPS[crop];
  const ids = c ? ['healthy', ...Object.keys(c.diseases), 'other', 'unclear_photo'] : ['healthy', 'other', 'unclear_photo'];
  const cues = c
    ? Object.entries(c.diseases).map(([id, cue]) => `- ${id}: ${cue}`).join('\n')
    : '- (crop not given: identify the crop; if you cannot name the disease, use "other")';
  const said = transcript && transcript.trim() ? `The farmer said (extra context only, do not copy it): "${transcript.trim().slice(0, 400)}"` : 'The farmer said nothing.';

  return `You are a careful plant-health helper for small farmers in India. Look at the photo.
Crop: ${c ? c.name : 'not given'}.
Allowed diagnosis ids (choose exactly one): ${ids.join(', ')}.
Cues:
- healthy: uniform green, no spots, no dead tissue. MANY photos show healthy leaves; do not invent disease.
${cues}
- other: none of the above fits.
- unclear_photo: blurry, too dark, too far, or not a plant.
${said}

Allowed advice (pick ONE, translate it, never add doses or brand names):
${ADVICE_OPTIONS.map((a, i) => `${i + 1}. ${a}`).join('\n')}

First describe what you actually see, then decide. Return ONLY JSON:
{"observations": "one short sentence in English: lesion colour, shape, size, where",
 "crop": "crop name in English",
 "diagnosis": "one allowed id",
 "second_choice": "another allowed id, or null",
 "confidence": 0-100,
 "severity_percent": 0-100 (share of the leaf damaged; 0 if healthy),
 "sentences": [3 short sentences in ${langName}, spoken by the PLANT in the first person; sentence 1 says how I feel, sentence 2 says what is wrong in simple words (or that I am fine), sentence 3 gives the ONE advice; each under 18 words]}`;
}

function parseJson(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a === -1 || b <= a) throw new Error('Model did not return JSON');
  return JSON.parse(text.slice(a, b + 1));
}

/**
 * @param {{imageBase64: string, crop?: string, transcript?: string, language?: 'en'|'hi'|'te'}} input
 */
export async function diagnoseForVoice({ imageBase64, crop, transcript = '', language = 'en' }) {
  const lang = LANGUAGE_NAMES[language] ? language : 'en';
  const t0 = Date.now();
  // askVision parses JSON for us (it tolerates ``` fences) and handles resizing
  const j = await askVision(buildPrompt({ crop, transcript, language: lang }), imageBase64, 700);
  const ms = Date.now() - t0;

  const healthy = j.diagnosis === 'healthy';
  const unclear = j.diagnosis === 'unclear_photo';
  const confidence = Number.isFinite(+j.confidence) ? Math.max(0, Math.min(100, +j.confidence)) : 0;
  const sev = Number.isFinite(+j.severity_percent) ? Math.max(0, Math.min(100, +j.severity_percent)) : 0;
  let level = levelFromSeverity(sev, healthy);
  let sentences = (Array.isArray(j.sentences) ? j.sentences : []).map(String).filter(Boolean).slice(0, 3);

  // Confidence Guard: unclear photo, low confidence, "other", or a close second choice
  const uncertain = unclear || j.diagnosis === 'other' || confidence < CONFIDENCE_MIN || (!!j.second_choice && j.second_choice !== j.diagnosis && confidence < 85);
  if (uncertain) {
    if (sentences.length >= 3) sentences = sentences.slice(0, 2);
    sentences.push(NOT_SURE[lang]);
    if (unclear) level = 0;
  } else if (!healthy && level >= 3) {
    sentences = sentences.slice(0, 2);
    sentences.push(EXPERT[lang]);
  }
  if (!sentences.length) sentences = [NOT_SURE[lang]];

  return {
    crop: j.crop || (crop && CROPS[crop] ? CROPS[crop].name : null),
    diagnosis: j.diagnosis || 'other',
    second_choice: j.second_choice || null,
    confidence,
    severity_percent: sev,
    level,                       // 0 healthy .. 4 critical, drives the plant's mood and voice
    uncertain,
    observations: j.observations || '',
    sentences,
    language: lang,
    latency_ms: ms,
    reviewed_cues: !!(crop && CROPS[crop] && CROPS[crop].reviewed),
  };
}
