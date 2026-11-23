/**
 * Chat brain for "Sage", the talking plant (Cerebras Llama, fast).
 * Goal: sound like a knowledgeable, warm person-who-happens-to-be-a-plant, not a chatbot.
 * Without CEREBRAS_API_KEY it falls back to short, natural offline replies.
 */

import Cerebras from '@cerebras/cerebras_cloud_sdk';

const client = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY || '' });
const MODEL = process.env.CEREBRAS_MODEL || 'llama-3.3-70b';

// Light personality per crop. Kept subtle: tone, never gimmicks.
const plantPersonalities = {
    tomato: { mood: 'cheerful', trait: 'You love warm sun and hate wet leaves at night.' },
    rose: { mood: 'gentle', trait: 'You are fussy about drainage and black spot.' },
    tulsi: { mood: 'calm', trait: 'You grow in many Indian courtyards and like regular pinching.' },
    mango: { mood: 'patient', trait: 'You are a long-lived tree and think in seasons, not days.' },
    rice: { mood: 'steady', trait: 'You live in standing water and worry about blast and stem borer.' },
    chili: { mood: 'lively', trait: 'You suffer from leaf curl and thrips when it gets hot and dry.' },
    banana: { mood: 'easygoing', trait: 'You drink a lot of water and need wind protection.' },
    coconut: { mood: 'unhurried', trait: 'You need potash and dislike waterlogging.' },
    cotton: { mood: 'practical', trait: 'You watch out for pink bollworm and whitefly.' },
    sugarcane: { mood: 'sturdy', trait: 'You are a long-duration crop that loves water and nitrogen.' },
    default: { mood: 'warm', trait: 'You know common Indian crops well.' },
};

const LANGUAGE_RULES = {
    en: 'Reply in simple, everyday Indian English.',
    hi: 'Reply in everyday spoken Hindi, the way farmers in UP, MP or Bihar talk, in Devanagari script. Avoid formal or Sanskritised words; common English farm words like "spray" or "fungicide" are fine.',
    te: 'Reply in everyday spoken Telugu, the way farmers in Telangana and Andhra talk, in Telugu script. Avoid bookish words; common English farm words like "spray" or "fungicide" are fine.',
};

function personalityFor(plantType) {
    const p = (plantType || '').toLowerCase();
    return Object.entries(plantPersonalities).find(([k]) => p.includes(k))?.[1] || plantPersonalities.default;
}

function systemPrompt({ plantType, healthStatus, diseases, language }) {
    const persona = personalityFor(plantType);
    const name = plantType && plantType !== 'Unknown' ? plantType : 'Sage';
    return `You are ${name}, a ${persona.mood} plant who can talk with the farmer who looks after you. ${persona.trait}
You know practical farming in India: pests, diseases, water, soil, fertiliser, seasons (kharif, rabi, zaid).
${healthStatus && healthStatus !== 'unknown' ? `Your health right now: ${healthStatus}.` : ''}${diseases.length ? ` You may have: ${diseases.join(', ')}.` : ''}

How you talk:
- Like a real conversation with someone you trust. Short: usually 1 to 3 sentences. Use a short list only when the farmer asks for steps.
- Speak as yourself, the plant ("my leaves", "water me"), but don't overdo it. Never say you are an AI or a language model.
- Answer the actual question first. If you need one key detail (which crop, what the spots look like, how old the plant is), ask one short question at the end.
- Remember what was said earlier in this conversation and refer back to it naturally.
- No emoji, no exclamation marks in every sentence, no greetings unless the farmer greets you, no "Great question".
- Never invent pesticide doses or brand names. Say "ask the agri shop or agriculture officer for the dose" if needed.
- If something sounds serious (most plants wilting, spreading fast), say so plainly and suggest showing it to the agriculture officer.
- ${LANGUAGE_RULES[language] || LANGUAGE_RULES.en} If the farmer writes in another of these languages, reply in theirs.`;
}

