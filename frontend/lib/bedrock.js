/**
 * Vision AI Service for Plant & Soil Analysis
 * Uses Claude Haiku 4.5 on Amazon Bedrock (Converse API).
 *
 * Server-only. Credentials come from the environment, never from code:
 *   AWS_REGION                 e.g. ap-south-1 / us-east-1
 *   AWS_BEARER_TOKEN_BEDROCK   Bedrock API key  (or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
 *   BEDROCK_MODEL_ID           optional, defaults to the global Haiku 4.5 inference profile
 */

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-haiku-4-5-20251001-v1:0';
const MAX_IMAGE_BYTES = 3.75 * 1024 * 1024; // Bedrock per-image limit
const MAX_EDGE_PX = 1568; // Claude's recommended long edge; larger only adds latency and cost

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

function stripDataUrl(imageBase64) {
    return imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
}

function detectFormat(buf) {
    if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
    if (buf[0] === 0x47 && buf[1] === 0x49) return 'gif';
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
    return 'jpeg';
}

/** Downscale big phone photos so they fit Bedrock's limit and respond faster. */
async function prepareImage(imageBase64) {
    let bytes = Buffer.from(stripDataUrl(imageBase64), 'base64');
    let format = detectFormat(bytes);
    try {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(bytes).metadata();
        if (bytes.length > MAX_IMAGE_BYTES || Math.max(meta.width || 0, meta.height || 0) > MAX_EDGE_PX) {
            bytes = await sharp(bytes).rotate()
                .resize(MAX_EDGE_PX, MAX_EDGE_PX, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 }).toBuffer();
            format = 'jpeg';
        }
    } catch {
        // sharp unavailable: send as-is if it fits
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
        throw new Error('Image is too large. Please use a photo under 3.7 MB.');
    }
    return { bytes, format };
}

/** Pull the JSON object out of the model reply, tolerating ``` fences or stray text. */
function parseJson(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('Model did not return JSON');
    return JSON.parse(text.slice(start, end + 1));
}

/** Send one image + prompt to Claude Haiku 4.5 and return the parsed JSON reply. */
export async function askVision(prompt, imageBase64, maxTokens = 4096) {
    const { bytes, format } = await prepareImage(imageBase64);
    const response = await client.send(new ConverseCommand({
        modelId: MODEL_ID,
        messages: [{
            role: 'user',
            content: [
                { image: { format, source: { bytes } } },
                { text: prompt },
            ],
        }],
        inferenceConfig: { maxTokens, temperature: 0.2 },
    }));
    const text = (response.output?.message?.content || []).map((c) => c.text || '').join('');
    if (response.stopReason === 'max_tokens') {
        console.warn('Bedrock reply hit maxTokens; JSON may be truncated');
    }
    return parseJson(text);
}

// Models. Haiku 4.5 stays the fast/cheap default; the Voice Doctor diagnosis uses a stronger model.
// Change either in .env.local. (Sonnet 4.6 scored best in our tomato test; Sonnet 5.5 needs access in the Bedrock console.)
export const FAST_MODEL = MODEL_ID;
export const DIAGNOSIS_MODEL = process.env.BEDROCK_DIAGNOSIS_MODEL || 'global.anthropic.claude-sonnet-4-6';
const noTemperature = new Set(); // models that reject the temperature setting

/**
 * Send a mixed list of text and image parts to any Bedrock Claude model and return the parsed JSON reply.
 * @param {{model?: string, parts: Array<{text: string} | {imageBase64: string}>, maxTokens?: number}} opts
 */
export async function askVisionParts({ model = MODEL_ID, parts, maxTokens = 700 }) {
    const content = [];
    for (const p of parts) {
        if (p.cache) { content.push({ cachePoint: { type: 'default' } }); continue; }   // everything before this is cached (5 min), so repeat scans are faster and cheaper
        if (p.text !== undefined) { content.push({ text: p.text }); continue; }
        const { bytes, format } = await prepareImage(p.imageBase64);
        content.push({ image: { format, source: { bytes } } });
    }
    const send = (withTemp) => client.send(new ConverseCommand({
        modelId: model,
        messages: [{ role: 'user', content }],
        inferenceConfig: withTemp ? { maxTokens, temperature: 0 } : { maxTokens },
    }));
    let response;
    try {
        response = await send(!noTemperature.has(model));
    } catch (e) {
        if (/temperature/i.test(e.message) && !noTemperature.has(model)) { noTemperature.add(model); response = await send(false); }
        else throw e;
    }
    const text = (response.output?.message?.content || []).map((c) => c.text || '').join('');
    return { json: parseJson(text), usage: response.usage || {} };
}

