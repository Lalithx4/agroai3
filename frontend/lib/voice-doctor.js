/**
 * Voice Doctor brain: photo (+ what the farmer said) -> short, honest diagnosis the plant speaks.
 * Server-only. Claude on Amazon Bedrock via lib/bedrock.js.
 *
 * Works for ANY plant, in three modes (reported back as `mode`):
 *   examples : the crop has labelled example photos in reference-photos/<crop>/  -> most accurate
 *   cues     : crop is known (lib/crops.js) but has no example photos           -> medium
 *   open     : any other plant, the model names the plant and the problem        -> general guess, least reliable
 *
 * Two model calls, each doing what it is good at:
 *   1. DIAGNOSIS_MODEL (Sonnet 4.6 by default) looks at example photos + the farmer's photo and returns facts as short JSON.
 *   2. FAST_MODEL (Haiku 4.5) turns the facts into three short sentences in the farmer's language, spoken by the plant.
 *
 * Safety rules:
 *  - closed list of diagnoses whenever we have one, plus "healthy", "other" and "unclear_photo"
 *  - Confidence Guard: the plant says "I am not sure" when it should; thresholds are stricter for unverified modes
 *  - the AI never invents a pesticide dose; it picks one line from ADVICE_OPTIONS
 */

import { askVisionParts, DIAGNOSIS_MODEL, FAST_MODEL } from './bedrock.js';
import { CROPS, ADVICE_OPTIONS, cropLabel } from './crops.js';
import { loadReferences } from './reference-photos.js';

const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', te: 'Telugu' };

// Spoken when the guard fires. Hindi and Telugu lines should be checked by a native speaker.
const NOT_SURE = {
  en: "I can't tell for sure from this photo. Could you take one more, closer to my leaf, in daylight? Or show me to the agriculture officer.",
  hi: 'इस फोटो से मैं पक्का नहीं कह सकता। दिन की रोशनी में मेरे पत्ते की एक और फोटो पास से लो, या कृषि अधिकारी को दिखा दो।',
  te: 'ఈ ఫోటోతో నేను ఖచ్చితంగా చెప్పలేను. పగటి వెలుగులో నా ఆకును దగ్గరగా ఇంకో ఫోటో తీయండి, లేదా వ్యవసాయ అధికారికి చూపించండి.',
};
const EXPERT = {
  en: "This is serious, so please don't wait. Show me to the agriculture officer in the next day or two.",
  hi: 'ये गंभीर है, इंतज़ार मत करो। एक-दो दिन में मुझे कृषि अधिकारी को दिखा दो।',
  te: 'ఇది తీవ్రమైనది, ఆలస్యం చేయకండి. ఒకటి రెండు రోజుల్లో నన్ను వ్యవసాయ అధికారికి చూపించండి.',
};

// How each language should sound when spoken aloud by Sarvam Bulbul.
const VOICE_STYLE = {
  en: "simple spoken Indian English, with contractions (I'm, don't)",
  hi: 'everyday spoken Hindi as village farmers talk (not formal or Sanskritised), Devanagari script; common farm words like spray or fungicide may stay in English',
  te: 'everyday spoken Telugu as farmers in Telangana and Andhra talk (not bookish), Telugu script, respectful "meeru"; common farm words like spray or fungicide may stay in English',
};
const MOOD_WORDS = ['relaxed and happy', 'a little bothered', 'worried', 'in pain and worried', 'very weak and scared'];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

// Below these the plant hedges. Tune from measured data (see _bmad-output/experiments).
export const CONFIDENCE_MIN = { examples: parseInt(process.env.GUARD_EXAMPLES || '70', 10), cues: 80, open: 85 };

function levelFromSeverity(pct, healthy) {
  if (healthy) return 0;
  if (pct < 8) return 1;
  if (pct < 20) return 2;
  if (pct < 40) return 3;
  return 4;
}

