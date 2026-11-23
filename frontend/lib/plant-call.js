/**
 * "Your plant calls you back": a scheduled in-app call from a scanned plant.
 * Stored in localStorage so it survives page changes; IncomingCall rings it, the scanner answers it in AR.
 */

const KEY = 'cropmagix-plant-call';
export const CALL_EVENT = 'cropmagix:call-scheduled';

const OPENERS = {
    en: (p, issue) => `Hello, it's your ${p}. ${issue ? `Since this morning my leaves are bothering me, it looks like ${issue}. ` : 'I wanted to tell you how I am doing. '}Can you show me to the camera and talk to me?`,
    hi: (p, issue) => `नमस्ते, मैं आपका ${p} बोल रहा हूँ। ${issue ? `मेरे पत्तों में दिक्कत है, शायद ${issue} है। ` : 'बताना था कि मैं कैसा हूँ। '}मुझे कैमरे में दिखाइए और मुझसे बात कीजिए।`,
    te: (p, issue) => `నమస్తే, నేను మీ ${p}ని మాట్లాడుతున్నాను. ${issue ? `నా ఆకుల్లో ఇబ్బందిగా ఉంది, బహుశా ${issue}. ` : 'నేను ఎలా ఉన్నానో చెప్పాలనుకున్నాను. '}నన్ను కెమెరాలో చూపించి నాతో మాట్లాడండి.`,
};

/** Schedule a call from this plant in `delayMs`. */
export function scheduleCall({ plant, issue, healthStatus, language = 'en' }, delayMs = 30000) {
    const lang = OPENERS[language] ? language : 'en';
    const call = {
        id: Date.now(),
        at: Date.now() + delayMs,
        plant: plant || 'plant',
        issue: issue || null,
        healthStatus: healthStatus || 'mild',
        language: lang,
        say: OPENERS[lang](plant || 'plant', issue ? String(issue).toLowerCase() : null),
    };
    localStorage.setItem(KEY, JSON.stringify(call));
    window.dispatchEvent(new CustomEvent(CALL_EVENT));
    return call;
}

export function getCall() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function clearCall() {
    localStorage.removeItem(KEY);
}

/** Mark the call answered so the scanner picks it up and starts talking. */
export function answerCall(call) {
    localStorage.setItem(KEY, JSON.stringify({ ...call, answered: true }));
}

/** The answered call waiting for the scanner, or null. Read-only (safe to call twice); clear it with clearCall(). */
export function getAnsweredCall() {
    const c = getCall();
    return c?.answered ? c : null;
}