/**
 * Multi-turn conversation (system + alternating user/assistant turns) on the fast model.
 * @param {{role: 'system'|'user'|'assistant', content: string}[]} messages
 */
export async function converse(messages, { maxTokens = 300, temperature = 0.7 } = {}) {
    const system = messages.filter((m) => m.role === 'system').map((m) => ({ text: m.content }));
    // Bedrock needs strictly alternating turns starting with the user: merge neighbours, drop a leading assistant turn.
    const turns = [];
    for (const m of messages.filter((x) => x.role !== 'system' && x.content)) {
        const last = turns[turns.length - 1];
        if (last && last.role === m.role) last.content[0].text += `\n${m.content}`;
        else turns.push({ role: m.role, content: [{ text: m.content }] });
    }
    while (turns.length && turns[0].role !== 'user') turns.shift();
    const response = await client.send(new ConverseCommand({
        modelId: MODEL_ID,
        system,
        messages: turns,
        inferenceConfig: { maxTokens, temperature },
    }));
    return (response.output?.message?.content || []).map((c) => c.text || '').join('').trim();
}

/** Text-only call, used for the fallback chat helper. */
export async function askText(prompt, maxTokens = 512) {
    const response = await client.send(new ConverseCommand({
        modelId: MODEL_ID,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens, temperature: 0.5 },
    }));
    return (response.output?.message?.content || []).map((c) => c.text || '').join('').trim();
}

/**
 * Naming the plant is its own step, on the stronger model. Doing it inside the long report on Haiku
 * mixed up look-alikes (money plant came back as other names) and used Western names.
 */
export const ID_MODEL = process.env.BEDROCK_ID_MODEL || DIAGNOSIS_MODEL;
const LOCAL_NAME = {
    hi: 'the common Hindi name in Devanagari script',
    te: 'the common Telugu name in Telugu script',
};

const ID_PROMPT = (language) => `You are a field botanist who knows Indian farms, kitchen gardens and homes. Name the main plant in this photo.

Look first, then name. In "observations", note what you can actually see: leaf shape, base and tip, edge (smooth, toothed, lobed), veins, surface (glossy, matte, hairy), colour and any variegation pattern, how leaves sit on the stem, growth habit (vine, herb, shrub, tree, grass), flowers or fruit, and the setting (pot, field, hanging, wall).

Rules:
- The farmers are in India. Use the name people use in India, in English. "Money plant" in India means Epipremnum aureum (pothos). Call Crassula ovata "Jade plant" and Pilea peperomioides "Chinese money plant".
- Separate look-alikes by the feature that tells them apart, for example:
  - Money plant (Epipremnum aureum): glossy, slightly waxy heart-shaped leaves with yellow or cream streaks or plain green, a groove along the leaf stalk, climbing or trailing.
  - Satin pothos (Scindapsus pictus): matte, thick, dark green leaves with silvery spots or patches.
  - Heartleaf philodendron (Philodendron hederaceum): thin, soft, more evenly heart-shaped leaves, no groove on the leaf stalk.
  - Arrowhead plant (Syngonium podophyllum): arrow-shaped leaves, often with pale veins.
  - Tulsi (Ocimum tenuiflorum): small, slightly hairy, softly toothed leaves, often purple stems. Sweet basil (Ocimum basilicum): bigger, smooth, glossy leaves.
  - Curry leaf (Murraya koenigii): small, smooth-edged leaflets on a long stalk. Neem (Azadirachta indica): curved, sharply toothed leaflets.
  - Tomato: hairy, deeply cut, toothed leaflets. Potato: broader, smoother leaflets. Brinjal: large, soft, wavy-edged leaves, sometimes spiny.
  - Chilli: narrow, smooth, pointed leaves. Bhindi (okra) and cotton: both palm-shaped lobed leaves; bhindi has pods, cotton has bolls.
  - Paddy, wheat, maize, jowar and sugarcane: check leaf width, the midrib and the stem.
  These pairs only show how to tell look-alikes apart. They are NOT likely answers: most photos are none of them, so name only what the features show.
- Never guess a farm crop just because this is a farming app. Houseplants, weeds, trees and garden plants are common too.
- confidence is your honest chance (0-100) that plant_name is right. A blurry, far away, dark or partial view must lower it. Above 85 only when the key features are clearly visible.
- A single detached leaf or a close-up of part of a leaf, with no stem, flowers, fruit or growth habit in view, is hard to name: keep confidence at 65 or below unless the leaf is unmistakable, and give the closest look-alikes as alternatives.
- If no plant is clearly in view, set identified to false.

Reply ONLY with this JSON:
{
  "observations": "one or two sentences of what you see",
  "identified": true | false,
  "plant_name": "common name used in India, in English",
  "local_name": ${LOCAL_NAME[language] ? `"${LOCAL_NAME[language]}, or null if there is none"` : 'null'},
  "scientific_name": "Genus species",
  "family": "plant family",
  "category": "vegetable|fruit|grain|pulse|oilseed|fibre|spice|herb|flower|tree|houseplant|weed|other",
  "confidence": 0-100,
  "alternatives": [{"plant_name": "...", "scientific_name": "...", "confidence": 0-100, "how_to_tell": "the feature that would confirm it, under 12 words"}],
  "hint": "if confidence is under 70 or nothing is identified: what photo would settle it, under 12 words (e.g. 'Show one full leaf and its stalk'), else null"
}
Give at most 2 alternatives, only plants that genuinely look similar. No emoji.`;