// Crop words the farmer may say, or speech-to-text may return (English, Hindi, Telugu). Add more as needed.
const CROP_WORDS = {
  tomato: ['tomato', 'tomatoes', 'टमाटर', 'టమాటా', 'టొమాటో', 'టమోటా'],
  chilli: ['chilli', 'chili', 'chillies', 'mirchi', 'मिर्च', 'मिरची', 'మిరప', 'మిర్చి'],
  cotton: ['cotton', 'कपास', 'పత్తి'],
  paddy: ['paddy', 'rice', 'धान', 'चावल', 'వరి', 'వడ్లు'],
  potato: ['potato', 'potatoes', 'aloo', 'आलू', 'బంగాళాదుంప', 'ఆలుగడ్డ'],
  corn: ['corn', 'maize', 'makka', 'मक्का', 'మొక్కజొన్న'],
  grape: ['grape', 'grapes', 'angoor', 'अंगूर', 'ద్రాక్ష'],
  apple: ['apple', 'apples', 'seb', 'सेब', 'ఆపిల్'],
  pepper_bell: ['capsicum', 'bell pepper', 'shimla mirch', 'शिमला मिर्च', 'క్యాప్సికమ్'],
};

/** Plant identification from one leaf photo is unreliable (we measured it), so listen for the crop instead. */
export function cropFromText(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  // check longer, more specific phrases first ("shimla mirch" before "mirch")
  const entries = Object.entries(CROP_WORDS).flatMap(([crop, words]) => words.map((w) => [crop, w.toLowerCase()])).sort((a, b) => b[1].length - a[1].length);
  for (const [crop, w] of entries) if (t.includes(w)) return crop;
  return null;
}

function diagnosisPrompt({ mode, cropName, ids, cues, transcript }) {
  const said = transcript && transcript.trim()
    ? `The farmer said (extra context only): "${transcript.trim().slice(0, 400)}"`
    : 'The farmer said nothing.';
  const choice = mode === 'open'
    ? `diagnosis: one of healthy, disease, unclear_photo. If "disease", name it in disease_name (plain English, e.g. "powdery mildew", "iron deficiency"). If you cannot tell, use unclear_photo.`
    : `diagnosis: exactly one of ${ids.join(', ')}.`;
  return `You are a careful plant-health expert helping small farmers in India. The plant is ${cropName || 'unknown: name it'}.
${choice}
Many photos show HEALTHY plants; do not invent disease. Use unclear_photo when the photo is blurry, too dark, too far, or not a plant.
${cues ? 'Cues:\n' + cues + '\n' : ''}${said}

Advice choices (give the number of the ONE best): ${ADVICE_OPTIONS.map((a, i) => `${i + 1}=${a}`).join('; ')}

Reply ONLY JSON: {"plant_name": "common English name", "diagnosis": "...", "disease_name": "plain English name of the problem, or null", "second_choice": "another allowed id, or null", "confidence": 0-100, "severity_percent": 0-100 (share of the leaf damaged, 0 if healthy), "advice": 1-${ADVICE_OPTIONS.length}}`;
}

async function writeSentences({ facts, language, uncertain, transcript }) {
  const style = VOICE_STYLE[language] || VOICE_STYLE.en;
  const n = uncertain ? 2 : 3;
  const said = transcript && transcript.trim()
    ? `The farmer just told you: "${transcript.trim().slice(0, 300)}". Respond to what they said in your first sentence.`
    : 'The farmer only showed you the photo and said nothing.';
  const { json } = await askVisionParts({
    model: FAST_MODEL,
    maxTokens: 450,
    parts: [{
      text: `You are a ${facts.plant} plant talking out loud to the farmer who looks after you. A text-to-speech voice will say your words, so they must sound like a real person talking, not a report.
${said}
What is true: problem = ${facts.problem}; how bad = ${facts.level} of 4 (0 healthy, 4 critical); you feel ${MOOD_WORDS[facts.level] || MOOD_WORDS[2]}. ${uncertain ? 'You are NOT sure what it is, so say honestly that it might be this. ' : ''}What the farmer should do = "${facts.advice}".

Write ${n} short sentences, each under 16 words, in ${style}.
${uncertain ? 'Say how you feel or what you notice, then that it might be this problem.' : 'Say how you feel or what you notice, then what is wrong in plain words, then what they should do (the advice, in your own words).'}
Rules: first person ("my leaves", "I"), speak to them as "you"; everyday words and the common local name of the problem, not Latin; no brand names, no doses, no emoji, no exclamation marks, no "Hello farmer"; vary how sentences start. Warm and a little emotional, never cartoonish.
Reply ONLY JSON: {"sentences": [${n} strings]}`,
    }],
  });
  return (Array.isArray(json.sentences) ? json.sentences : [])
    .map((x) => String(x).replace(EMOJI, '').trim())
    .filter(Boolean)
    .slice(0, n);
}

