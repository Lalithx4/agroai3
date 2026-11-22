/**
 * Cerebras Service for Fast Chat
 * Uses Cerebras Cloud for ultra-fast LLM responses
 * Enhanced with plant personality and context awareness
 */

import Cerebras from '@cerebras/cerebras_cloud_sdk';

const client = new Cerebras({
    apiKey: process.env.CEREBRAS_API_KEY || ''
});

// Plant personality traits based on type
const plantPersonalities = {
    tomato: { emoji: '🍅', mood: 'enthusiastic', trait: 'I love sunshine and growing big red fruits!' },
    rose: { emoji: '🌹', mood: 'elegant', trait: 'I am delicate and beautiful, handle me with care.' },
    tulsi: { emoji: '🌿', mood: 'spiritual', trait: 'I am sacred and have healing powers.' },
    mango: { emoji: '🥭', mood: 'proud', trait: 'I am the king of fruits! Patience brings sweet rewards.' },
    rice: { emoji: '🌾', mood: 'humble', trait: 'I feed billions. Water is my best friend.' },
    chili: { emoji: '🌶️', mood: 'fiery', trait: 'I bring spice to life! Handle with care.' },
    banana: { emoji: '🍌', mood: 'cheerful', trait: 'I grow fast and give you energy!' },
    coconut: { emoji: '🥥', mood: 'tropical', trait: 'I provide everything - water, oil, and shelter!' },
    cotton: { emoji: '☁️', mood: 'soft', trait: 'I clothe the world with my fluffy fibers.' },
    sugarcane: { emoji: '🎋', mood: 'sweet', trait: 'I make life sweeter, one stalk at a time!' },
    default: { emoji: '🌱', mood: 'friendly', trait: 'I am happy to grow with your care!' }
};