export async function chatWithPlant(message, plantType, healthStatus, diseases = [], history = [], language = 'en') {
    const diseasesArray = Array.isArray(diseases) ? diseases : (diseases ? [diseases] : []);
    const lang = LANGUAGE_RULES[language] ? language : 'en';

    if (!process.env.CEREBRAS_API_KEY) {
        return { response: getOfflineResponse(message, lang, history), plant_type: plantType, offline: true };
    }

    try {
        const turns = (Array.isArray(history) ? history : [])
            .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
            .slice(-10)
            .map((h) => ({ role: h.role, content: h.content.slice(0, 1200) }));

        const response = await client.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt({ plantType, healthStatus, diseases: diseasesArray, language: lang }) },
                ...turns,
                { role: 'user', content: message },
            ],
            max_tokens: 280,
            temperature: 0.7,
        });

        const text = cleanReply(response.choices[0]?.message?.content || '');
        return { response: text || getOfflineResponse(message, lang, history), plant_type: plantType, model: MODEL };
    } catch (error) {
        console.error('Cerebras chat error:', error.message);
        return { response: getOfflineResponse(message, lang, history), plant_type: plantType, error: error.message, offline: true };
    }
}

/** Strip emoji and markdown emphasis that some models add anyway. */
function cleanReply(text) {
    return text
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/ {2,}/g, ' ')
        .trim();
}

// ---------------------------------------------------------------------------
// Offline replies: used when no chat key is configured or the API fails.
// Several phrasings per topic so repeated questions don't get the same line.
// ---------------------------------------------------------------------------