const genus = (s) => (typeof s === 'string' ? s.trim().split(/\s+/)[0].toLowerCase() : '');
/** Two scientific names refer to the same kind of plant when the genus matches. */
export const sameGenus = (a, b) => !!genus(a) && genus(a) === genus(b);
const pct = (n) => Math.round(Math.max(0, Math.min(100, Number(n) || 0)));

/**
 * Identify the plant on the stronger model (falls back to the fast one if it is not available).
 * @returns {Promise<{identified: boolean, plant_name: string|null, local_name: string|null, display_name: string|null,
 *   scientific_name: string|null, family: string|null, category: string|null, confidence: number,
 *   alternatives: Array<{plant_name: string, scientific_name: string|null, confidence: number, how_to_tell: string|null}>,
 *   observations: string|null, hint: string|null, model: string}>}
 */
export async function identifyPlant(imageBase64, language = 'en') {
    const lang = LOCAL_NAME[language] ? language : 'en';
    const parts = [{ imageBase64 }, { text: ID_PROMPT(lang) }];
    let json;
    let model = ID_MODEL;
    try {
        ({ json } = await askVisionParts({ model, parts, maxTokens: 700 }));
    } catch (e) {
        if (model === FAST_MODEL) throw e;
        console.warn(`identifyPlant: ${model} failed (${e.message}); falling back to ${FAST_MODEL}`);
        model = FAST_MODEL;
        ({ json } = await askVisionParts({ model, parts, maxTokens: 700 }));
    }
    const plantName = clean(json.plant_name) || null;
    const localName = lang === 'en' ? null : clean(json.local_name) || null;
    return {
        identified: !!json.identified && !!plantName,
        plant_name: plantName,
        local_name: localName,
        display_name: localName || plantName,
        scientific_name: clean(json.scientific_name) || null,
        family: clean(json.family) || null,
        category: clean(json.category) || null,
        confidence: pct(json.confidence),
        alternatives: (Array.isArray(json.alternatives) ? json.alternatives : [])
            .filter((a) => a && clean(a.plant_name) && clean(a.plant_name).toLowerCase() !== (plantName || '').toLowerCase())
            .slice(0, 2)
            .map((a) => ({ plant_name: clean(a.plant_name), scientific_name: clean(a.scientific_name) || null, confidence: pct(a.confidence), how_to_tell: clean(a.how_to_tell) || null })),
        observations: clean(json.observations) || null,
        hint: clean(json.hint) || null,
        model,
    };
}

/**
 * Full plant report. The plant is named first (stronger model) unless the farmer already told us
 * what it is (plantType, e.g. after correcting a wrong name); the long report then runs on the fast model
 * with that name fixed, so both agree.
 */