/**
 * @param {{imageBase64: string, crop?: string, transcript?: string, language?: 'en'|'hi'|'te'}} input
 */
export async function diagnoseForVoice({ imageBase64, crop, transcript = '', language = 'en' }) {
  const lang = LANGUAGE_NAMES[language] ? language : 'en';
  const t0 = Date.now();

  // 1. which plant? The farmer's choice wins, then a crop word in what they said. Otherwise: open mode.
  const picked = crop && /^[a-z0-9_-]+$/i.test(crop) ? crop.toLowerCase() : null;
  const cropId = picked || cropFromText(transcript);

  // 2. what do we know about this crop?
  const refs = cropId ? await loadReferences(cropId) : null;
  const known = cropId ? CROPS[cropId] : null;
  const mode = refs && refs.length ? 'examples' : known ? 'cues' : 'open';
  const cropName = cropId ? cropLabel(cropId) : null;

  let ids = [];
  if (mode !== 'open') {
    const fromRefs = refs ? [...new Set(refs.map((r) => r.label))] : [];
    const fromCues = known ? Object.keys(known.diseases) : [];
    ids = [...new Set(['healthy', ...fromRefs, ...fromCues])];
    ids.push('other', 'unclear_photo');
  }
  const cues = known ? Object.entries(known.diseases).map(([id, cue]) => `- ${id}: ${cue}`).join('\n') : '';

  // 3. diagnosis: example photos first, then the farmer's photo
  const parts = [];
  if (mode === 'examples') {
    parts.push({ text: `Reference photos of ${cropName} leaves with their correct labels:` });
    refs.forEach((r) => { parts.push({ text: `Label: ${r.label}` }); parts.push({ imageBase64: r.imageBase64 }); });
    parts.push({ cache: true });
    parts.push({ text: "Now the farmer's photo to classify:" });
  }
  parts.push({ imageBase64 });
  parts.push({ text: diagnosisPrompt({ mode, cropName, ids, cues, transcript }) });
  const { json: j } = await askVisionParts({ model: DIAGNOSIS_MODEL, parts, maxTokens: 220 });

  // 4. Confidence Guard
  const healthy = j.diagnosis === 'healthy';
  const unclear = j.diagnosis === 'unclear_photo';
  const confidence = Number.isFinite(+j.confidence) ? Math.max(0, Math.min(100, +j.confidence)) : 0;
  const sev = Number.isFinite(+j.severity_percent) ? Math.max(0, Math.min(100, +j.severity_percent)) : 0;
  let level = levelFromSeverity(sev, healthy);
  const closeSecond = mode !== 'open' && !!j.second_choice && j.second_choice !== j.diagnosis && confidence < 85;
  const uncertain = unclear || j.diagnosis === 'other' || confidence < CONFIDENCE_MIN[mode] || closeSecond;
  if (unclear) level = 0;

  // 5. the plant's words (Haiku), then the fixed safety lines
  const adviceIdx = Math.max(1, Math.min(ADVICE_OPTIONS.length, parseInt(j.advice, 10) || 1));
  const problem = healthy ? 'none, the plant looks healthy' : (j.disease_name || String(j.diagnosis || 'unknown').replace(/_/g, ' '));
  let sentences = [];
  try {
    sentences = await writeSentences({
      facts: { plant: j.plant_name || cropName || 'plant', problem, level, advice: unclear ? ADVICE_OPTIONS[4] : ADVICE_OPTIONS[adviceIdx - 1] },
      language: lang, uncertain, transcript,
    });
  } catch (e) {
    console.error('sentence writer failed:', e.message);
  }
  if (uncertain) { sentences = sentences.slice(0, 2); sentences.push(NOT_SURE[lang]); }
  else if (!healthy && level >= 3) { sentences = sentences.slice(0, 2); sentences.push(EXPERT[lang]); }
  if (!sentences.length) sentences = [NOT_SURE[lang]];

  return {
    crop: cropId || null,
    plant_name: j.plant_name || cropName || null,
    diagnosis: j.diagnosis || 'other',
    disease_name: j.disease_name || null,
    second_choice: j.second_choice || null,
    confidence,
    severity_percent: sev,
    level,                        // 0 healthy .. 4 critical: drives the plant's mood and voice
    uncertain,
    mode,                         // examples | cues | open
    verified: mode === 'examples',
    sentences,
    language: lang,
    latency_ms: Date.now() - t0,
    model: DIAGNOSIS_MODEL,
  };
}