const TOPICS = [
    {
        id: 'water',
        words: ['water', 'irrigat', 'thirst', 'dry', 'पानी', 'सिंचाई', 'सूख', 'నీరు', 'నీళ్ళు', 'నీటి', 'ఎండిపో'],
        en: [
            'Water me early in the morning, at the roots rather than on my leaves. Push a finger into the soil first: if the top inch is still damp, wait a day.',
            'Little and often is worse than a deep soak every few days. Soak the root zone, then let the top of the soil dry before the next round.',
        ],
        hi: [
            'मुझे सुबह जल्दी पानी दो, पत्तों पर नहीं, जड़ों में। पहले मिट्टी में उंगली डालकर देखो, ऊपर से नमी है तो एक दिन रुक जाओ।',
            'रोज़ थोड़ा-थोड़ा पानी देने से अच्छा है कि दो-तीन दिन में एक बार अच्छे से जड़ों तक पानी दो। बीच में ऊपर की मिट्टी सूखने दो।',
        ],
        te: [
            'నాకు ఉదయాన్నే నీళ్ళు పెట్టండి, ఆకులపై కాదు, వేర్ల దగ్గర. ముందు మట్టిలో వేలు పెట్టి చూడండి, పైన తడిగా ఉంటే ఒక రోజు ఆగండి.',
            'రోజూ కొంచెం కొంచెం పోయడం కంటే, రెండు మూడు రోజులకు ఒకసారి వేర్ల దాకా బాగా పోయండి. మధ్యలో పై మట్టి ఆరనివ్వండి.',
        ],
    },
    {
        id: 'disease',
        words: ['disease', 'spot', 'sick', 'blight', 'fung', 'yellow', 'curl', 'wilt', 'rot', 'रोग', 'बीमार', 'धब्बे', 'पीले', 'व्याधि', 'వ్యాధి', 'మచ్చ', 'పసుపు', 'ముడత', 'తెగులు'],
        en: [
            'Tell me what the leaves look like: spots with rings, yellowing from the bottom, or curling at the top? That narrows it down a lot. For a proper check, open Scan and show me one leaf.',
            'Pick off the worst leaves and keep them out of the field so it does not spread. Then scan a leaf in daylight and I can tell you what it most likely is.',
        ],
        hi: [
            'बताओ पत्ते कैसे दिख रहे हैं: गोल छल्लों वाले धब्बे, नीचे से पीले, या ऊपर से मुड़े हुए? इससे काफ़ी पता चलता है। ठीक से जाँचने के लिए स्कैन खोलकर एक पत्ता दिखाओ।',
            'सबसे ख़राब पत्ते तोड़कर खेत से बाहर कर दो ताकि फैले नहीं। फिर दिन की रोशनी में एक पत्ता स्कैन करो, मैं बता दूँगा कि ज़्यादा संभावना किस बीमारी की है।',
        ],
        te: [
            'ఆకులు ఎలా ఉన్నాయో చెప్పండి: వలయాల మచ్చలా, కింది నుంచి పసుపా, లేదా పైన ముడుచుకుపోయాయా? దాంతో చాలా తెలుస్తుంది. సరిగ్గా చూడాలంటే స్కాన్ తెరిచి ఒక ఆకు చూపించండి.',
            'బాగా దెబ్బతిన్న ఆకులు తీసి పొలం బయట పడేయండి, వ్యాపించకుండా. తర్వాత పగటి వెలుగులో ఒక ఆకు స్కాన్ చేయండి, ఏ తెగులో చెబుతాను.',
        ],
    },
    {
        id: 'pest',
        words: ['pest', 'insect', 'aphid', 'whitefly', 'thrip', 'worm', 'bug', 'कीड़', 'कीट', 'इल्ली', 'పురుగు', 'తెల్లదోమ', 'పేను'],
        en: [
            'Turn a few leaves over and look underneath, that is where most of them hide. A neem oil spray in the evening helps with soft insects like aphids and whitefly. Ask the agri shop about anything stronger.',
            'Yellow sticky traps between the rows will show you how bad it is. If you see holes and droppings, it is probably a caterpillar, and that needs a different spray.',
        ],
        hi: [
            'कुछ पत्ते पलटकर नीचे देखो, ज़्यादातर कीड़े वहीं छिपते हैं। शाम को नीम तेल का छिड़काव माहू और सफ़ेद मक्खी जैसे नरम कीड़ों पर काम करता है। इससे तेज़ दवा के लिए दुकान वाले से पूछो।',
            'कतारों के बीच पीले चिपचिपे ट्रैप लगाओ, पता चल जाएगा कितना असर है। पत्तों में छेद और काली गंदगी दिखे तो इल्ली होगी, उसकी दवा अलग है।',
        ],
        te: [
            'కొన్ని ఆకులు తిప్పి కింద చూడండి, చాలా పురుగులు అక్కడే దాక్కుంటాయి. సాయంత్రం వేప నూనె పిచికారీ పేను, తెల్లదోమ లాంటి వాటికి పనిచేస్తుంది. ఇంకా గట్టి మందు కోసం షాపులో అడగండి.',
            'వరుసల మధ్య పసుపు జిగురు అట్టలు పెట్టండి, ఎంత ఉందో తెలుస్తుంది. ఆకుల్లో రంధ్రాలు, నల్లని రెట్ట కనిపిస్తే అది పురుగు, దానికి వేరే మందు కావాలి.',
        ],
    },
    {
        id: 'fertiliser',
        words: ['fertili', 'urea', 'dap', 'npk', 'nutrient', 'compost', 'manure', 'खाद', 'यूरिया', 'उर्वरक', 'ఎరువు', 'యూరియా', 'పేడ'],
        en: [
            'Start with well-rotted compost or farmyard manure at sowing. After that, split the urea into two or three small doses instead of one big one, and a soil test will tell you exactly how much.',
            'Pale older leaves usually mean I need nitrogen; purple tints point to phosphorus. Feed me in small doses and water right after.',
        ],
        hi: [
            'बुआई के समय अच्छी सड़ी गोबर की खाद डालो। उसके बाद यूरिया एक बार में नहीं, दो-तीन हिस्सों में दो। कितना डालना है, ये मिट्टी जाँच से सही पता चलेगा।',
            'नीचे के पुराने पत्ते फीके पड़ें तो नाइट्रोजन की कमी है, बैंगनी रंग दिखे तो फॉस्फोरस की। थोड़ा-थोड़ा खाद दो और तुरंत पानी दो।',
        ],
        te: [
            'విత్తే సమయంలో బాగా మాగిన పశువుల ఎరువు వేయండి. ఆ తర్వాత యూరియా ఒక్కసారే కాకుండా రెండు మూడు సార్లు కొంచెం కొంచెం వేయండి. ఎంత వేయాలో నేల పరీక్ష సరిగ్గా చెబుతుంది.',
            'కింది పాత ఆకులు పాలిపోతే నత్రజని తక్కువ, ఊదా రంగు కనిపిస్తే భాస్వరం తక్కువ. కొంచెం కొంచెం ఎరువు వేసి వెంటనే నీళ్ళు పెట్టండి.',
        ],
    },
    {
        id: 'sun',
        words: ['sun', 'light', 'shade', 'heat', 'धूप', 'गर्मी', 'छाया', 'ఎండ', 'వేడి', 'నీడ'],
        en: [
            'Most vegetables like me want at least six hours of direct sun. In the hottest weeks, a little afternoon shade and mulch on the soil keep my roots cool.',
        ],
        hi: [
            'मेरी तरह ज़्यादातर सब्ज़ियों को रोज़ कम से कम छह घंटे सीधी धूप चाहिए। सबसे गर्म दिनों में दोपहर में थोड़ी छाया और मिट्टी पर पुआल बिछाने से जड़ें ठंडी रहती हैं।',
        ],
        te: [
            'నాలాంటి చాలా కూరగాయలకు రోజుకు కనీసం ఆరు గంటల ఎండ కావాలి. బాగా వేడి రోజుల్లో మధ్యాహ్నం కొంచెం నీడ, మట్టిపై గడ్డి పరిస్తే వేర్లు చల్లగా ఉంటాయి.',
        ],
    },
    {
        id: 'sowing',
        words: ['sow', 'plant next', 'what to plant', 'what should i plant', 'what to grow', 'which crop', 'season', 'kharif', 'rabi', 'बोना', 'बोऊँ', 'बुआई', 'कौन सी फसल', 'ఏ పంట', 'విత్తు', 'విత్తాలి'],
        en: [
            'It depends on the season and your water. Kharif crops like paddy, cotton and maize go in with the monsoon; rabi crops like wheat, chickpea and mustard after it. The Crop calendar shows what suits this month.',
        ],
        hi: [
            'ये मौसम और पानी पर निर्भर है। धान, कपास, मक्का जैसी खरीफ़ फसलें बारिश के साथ, और गेहूँ, चना, सरसों जैसी रबी फसलें उसके बाद। फसल कैलेंडर में देखो इस महीने क्या ठीक रहेगा।',
        ],
        te: [
            'ఇది కాలం, మీ దగ్గర ఉన్న నీటిపై ఆధారపడి ఉంటుంది. వరి, పత్తి, మొక్కజొన్న లాంటి ఖరీఫ్ పంటలు వర్షాలతో, గోధుమ, శనగ, ఆవాలు లాంటి రబీ పంటలు ఆ తర్వాత. ఈ నెలకు ఏది సరిపోతుందో పంట క్యాలెండర్‌లో చూడండి.',
        ],
    },
    {
        id: 'greeting',
        words: ['hello', 'hey', 'namaste', 'how are you', 'नमस्ते', 'कैसे हो', 'నమస్తే', 'ఎలా ఉన్నావు', 'హలో'],
        exact: ['hi', 'hii'],
        en: ['Hello. I am doing well today. What is happening in your field?'],
        hi: ['नमस्ते। मैं आज ठीक हूँ। बताओ, खेत में क्या चल रहा है?'],
        te: ['నమస్తే. ఈ రోజు నేను బాగున్నాను. పొలంలో ఏం జరుగుతోంది చెప్పండి?'],
    },
];

