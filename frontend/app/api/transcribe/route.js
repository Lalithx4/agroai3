import { NextResponse } from 'next/server';
import { transcribe, isSarvamConfigured } from '@/lib/sarvam';

export const runtime = 'nodejs';
export const maxDuration = 30;

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * POST multipart { audio: Blob, language?: 'en'|'hi'|'te' } -> { transcript, language }
 * Sarvam Saaras first (best for Hindi/Telugu and code-mixed speech), Deepgram as a fallback.
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const audio = formData.get('audio');
    const language = formData.get('language') || '';

    if (!audio || typeof audio === 'string') {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio clip is too long' }, { status: 413 });
    }

    if (isSarvamConfigured()) {
      try {
        // Let Saaras detect the language: farmers switch languages mid-sentence.
        const r = await transcribe(audio, {});
        return NextResponse.json({ success: true, transcript: r.transcript, language: r.language || language || null, provider: 'sarvam' });
      } catch (e) {
        console.error('Sarvam STT failed:', e.message);
        if (!DEEPGRAM_API_KEY) throw e;
      }
    }

    if (!DEEPGRAM_API_KEY) {
      return NextResponse.json({ error: 'Speech recognition is not configured' }, { status: 501 });
    }

    const dgLanguage = ['en', 'hi', 'te'].includes(language) ? language : 'en';
    const response = await fetch(
      `https://api.deepgram.com/v1/listen?model=nova-2&language=${dgLanguage}&smart_format=true&punctuate=true`,
      {
        method: 'POST',
        headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, 'Content-Type': audio.type || 'audio/webm' },
        body: await audio.arrayBuffer(),
      }
    );
    if (!response.ok) {
      const details = await response.text();
      console.error('Deepgram API error:', details);
      return NextResponse.json({ error: 'Transcription failed', details }, { status: response.status });
    }
    const result = await response.json();
    const alt = result.results?.channels?.[0]?.alternatives?.[0] || {};
    return NextResponse.json({ success: true, transcript: alt.transcript || '', confidence: alt.confidence || 0, language: dgLanguage, provider: 'deepgram' });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Failed to transcribe audio', details: error.message }, { status: 500 });
  }
}
