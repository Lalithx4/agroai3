import { NextResponse } from 'next/server';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Deepgram TTS voices
const voiceMap = {
    'en': 'aura-asteria-en',   // English - Friendly female voice
    'hi': 'aura-asteria-en',   // Hindi (using English voice as Deepgram has limited Hindi TTS)
    'te': 'aura-asteria-en',   // Telugu (using English voice)
};

export async function POST(request) {
    try {
        const { text, language = 'en' } = await request.json();
        
        if (!text) {
            return NextResponse.json({ error: 'No text provided' }, { status: 400 });
        }
        
        if (!DEEPGRAM_API_KEY) {
            return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 });
        }
        
        const voice = voiceMap[language] || 'aura-asteria-en';
        
        const response = await fetch(
            `https://api.deepgram.com/v1/speak?model=${voice}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${DEEPGRAM_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text }),
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Deepgram TTS error:', errorText);
            return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
        }
        
        const audioBuffer = await response.arrayBuffer();
        
        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.byteLength.toString(),
            },
        });
        
    } catch (error) {
        console.error('Speak API error:', error);
        return NextResponse.json({ error: 'TTS failed', detail: error.message }, { status: 500 });
    }
}