export async function analyzePlantHealth(imageBase64, plantType = null, language = 'en', plantSpecies = null) {
    const languageInstructions = {
        en: "Respond in English.",
        hi: "Respond in Hindi (हिंदी में जवाब दें).",
        te: "Respond in Telugu (తెలుగులో సమాధానం ఇవ్వండి)."
    };

    let id = null;
    if (!plantType) {
        try {
            id = await identifyPlant(imageBase64, language);
        } catch (e) {
            console.error('Plant identification error:', e.message);
        }
        if (id && !id.identified) {
            return {
                not_plant: true,
                plant_type: null,
                health_status: 'unknown',
                diseases: [],
                recommendations: [],
                confidence: 0,
                summary: id.hint || id.observations || 'No plant found in the photo. Take a closer photo of one plant in daylight.',
                identification: id,
            };
        }
    }

    const nameLine = plantType
        ? `This plant is: ${plantType}${plantSpecies ? ` (${plantSpecies})` : ''}, as confirmed by the farmer. Use this name for plant_type. Do not re-identify it.`
        : id
            ? `The plant has already been identified by a botanist as ${id.plant_name}${id.scientific_name ? ` (${id.scientific_name})` : ''}. Use exactly this plant for plant_type, plant_species and plant_family${id.local_name ? ` (the local name is ${id.local_name})` : ''}. Do not re-identify it.`
            : 'First identify the plant type and species. The farmers are in India: use the names used in India.';

    const prompt = `You are an expert agricultural plant pathologist, agronomist, and soil scientist. Analyze this plant image comprehensively.

${languageInstructions[language] || languageInstructions.en}

${nameLine}

Provide a COMPREHENSIVE analysis in this exact JSON format:
{
    "plant_type": "Common name of the plant/crop",
    "plant_species": "Scientific/botanical name",
    "plant_family": "Plant family name",
    "crop_category": "vegetable|fruit|grain|legume|flower|herb|tree|ornamental",
    "growth_stage": "seedling|vegetative|flowering|fruiting|mature|harvest-ready",
    "health_status": "healthy|mild|moderate|severe|critical",
    "confidence": 90.0,
    
    "diagnosis": {
        "primary_issue": "Main problem identified or 'Healthy plant'",
        "secondary_issues": ["other minor issues if any"],
        "urgency_level": "low|medium|high|critical",
        "prognosis": "Expected outcome if treated properly"
    },
    
    "diseases": [
        {
            "name": "disease name",
            "scientific_name": "pathogen scientific name if applicable",
            "type": "fungal|bacterial|viral|nutrient_deficiency|pest|environmental",
            "confidence": 85.5,
            "severity": "low|medium|high|critical",
            "spread_risk": "low|medium|high",
            "affected_parts": ["leaves", "stem", "roots"],
            "visible_symptoms": ["yellow spots", "wilting"],
            "description": "detailed description of the disease"
        }
    ],
    
    "causes": [
        {
            "factor": "cause name (e.g., High Humidity, Overwatering)",
            "category": "environmental|cultural|pathogenic|nutritional",
            "explanation": "detailed explanation",
            "prevention": "how to prevent this in future",
            "likelihood": "high|medium|low"
        }
    ],
    
    "soil_analysis": {
        "recommended_ph": "6.0-7.0",
        "current_issue": "possible soil issue based on symptoms",
        "soil_type_needed": "loamy|sandy|clay|well-draining",
        "drainage_requirement": "good|moderate|poor",
        "organic_matter": "Add compost recommendation",
        "amendments": ["lime", "compost"]
    },
    
    "ideal_conditions": {
        "temperature_optimal": "22-26°C",
        "humidity": "60-70%",
        "sunlight_hours": "6-8 hours",
        "sunlight_type": "full sun|partial shade",
        "soil_ph": "6.0-7.0",
        "watering_frequency": "Every 2-3 days"
    },
    
    "watering_schedule": {
        "frequency": "How often to water",
        "best_time": "Early morning or evening",
        "method": "drip irrigation|overhead|hand watering",
        "signs_of_overwatering": ["yellow leaves"],
        "signs_of_underwatering": ["wilting"],
        "current_recommendation": "Based on condition"
    },
    
    "treatment_plan": {
        "immediate": ["Action within 24 hours"],
        "daily": ["Daily care for 7 days"],
        "weekly": ["Weekly treatment for 4 weeks"],
        "long_term": ["Long-term strategies"]
    },
    
    "fertilizer_recommendations": [
        {
            "type": "NPK 10-10-10",
            "name": "Balanced fertilizer",
            "purpose": "Why needed",
            "dosage": "Amount per plant",
            "frequency": "How often",
            "application_method": "foliar|soil drench",
            "organic_alternative": "Compost tea"
        }
    ],
    
    "organic_remedies": [
        {
            "name": "Neem oil spray",
            "ingredients": "Neem oil, water, soap",
            "preparation": "Mix instructions",
            "application": "How to apply",
            "frequency": "How often",
            "effectiveness": "high|medium|low"
        }
    ],
    
    "chemical_treatments": [
        {
            "product_type": "Fungicide",
            "active_ingredient": "Copper",
            "commercial_names": ["Brand 1"],
            "dosage": "2ml per liter",
            "frequency": "Weekly",
            "waiting_period": "7 days before harvest",
            "precautions": "Wear gloves"
        }
    ],
    
    "companion_planting": {
        "beneficial_plants": ["Marigold", "Basil"],
        "plants_to_avoid": ["Fennel"],
        "why": "Explanation"
    },
    
    "harvest_info": {
        "days_to_harvest": "60-90 days",
        "harvest_signs": ["Color change", "Size"],
        "yield_expectation": "2-3 kg per plant",
        "storage_tips": "Store in cool place"
    },
    
    "quick_tips": [
        {"icon": "💧", "title": "Watering", "tip": "Water in morning"},
        {"icon": "☀️", "title": "Sunlight", "tip": "6 hours daily"},
        {"icon": "🌱", "title": "Nutrition", "tip": "Feed monthly"},
        {"icon": "🐛", "title": "Pest Control", "tip": "Check weekly"}
    ],
    
    "recommendations": [
        "Most important action",
        "Second priority",
        "Third priority",
        "Preventive measure",
        "General care tip"
    ],
    
    "summary": "2-3 sentence summary for farmer in simple language"
}

IMPORTANT: Be accurate and provide practical, actionable advice. Return ONLY valid JSON.`;

    try {
        // 8000 tokens: the full report in Hindi/Telugu is long
        const report = await askVision(prompt, imageBase64, 8000);
        if (id) {
            // The botanist's name wins over whatever the report model wrote.
            report.plant_type = id.display_name;
            report.plant_species = id.scientific_name || report.plant_species;
            report.plant_family = id.family || report.plant_family;
            report.identification = id;
        } else if (plantType) {
            report.plant_type = plantType;
            report.plant_species = plantSpecies || report.plant_species;
            report.identification = { identified: true, plant_name: plantType, display_name: plantType, scientific_name: plantSpecies || report.plant_species || null, confidence: null, alternatives: [], given: true };
        }
        return report;
    } catch (error) {
        console.error('Plant analysis error:', error);
        return {
            plant_type: id?.display_name || plantType || 'Unknown',
            identification: id || undefined,
            health_status: 'unknown',
            diseases: [],
            recommendations: ['Please retake the photo with better lighting'],
            confidence: 0,
            summary: 'Could not analyze the image. Please try again.',
            error: error.message
        };
    }
}

