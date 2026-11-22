import { NextResponse } from 'next/server';
import { speak, isSarvamConfigured, MOOD } from '@/lib/sarvam';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST JSON { text, language: 'en'|'hi'|'te', level: 0..4 } -> audio/mpeg (Sarvam Bulbul)
 * 501 when SARVAM_API_KEY is missing, so the browser can fall back to its own voice.
 */
export async function POST(request) {
  try {
    if (!isSarvamConfigured()) return NextResponse.json({ error: 'sarvam_not_configured' }, { status: 501 });
    const { text, language = 'en', level = 0 } = await request.json();
    if (!text || typeof text !== 'string') return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    const lang = ['en', 'hi', 'te'].includes(language) ? language : 'en';
    const mood = MOOD[Math.max(0, Math.min(4, parseInt(level, 10) || 0))];
    const audio = await speak(text, { language: lang, pace: mood.pace, pitch: mood.pitch });
    return new NextResponse(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(audio.length), 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('TTS error:', error.message);
    return NextResponse.json({ error: 'tts_failed', detail: error.message }, { status: 502 });
  }
}
