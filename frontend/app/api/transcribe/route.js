import { NextResponse } from 'next/server';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    const language = formData.get('language') || 'en';

    if (!audioFile) {
      return NextResponse.json({ 
        error: 'No audio file provided' 
      }, { status: 400 });
    }

    if (!DEEPGRAM_API_KEY) {
      return NextResponse.json({ 
        error: 'Deepgram API key not configured' 
      }, { status: 500 });
    }

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();

    // Map language codes
    const languageMap = {
      'en': 'en',
      'hi': 'hi',
      'te': 'te',
      'ta': 'ta',
      'kn': 'kn',
      'mr': 'mr',
    };
    const dgLanguage = languageMap[language] || 'en';

    // Call Deepgram API
    const response = await fetch(
      `https://api.deepgram.com/v1/listen?model=nova-2&language=${dgLanguage}&smart_format=true&punctuate=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': audioFile.type || 'audio/webm',
        },
        body: arrayBuffer,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', errorText);
      return NextResponse.json({ 
        error: 'Transcription failed',
        details: errorText
      }, { status: response.status });
    }

    const result = await response.json();
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    return NextResponse.json({
      success: true,
      transcript,
      confidence,
      language: dgLanguage,
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ 
      error: 'Failed to transcribe audio',
      details: error.message
    }, { status: 500 });
  }
}