export async function analyzeSoil(imageBase64, language = 'en') {
    const languageInstructions = {
        en: "Respond in English.",
        hi: "Respond in Hindi.",
        te: "Respond in Telugu."
    };

    const prompt = `You are an expert soil scientist and agronomist. Analyze this image.

FIRST: Determine if this image contains soil/earth/dirt that can be analyzed.
- If the image shows a person, face, selfie, human body, or anything that is NOT soil, respond ONLY with this JSON:
  {"error": "not_soil", "message": "Please take a photo of soil, not a person or other object."}

- If the image shows soil/earth/dirt, proceed with the full analysis below.

${languageInstructions[language] || languageInstructions.en}

Provide a DETAILED analysis in this exact JSON format:
{
    "soil_type": "clay|sandy|loamy|silty|red soil|black soil|laterite|alluvial",
    "soil_classification": "Scientific soil classification",
    "texture": "fine|medium|coarse",
    "texture_description": "Detailed texture description",
    "structure": "granular|blocky|platy|prismatic|massive",
    "moisture_level": "dry|moist|wet|waterlogged",
    "moisture_percentage": "estimated %",
    
    "color_analysis": {
        "primary_color": "brown|red|black|gray|yellow",
        "munsell_notation": "approximate Munsell color",
        "color_meaning": "What this color indicates",
        "organic_indicator": "Color suggests organic content level"
    },
    
    "ph_assessment": {
        "estimate": "acidic|slightly_acidic|neutral|slightly_alkaline|alkaline",
        "ph_range": "5.5-6.5",
        "accuracy": "Based on visual indicators",
        "correction_needed": "none|lime_addition|sulfur_addition",
        "target_ph": "6.0-7.0 for most crops"
    },
    
    "nutrient_analysis": {
        "nitrogen": {
            "level": "deficient|low|adequate|high",
            "signs": "Visual signs observed",
            "impact": "How it affects plants",
            "remedy": "How to increase/balance"
        },
        "phosphorus": {
            "level": "deficient|low|adequate|high",
            "signs": "Visual signs observed",
            "impact": "How it affects plants",
            "remedy": "How to increase/balance"
        },
        "potassium": {
            "level": "deficient|low|adequate|high",
            "signs": "Visual signs observed",
            "impact": "How it affects plants",
            "remedy": "How to increase/balance"
        },
        "calcium": {
            "level": "deficient|low|adequate|high",
            "remedy": "How to improve"
        },
        "magnesium": {
            "level": "deficient|low|adequate|high",
            "remedy": "How to improve"
        },
        "micronutrients": {
            "iron": "adequate|deficient",
            "zinc": "adequate|deficient",
            "manganese": "adequate|deficient",
            "boron": "adequate|deficient"
        }
    },
    
    "organic_matter": {
        "level": "very_low|low|medium|high|very_high",
        "percentage_estimate": "2-4%",
        "quality": "decomposed|partially_decomposed|fresh",
        "improvement_plan": "How to increase organic matter"
    },
    
    "drainage_assessment": {
        "quality": "poor|moderate|good|excessive",
        "water_holding": "low|medium|high",
        "aeration": "poor|moderate|good",
        "compaction_level": "none|mild|moderate|severe",
        "improvement_method": "How to improve drainage"
    },
    
    "biological_activity": {
        "earthworm_signs": "present|absent|unknown",
        "microbial_health": "poor|moderate|good",
        "root_zone_health": "assessment based on visual cues",
        "improvement_tips": ["Add compost", "Use cover crops"]
    },
    
    "soil_problems": [
        {
            "issue": "Problem name",
            "severity": "low|medium|high|critical",
            "cause": "Why this happened",
            "symptoms": "Visible symptoms",
            "solution": "How to fix it",
            "timeline": "How long to fix"
        }
    ],
    
    "amendments_needed": [
        {
            "amendment": "Amendment name",
            "purpose": "Why needed",
            "application_rate": "Amount per area",
            "application_method": "How to apply",
            "timing": "When to apply",
            "expected_result": "What will improve",
            "cost_estimate": "Low|Medium|High",
            "organic_option": "Organic alternative if available"
        }
    ],
    
    "fertilizer_program": {
        "immediate_needs": [
            {
                "fertilizer": "Type",
                "npk_ratio": "10-10-10",
                "dosage": "Amount",
                "application": "Method",
                "frequency": "How often"
            }
        ],
        "seasonal_plan": "Overview of yearly fertilization",
        "organic_alternatives": ["Compost", "Vermicompost", "Green manure"]
    },
    
    "ideal_crops": [
        {
            "crop": "Crop name",
            "suitability": "excellent|good|moderate|poor",
            "reason": "Why suitable",
            "yield_potential": "high|medium|low",
            "special_care": "Any special requirements"
        }
    ],
    
    "crops_to_avoid": [
        {
            "crop": "Crop name",
            "reason": "Why not suitable"
        }
    ],
    
    "improvement_plan": {
        "immediate": ["Actions within 1 week"],
        "short_term": ["Actions within 1 month"],
        "long_term": ["Actions over 3-6 months"],
        "maintenance": ["Ongoing care practices"]
    },
    
    "soil_health_score": {
        "overall": 65,
        "fertility": 70,
        "structure": 60,
        "biology": 55,
        "drainage": 75
    },
    
    "testing_recommendations": [
        {
            "test": "pH test",
            "importance": "high|medium|low",
            "lab_or_home": "lab|home kit",
            "frequency": "How often to test"
        }
    ],
    
    "summary": "2-3 sentence farmer-friendly summary of soil condition and top priorities",
    "action_priority": "The single most important thing to do first"
}

IMPORTANT: Be accurate, practical, and provide actionable advice. Consider local farming practices.
Return ONLY valid JSON.`;

    try {
        return await askVision(prompt, imageBase64, 8000);
    } catch (error) {
        console.error('Soil analysis error:', error);
        return {
            soil_type: 'unknown',
            soil_health_score: { overall: 0 },
            recommendations: ['Please retake the soil photo with better lighting'],
            summary: 'Unable to analyze soil. Please try again.',
            error: error.message
        };
    }
}

