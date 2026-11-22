// Deepgram Voice Integration for CropmagiX AI
// Provides speech-to-text and text-to-speech functionality

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;

// ============================================
// SPEECH-TO-TEXT (Voice Input)
// ============================================

export async function transcribeAudio(audioBlob, options = {}) {
  const {
    language = 'en',
    model = 'nova-2',
    smartFormat = true,
    punctuate = true,
  } = options;

  try {
    // Convert blob to buffer for API
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Map language codes to Deepgram language codes
    const languageMap = {
      'en': 'en',
      'hi': 'hi',
      'te': 'te', // Telugu
      'ta': 'ta', // Tamil
      'kn': 'kn', // Kannada
      'mr': 'mr', // Marathi
    };
    
    const dgLanguage = languageMap[language] || 'en';

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?model=${model}&language=${dgLanguage}&smart_format=${smartFormat}&punctuate=${punctuate}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': audioBlob.type || 'audio/webm',
        },
        body: arrayBuffer,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    return {
      success: true,
      transcript,
      confidence,
      language: dgLanguage,
    };
  } catch (error) {
    console.error('Transcription error:', error);
    return {
      success: false,
      error: error.message,
      transcript: '',
    };
  }
}

// ============================================
// TEXT-TO-SPEECH (Voice Output)
// ============================================

export async function textToSpeech(text, options = {}) {
  const {
    model = 'aura-asteria-en', // Default English voice
    language = 'en',
  } = options;

  // Map languages to Deepgram TTS voices
  const voiceMap = {
    'en': 'aura-asteria-en',   // English - Friendly female voice
    'hi': 'aura-asteria-en',   // Hindi (using English for now, Deepgram TTS has limited Hindi)
    'te': 'aura-asteria-en',   // Telugu (using English for now)
  };

  const voice = voiceMap[language] || 'aura-asteria-en';

  try {
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
      throw new Error(`Deepgram TTS error: ${response.status}`);
    }

    const audioBlob = await response.blob();
    return {
      success: true,
      audioBlob,
      audioUrl: URL.createObjectURL(audioBlob),
    };
  } catch (error) {
    console.error('Text-to-speech error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// BROWSER-BASED VOICE RECORDING
// ============================================

export class VoiceRecorder {
  constructor(options = {}) {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.onTranscript = options.onTranscript || (() => {});
    this.onError = options.onError || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.language = options.language || 'en';
  }

  async start() {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Determine best audio format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];

        // Transcribe the audio
        const result = await transcribeAudio(audioBlob, { language: this.language });
        this.onTranscript(result);
      };

      this.mediaRecorder.onerror = (event) => {
        this.onError(event.error);
      };

      this.mediaRecorder.start(250); // Collect data every 250ms
      this.isRecording = true;
      this.onStateChange({ isRecording: true });

    } catch (error) {
      console.error('Error starting recording:', error);
      this.onError(error);
    }
  }

  stop() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.onStateChange({ isRecording: false });

      // Stop all tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
    }
  }

  toggle() {
    if (this.isRecording) {
      this.stop();
    } else {
      this.start();
    }
  }

  setLanguage(language) {
    this.language = language;
  }
}

// ============================================
// BROWSER TTS FALLBACK (Web Speech API)
// ============================================

export function browserSpeak(text, options = {}) {
  const {
    language = 'en',
    rate = 1,
    pitch = 1,
    volume = 1,
  } = options;

  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Map to BCP 47 language codes
    const langMap = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'te': 'te-IN',
      'ta': 'ta-IN',
      'kn': 'kn-IN',
      'mr': 'mr-IN',
    };

    utterance.lang = langMap[language] || 'en-US';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    // Try to find a voice for the language
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(voice => voice.lang.startsWith(language));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => resolve({ success: true });
    utterance.onerror = (event) => reject(event.error);

    window.speechSynthesis.speak(utterance);
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function isMicrophoneSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function isSpeechSynthesisSupported() {
  return 'speechSynthesis' in window;
}

export async function checkMicrophonePermission() {
  try {
    const permission = await navigator.permissions.query({ name: 'microphone' });
    return permission.state; // 'granted', 'denied', or 'prompt'
  } catch {
    return 'unknown';
  }
}
