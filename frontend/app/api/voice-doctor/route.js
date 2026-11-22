import { NextResponse } from 'next/server';
import { diagnoseForVoice } from '@/lib/voice-doctor';
import { transcribe, isSarvamConfigured } from '@/lib/sarvam';
import { CROPS } from '@/lib/crops';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

/**
 * POST multipart/form-data:
 *   image     (file, required)  photo of the plant
 *   audio     (file, optional)  farmer's spoken symptoms (under about 30 s)
 *   crop      (text, optional)  tomato | chilli | cotton | paddy
 *   language  (text, optional)  en | hi | te  (used when speech is not detected)
 */
export async function POST(request) {
  try {
    const form = await request.formData();
    const image = form.get('image');
    const audio = form.get('audio');
    const cropRaw = String(form.get('crop') || '').toLowerCase();
    const crop = CROPS[cropRaw] ? cropRaw : undefined;
    let language = ['en', 'hi', 'te'].includes(String(form.get('language'))) ? String(form.get('language')) : 'en';

    if (!image || typeof image === 'string') return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    if (image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image is too large' }, { status: 413 });
    const imageBase64 = Buffer.from(await image.arrayBuffer()).toString('base64');

    // 1. hear the farmer (optional; never blocks the diagnosis)
    let transcript = '';
    let stt = { used: false };
    if (audio && typeof audio !== 'string' && audio.size > 0) {
      if (audio.size > MAX_AUDIO_BYTES) {
        stt = { used: false, error: 'Audio clip is too long' };
      } else if (!isSarvamConfigured()) {
        stt = { used: false, error: 'Speech recognition is not configured' };
      } else {
        try {
          const t0 = Date.now();
          const r = await transcribe(audio, {});
          transcript = r.transcript;
          if (r.language) language = r.language;       // answer in the language the farmer spoke
          stt = { used: true, language: r.languageCode, ms: Date.now() - t0 };
        } catch (e) {
          console.error('STT error:', e.message);
          stt = { used: false, error: 'Could not understand the audio' };
        }
      }
    }

    // 2. look at the plant and write what the plant will say
    const result = await diagnoseForVoice({ imageBase64, crop, transcript, language });
    return NextResponse.json({ ...result, transcript, stt, sarvam: isSarvamConfigured() });
  } catch (error) {
    console.error('Voice doctor error:', error);
    return NextResponse.json({ error: 'Voice doctor failed', detail: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', sarvam: isSarvamConfigured(), crops: Object.keys(CROPS) });
}