export async function chatWithPlant(message, plantType, healthStatus, diseases = [], history = [], language = 'en') {
    const languageInstructions = {
        en: "Respond in English.",
        hi: "Respond in Hindi.",
        te: "Respond in Telugu."
    };

    const prompt = `You are a helpful agricultural AI assistant. A farmer is asking about their ${plantType} plant.

Plant Status: ${healthStatus}
${diseases.length > 0 ? `Known Issues: ${diseases.join(', ')}` : 'No known issues'}

${languageInstructions[language] || languageInstructions.en}

Farmer's Question: ${message}

Provide a helpful, practical response in 2-3 sentences. Be friendly and use simple language.`;

    try {
        const text = await askText(prompt);
        return {
            response: text,
            plant_type: plantType
        };
    } catch (error) {
        console.error('Chat error:', error);
        return {
            response: "I'm having trouble connecting. Please try again.",
            error: error.message
        };
    }
}

/**
 * Live AR scan: one camera frame -> a short, honest read of the plant for the overlay.
 * Runs every ~1.5 s while AR is on, so it uses the fast model and a small reply.
 */
const AR_LANGUAGE = {
    en: 'Write the text fields in plain, everyday English.',
    hi: 'Write the text fields in everyday spoken Hindi (Devanagari), the way farmers talk. Keep plant_name in the common Hindi name if there is one.',
    te: 'Write the text fields in everyday spoken Telugu (Telugu script), the way farmers talk. Keep plant_name in the common Telugu name if there is one.',
};
const AR_HINT = {
    en: 'Point at one plant, a little closer',
    hi: 'एक पौधे की ओर, थोड़ा पास से दिखाओ',
    te: 'ఒక మొక్క వైపు, కొంచెం దగ్గరగా చూపించండి',
};
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
const clean = (v) => (typeof v === 'string' ? v.replace(EMOJI_RE, '').trim() : v);
const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