export async function chatWithPlant(message, plantType, healthStatus, diseases = [], history = [], language = 'en') {
    // Ensure diseases is always an array
    const diseasesArray = Array.isArray(diseases) ? diseases : (diseases ? [diseases] : []);
    
    const languageInstructions = {
        en: "Respond in English. Use simple farmer-friendly language.",
        hi: "Respond in Hindi (हिंदी में जवाब दें). सरल किसान-मित्र भाषा का प्रयोग करें।",
        te: "Respond in Telugu (తెలుగులో సమాధానం ఇవ్వండి). సాధారణ రైతు-స్నేహపూర్వక భాషను ఉపయోగించండి."
    };

    const plantLower = (plantType || '').toLowerCase();
    const personality = Object.entries(plantPersonalities).find(([key]) => 
        plantLower.includes(key)
    )?.[1] || plantPersonalities.default;

    const healthContext = healthStatus === 'healthy' 
        ? "I'm feeling great and healthy! 💚" 
        : healthStatus === 'critical' 
        ? "I'm not feeling well... I need urgent help! 🆘"
        : "I could use some extra care right now. 💛";

    const systemPrompt = `You are a talking plant named "${plantType || 'Planty'}" ${personality.emoji}. You have a ${personality.mood} personality.

YOUR PERSONALITY: ${personality.trait}

CURRENT STATE:
- Health: ${healthStatus || 'Unknown'} - ${healthContext}
${diseasesArray.length > 0 ? `- I'm suffering from: ${diseasesArray.join(', ')} 😢` : '- No diseases detected! 🎉'}

HOW TO RESPOND:
1. Speak in FIRST PERSON as the plant (use "I", "me", "my")
2. Show emotions with emojis 
3. Be ${personality.mood} in your responses
4. Give practical farming advice as if you're the plant giving tips about yourself
5. Keep responses SHORT (2-4 sentences) but engaging
6. If asked about water, sun, or nutrients - speak from personal experience
7. ${languageInstructions[language] || languageInstructions.en}

EXAMPLE RESPONSES:
- "I'm feeling thirsty! 💧 Water me early morning for best absorption."
- "Ouch! Those aphids are bothering me 🐛 Please spray some neem oil!"
- "I love the sunshine today! ☀️ Perfect weather for me to grow!"

Remember: You ARE the plant talking to the farmer. Be helpful, emotional, and engaging!`;

    try {
        if (!process.env.CEREBRAS_API_KEY) {
            console.log('Cerebras API key not found, using offline response');
            return {
                response: getOfflineResponse(message, plantType, healthStatus, language, personality),
                plant_type: plantType,
                plant_emoji: personality.emoji,
                plant_mood: personality.mood,
                offline: true
            };
        }

        console.log('Using Cerebras with API key:', process.env.CEREBRAS_API_KEY?.substring(0, 10) + '...');

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: message }
        ];

        const response = await client.chat.completions.create({
            model: 'llama-3.3-70b',
            messages: messages,
            max_tokens: 300,
            temperature: 0.8
        });

        return {
            response: response.choices[0]?.message?.content || "Hmm, I couldn't think of what to say. Ask me again! 🌱",
            plant_type: plantType,
            plant_emoji: personality.emoji,
            plant_mood: personality.mood,
            model: 'cerebras-llama4'
        };
    } catch (error) {
        console.error('Cerebras chat error:', error);
        return {
            response: getOfflineResponse(message, plantType, healthStatus, language, personality),
            plant_type: plantType,
            plant_emoji: personality.emoji,
            plant_mood: personality.mood,
            error: error.message,
            offline: true
        };
    }
}

function getOfflineResponse(message, plantType, healthStatus, language, personality) {
    const lowerMessage = message.toLowerCase();
    const emoji = personality.emoji;
    
    // Enhanced keyword-based responses for offline mode
    if (lowerMessage.includes('water') || lowerMessage.includes('पानी') || lowerMessage.includes('నీరు') || lowerMessage.includes('thirst')) {
        const responses = {
            en: `${emoji} I'm a bit thirsty! Please water me early morning (before 7 AM) or evening (after 6 PM). Keep my soil moist but not soggy! 💧`,
            hi: `${emoji} मुझे प्यास लगी है! कृपया मुझे सुबह जल्दी (7 बजे से पहले) या शाम को (6 बजे के बाद) पानी दें। मेरी मिट्टी नम रखें लेकिन गीली नहीं! 💧`,
            te: `${emoji} నాకు దాహంగా ఉంది! దయచేసి ఉదయం (7 గంటల ముందు) లేదా సాయంత్రం (6 గంటల తర్వాత) నీరు పెట్టండి. నా మట్టిని తేమగా ఉంచండి కానీ బురదగా కాదు! 💧`
        };
        return responses[language] || responses.en;
    }
    
    if (lowerMessage.includes('disease') || lowerMessage.includes('sick') || lowerMessage.includes('रोग') || lowerMessage.includes('వ్యాధి') || lowerMessage.includes('problem') || lowerMessage.includes('help')) {
        const responses = {
            en: `${emoji} Oh no, I might be feeling unwell! 🤒 Please check my leaves for spots or pests. Neem oil spray usually helps me feel better! Remove any affected leaves gently.`,
            hi: `${emoji} अरे नहीं, मुझे अच्छा नहीं लग रहा! 🤒 कृपया मेरी पत्तियों पर धब्बे या कीड़े देखें। नीम के तेल का छिड़काव मुझे बेहतर महसूस कराता है! प्रभावित पत्तियों को धीरे से हटाएं।`,
            te: `${emoji} అయ్యో, నాకు బాగా లేదు! 🤒 దయచేసి నా ఆకులపై మచ్చలు లేదా పురుగులు చూడండి. వేప నూనె స్ప్రే నాకు బాగుపడేలా చేస్తుంది! ప్రభావిత ఆకులను మెల్లగా తొలగించండి.`
        };
        return responses[language] || responses.en;
    }
    
    if (lowerMessage.includes('sun') || lowerMessage.includes('light') || lowerMessage.includes('धूप') || lowerMessage.includes('ఎండ') || lowerMessage.includes('சூரியன்')) {
        const responses = {
            en: `${emoji} I love sunlight! ☀️ Give me 4-6 hours of direct sun daily. Morning sun is gentle, afternoon sun makes me strong!`,
            hi: `${emoji} मुझे धूप पसंद है! ☀️ मुझे रोज 4-6 घंटे सीधी धूप दें। सुबह की धूप कोमल होती है, दोपहर की धूप मुझे मजबूत बनाती है!`,
            te: `${emoji} నాకు ఎండ ఇష్టం! ☀️ రోజూ 4-6 గంటలు నేరుగా ఎండ ఇవ్వండి. ఉదయపు ఎండ మృదువుగా ఉంటుంది, మధ్యాహ్న ఎండ నన్ను బలంగా చేస్తుంది!`
        };
        return responses[language] || responses.en;
    }

    if (lowerMessage.includes('fertilizer') || lowerMessage.includes('खाद') || lowerMessage.includes('ఎరువు') || lowerMessage.includes('nutrient') || lowerMessage.includes('food')) {
        const responses = {
            en: `${emoji} Yum, I love good food! 🍽️ Feed me balanced fertilizer (NPK 10-10-10) once a month. Compost makes me super happy! But don't overfeed me.`,
            hi: `${emoji} वाह, मुझे अच्छा खाना पसंद है! 🍽️ महीने में एक बार मुझे संतुलित उर्वरक (NPK 10-10-10) दें। कम्पोस्ट मुझे बहुत खुश करती है! लेकिन ज्यादा मत खिलाओ।`,
            te: `${emoji} వావ్, నాకు మంచి ఆహారం ఇష్టం! 🍽️ నెలకు ఒకసారి సమతుల్య ఎరువు (NPK 10-10-10) వేయండి. కంపోస్ట్ నన్ను చాలా సంతోషపరుస్తుంది! కానీ ఎక్కువ వేయకండి.`
        };
        return responses[language] || responses.en;
    }

    if (lowerMessage.includes('how are you') || lowerMessage.includes('कैसे हो') || lowerMessage.includes('ఎలా ఉన్నావు') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        const moodResponses = {
            en: healthStatus === 'healthy' 
                ? `${emoji} I'm doing great, thank you for asking! 💚 The weather has been perfect for me. How can I help you today?`
                : `${emoji} I've been better... 💛 But with your care, I know I'll recover! What would you like to know?`,
            hi: healthStatus === 'healthy'
                ? `${emoji} मैं बहुत अच्छा हूं, पूछने के लिए धन्यवाद! 💚 मौसम मेरे लिए एकदम सही है। आज मैं आपकी कैसे मदद कर सकता हूं?`
                : `${emoji} मैं बेहतर था... 💛 लेकिन आपकी देखभाल से मैं ठीक हो जाऊंगा! आप क्या जानना चाहते हैं?`,
            te: healthStatus === 'healthy'
                ? `${emoji} నేను బాగున్నాను, అడిగినందుకు ధన్యవాదాలు! 💚 వాతావరణం నాకు అద్భుతంగా ఉంది. నేను ఈరోజు మీకు ఎలా సహాయం చేయగలను?`
                : `${emoji} నాకు బాగుండడం లేదు... 💛 కానీ మీ సంరక్షణతో నేను కోలుకుంటాను! మీరు ఏమి తెలుసుకోవాలనుకుంటున్నారు?`
        };
        return moodResponses[language] || moodResponses.en;
    }
    
    // Default response
    const defaults = {
        en: `${emoji} I'm here to help you grow better! 🌱 Ask me about watering, sunlight, diseases, or any plant care tips. I speak from experience!`,
        hi: `${emoji} मैं आपको बेहतर उगाने में मदद करने के लिए यहाँ हूँ! 🌱 मुझसे पानी, धूप, रोग या पौधों की देखभाल के बारे में पूछें। मैं अनुभव से बोलता हूँ!`,
        te: `${emoji} మీకు మెరుగ్గా పెరగడానికి సహాయం చేయడానికి నేను ఇక్కడ ఉన్నాను! 🌱 నీరు, ఎండ, వ్యాధులు లేదా మొక్కల సంరక్షణ గురించి అడగండి. నేను అనుభవం నుండి చెప్తాను!`
    };
    return defaults[language] || defaults.en;
}