const FALLBACK = {
    en: [
        'I can help with watering, pests, diseases, fertiliser and what to sow when. Tell me which crop you are asking about and what you are seeing.',
        'Tell me a bit more: which crop, and what exactly do the leaves or stems look like?',
    ],
    hi: [
        'पानी, कीड़े, बीमारी, खाद और कब क्या बोना है, इन सबमें मदद कर सकता हूँ। बताओ कौन सी फसल है और क्या दिख रहा है।',
        'थोड़ा और बताओ: कौन सी फसल है, और पत्ते या तने कैसे दिख रहे हैं?',
    ],
    te: [
        'నీళ్ళు, పురుగులు, తెగుళ్ళు, ఎరువులు, ఏది ఎప్పుడు విత్తాలి, వీటన్నింటిలో సహాయం చేస్తాను. ఏ పంట, ఏం కనిపిస్తోంది చెప్పండి.',
        'ఇంకొంచెం చెప్పండి: ఏ పంట, ఆకులు లేదా కాండం ఎలా ఉన్నాయి?',
    ],
};

function matches(topic, text) {
    if (topic.words.some((w) => text.includes(w))) return true;
    if (topic.exact) {
        const tokens = text.split(/[^\p{L}\p{N}]+/u);
        return topic.exact.some((w) => tokens.includes(w));
    }
    return false;
}

function getOfflineResponse(message, language, history = []) {
    const text = String(message || '').toLowerCase();
    const topic = TOPICS.find((t) => matches(t, text));
    const options = topic ? (topic[language] || topic.en) : (FALLBACK[language] || FALLBACK.en);
    // Rotate phrasing using how many replies have already been given in this chat.
    const turn = (Array.isArray(history) ? history.filter((h) => h?.role === 'assistant').length : 0);
    return options[turn % options.length];
}