/**
 * @param {{plant?: {plant_name: string, scientific_name?: string|null, display_name?: string|null} | null}} [opts]
 *   plant: already identified (by identifyPlant). The name is then kept, not re-guessed every frame.
 */
export async function analyzeForAR(imageBase64, language = 'en', { plant = null } = {}) {
    const lang = AR_LANGUAGE[language] ? language : 'en';
    const known = plant?.plant_name
        ? `This plant has already been identified as ${plant.plant_name}${plant.scientific_name ? ` (${plant.scientific_name})` : ''}. Do not rename it. Use "${plant.display_name || plant.plant_name}" as plant_name. If the main plant in this frame is clearly a different kind of plant, set "same_plant" to false.`
        : 'The farmers are in India: use the common name used in India (for example "Money plant" for Epipremnum aureum). Name the plant from what you can see (leaf shape, edge, veins, surface, variegation, growth habit), not from what crop is likely.';
    const prompt = `This is one frame from a farmer's phone camera, pointed at a plant. Look at it like an experienced agronomist standing next to them.
${AR_LANGUAGE[lang]}
${known}

Reply ONLY with this JSON:
{
  "identified": true if a plant fills a reasonable part of the frame and you can name it, else false,
  "same_plant": ${plant?.plant_name ? `true unless the main plant is clearly not ${plant.plant_name},` : 'true,'}
  "plant_name": "common name",
  "scientific_name": "Latin name or null",
  "health_score": 0-100 (100 = completely healthy),
  "health_status": "healthy" | "mild" | "needs_attention" | "serious",
  "headline": "what you see, in under 10 words, like a person would say it (e.g. 'Young tomato, lower leaves turning yellow')",
  "issue": "short plain name of the main problem, or null if healthy",
  "tip": "one practical thing to do today, under 16 words, no brand names or doses",
  "fact": "one short, true, specific fact a farmer would find useful about this plant, under 16 words, no hype",
  "water": "low" | "medium" | "high",
  "sun": "full sun" | "part shade" | "shade",
  "confidence": 0-1,
  "box": {"x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1} = the main plant or leaf in the frame, measured from the top-left corner as fractions of width and height,
  "spots": up to 3 visible problem areas as [{"x": 0-1, "y": 0-1}] in the same frame coordinates, or [] if healthy,
  "say": "what the plant would say first, out loud, in first person to its farmer: 1 or 2 short, warm spoken sentences about how it feels and what is wrong (or that it is fine)",
  "hint": if identified is false, a short instruction to get a better view (e.g. "Move closer to one leaf"), else null
}
Be honest: if the frame is blurry, dark or not a plant, set identified to false. Do not exaggerate problems on healthy plants. No emoji, no exclamation marks.`;

    try {
        const r = await askVision(prompt, imageBase64, 700);
        const box = r.box && typeof r.box === 'object'
            ? { x: clamp01(r.box.x), y: clamp01(r.box.y), w: clamp01(r.box.w), h: clamp01(r.box.h) }
            : null;
        const samePlant = !plant?.plant_name || r.same_plant !== false;
        return {
            identified: !!r.identified,
            same_plant: samePlant,
            plant_name: (samePlant && plant?.plant_name ? plant.display_name || plant.plant_name : clean(r.plant_name)) || null,
            scientific_name: (samePlant && plant?.scientific_name ? plant.scientific_name : clean(r.scientific_name)) || null,
            health_score: Math.round(Math.max(0, Math.min(100, Number(r.health_score) || 0))),
            health_status: ['healthy', 'mild', 'needs_attention', 'serious'].includes(r.health_status) ? r.health_status : 'mild',
            headline: clean(r.headline) || null,
            issue: clean(r.issue) || null,
            tip: clean(r.tip) || null,
            fact: clean(r.fact) || null,
            water: clean(r.water) || null,
            sun: clean(r.sun) || null,
            confidence: clamp01(r.confidence),
            box: box && box.w > 0.05 && box.h > 0.05 ? box : null,
            spots: Array.isArray(r.spots) ? r.spots.slice(0, 3).map((p) => ({ x: clamp01(p?.x), y: clamp01(p?.y) })) : [],
            say: clean(r.say) || null,
            hint: clean(r.hint) || (r.identified ? null : AR_HINT[lang]),
            language: lang,
            timestamp: Date.now(),
        };
    } catch (error) {
        console.error('AR scan error:', error.message);
        return { identified: false, hint: AR_HINT[lang], error: error.message, language: lang, timestamp: Date.now() };
    }
}

/**
 * Live AR with a stable name.
 * - plant given (the overlay already locked a name): fast model only, name kept.
 * - no plant yet: the fast model checks a plant is in view; only then the stronger model names it.
 *   If the two disagree on the genus, the frame is read again with the stronger model's name so the
 *   tip, fact and greeting are about the right plant.
 * The reply carries `identity` for the overlay to send back on the next frames.
 */
export async function scanForAR(imageBase64, language = 'en', { plant = null } = {}) {
    if (plant?.plant_name) return analyzeForAR(imageBase64, language, { plant });

    const first = await analyzeForAR(imageBase64, language);
    if (!first.identified) return first;

    let id;
    try {
        id = await identifyPlant(imageBase64, language);
    } catch (e) {
        console.error('AR identify error:', e.message);
        return { ...first, identity: null };
    }
    if (!id.identified) return { ...first, identity: null };

    const identity = {
        plant_name: id.plant_name, display_name: id.display_name, scientific_name: id.scientific_name, confidence: id.confidence,
    };
    const read = sameGenus(first.scientific_name, id.scientific_name) ? first : await analyzeForAR(imageBase64, language, { plant: identity });
    return {
        ...read,
        identified: true,
        same_plant: true,
        plant_name: id.display_name,
        scientific_name: id.scientific_name || read.scientific_name,
        confidence: id.confidence / 100,
        alternatives: id.alternatives,
        identity,
    };
}
