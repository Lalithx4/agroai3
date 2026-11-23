'use client';

import { toWav } from '@/lib/audio-wav';
import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import BackButton from '@/components/layout/BackButton';
import { chatWithPlant } from '@/services/api';
import { saveChatMessage, getChatHistory } from '@/lib/supabase';
import './chat.css';
import { 
    Sprout, Volume2, VolumeX, Mic, Send, HelpCircle, Droplets, 
    Lightbulb, Loader2, StopCircle, Leaf, Bug, Sun, CloudRain,
    Thermometer, Scissors, Sparkles, Heart, Brain,
    FlaskConical, Calendar, MapPin, Wheat, Apple, TreeDeciduous
} from 'lucide-react';
import { Sprout as NbSprout } from 'lucide-react';

// Plant personalities for more engaging chat
const plantPersonalities = {
    default: { emoji: '🌱', name: 'Sage', mood: 'friendly' },
    tomato: { emoji: '🍅', name: 'Tommy', mood: 'enthusiastic' },
    rose: { emoji: '🌹', name: 'Rosa', mood: 'elegant' },
    mango: { emoji: '🥭', name: 'Mango Max', mood: 'tropical' },
    rice: { emoji: '🌾', name: 'Paddy', mood: 'wise' },
    wheat: { emoji: '🌾', name: 'Wheaty', mood: 'hardy' },
};

// Suggested topics for users - with translations
const suggestedTopics = [
    { id: 'disease', icon: Bug, text: { en: 'Identify disease', hi: 'रोग पहचानें', te: 'వ్యాధి గుర్తించు' }, color: 'var(--ink-2)' },
    { id: 'water', icon: Droplets, text: { en: 'Watering tips', hi: 'सिंचाई सुझाव', te: 'నీటి చిట్కాలు' }, color: 'var(--ink-2)' },
    { id: 'fertilizer', icon: FlaskConical, text: { en: 'Fertilizer advice', hi: 'खाद सलाह', te: 'ఎరువు సలహా' }, color: 'var(--ink-2)' },
    { id: 'season', icon: Calendar, text: { en: 'Seasonal care', hi: 'मौसमी देखभाल', te: 'కాలానుగుణ సంరక్షణ' }, color: 'var(--ink-2)' },
    { id: 'harvest', icon: Apple, text: { en: 'Harvest time', hi: 'कटाई का समय', te: 'కోత సమయం' }, color: 'var(--ink-2)' },
    { id: 'pest', icon: Bug, text: { en: 'Pest control', hi: 'कीट नियंत्रण', te: 'తెగులు నియంత్రణ' }, color: 'var(--ink-2)' },
];

export default function ChatPage() {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const hasInitialized = useRef(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioRef = useRef(null);
    
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [currentPlant, setCurrentPlant] = useState(plantPersonalities.default);
    const [showTopics, setShowTopics] = useState(true);
    const [sessionId] = useState(() => 'session_' + Date.now());

    // Speak a reply: Sarvam (native Hindi/Telugu voices) first, then Deepgram (English only), then the browser.
    const speakReply = async (text, lang = 'en') => {
        const spoken = String(text).replace(/[*_#`>]/g, '').replace(/\n+/g, '. ').trim();
        if (!spoken) return;
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        window.speechSynthesis?.cancel();
        setIsSpeaking(true);
        const attempts = [
            () => fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: spoken, language: lang, level: 1 }) }),
            ...(lang === 'en' ? [() => fetch('/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: spoken, language: lang }) })] : []),
        ];
        for (const attempt of attempts) {
            try {
                const response = await attempt();
                if (!response.ok) continue;
                const url = URL.createObjectURL(await response.blob());
                const audio = new Audio(url);
                audioRef.current = audio;
                audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
                audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
                await audio.play();
                return;
            } catch {
                // try the next voice
            }
        }
        fallbackToWebSpeech(spoken, lang);
    };

    // Last resort: the device's own voice, in the right language.
    const fallbackToWebSpeech = (text, lang) => {
        if (!('speechSynthesis' in window)) { setIsSpeaking(false); return; }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN';
        const voice = window.speechSynthesis.getVoices().find((v) => v.lang === utterance.lang);
        if (voice) utterance.voice = voice;
        utterance.rate = 0.95;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    // Load chat history on mount
    useEffect(() => {
        const loadHistory = async () => {
            if (!hasInitialized.current) {
                hasInitialized.current = true;
                try {
                    const history = await getChatHistory(null, null, 20);
                    if (history && history.length > 0) {
                        const formattedHistory = history.map(msg => ({
                            sender: msg.role === 'user' ? 'user' : 'plant',
                            text: msg.content,
                            time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }));
                        setMessages(formattedHistory);
                        setShowTopics(false);
                    } else {
                        addMessage('plant', getWelcomeMessage(), false);
                    }
                } catch (err) {
                    addMessage('plant', getWelcomeMessage(), false);
                }
            }
        };
        loadHistory();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const getWelcomeMessage = () => {
        const greetings = {
            en: `Hello, I'm ${currentPlant.name}. Ask me anything about your crop: watering, pests, spots on the leaves, fertiliser, what to sow next. What are you growing?`,
            hi: `नमस्ते, मैं ${currentPlant.name} हूँ। अपनी फसल के बारे में कुछ भी पूछो: पानी, कीड़े, पत्तों पर धब्बे, खाद, आगे क्या बोना है। आप क्या उगा रहे हो?`,
            te: `నమస్తే, నేను ${currentPlant.name}. మీ పంట గురించి ఏదైనా అడగండి: నీళ్ళు, పురుగులు, ఆకులపై మచ్చలు, ఎరువులు, తర్వాత ఏం విత్తాలి. మీరు ఏం పండిస్తున్నారు?`
        };
        return greetings[language] || greetings.en;
    };

    const addMessage = (sender, text, saveToSupabase = true) => {
        const newMessage = {
            sender,
            text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            id: Date.now() + Math.random(),
            isWelcome: sender === 'plant' && !saveToSupabase,
        };
        setMessages(prev => [...prev, newMessage]);
        
        if (saveToSupabase) {
            saveChatMessage({
                role: sender === 'user' ? 'user' : 'assistant',
                content: text,
                session_id: sessionId,
            }).catch(() => {});
        }
    };

    // Voice Recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: true } 
            });
            
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus' : 'audio/webm';
            
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                stream.getTracks().forEach(track => track.stop());
                await transcribeAudio(audioBlob);
            };
            
            mediaRecorderRef.current.start(250);
            setIsRecording(true);
            showToast(language === 'te' ? 'వింటోంది... మాట్లాడండి!' : language === 'hi' ? 'सुन रहा हूं... बोलें!' : 'Listening... Speak now!', 'info');
        } catch (err) {
            showToast(language === 'te' ? 'మైక్రోఫోన్ అనుమతి ఇవ్వండి' : language === 'hi' ? 'माइक्रोफोन अनुमति दें' : 'Please allow microphone access', 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const transcribeAudio = async (audioBlob) => {
        setIsTranscribing(true);
        try {
            const formData = new FormData();
            formData.append('audio', await toWav(audioBlob), 'speech.wav');
            formData.append('language', language);
            
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (data.transcript) {
                setInputValue(data.transcript);
                showToast(language === 'te' ? 'అర్థమైంది!' : language === 'hi' ? 'समझ गया!' : 'Got it!', 'success');
                setTimeout(() => {
                    if (data.transcript.trim()) {
                        sendMessageWithText(data.transcript);
                    }
                }, 500);
            } else {
                showToast(language === 'te' ? 'అర్థం కాలేదు. మళ్ళీ ప్రయత్నించండి?' : language === 'hi' ? 'समझ नहीं आया। फिर से कोशिश करें?' : 'Could not understand. Try again?', 'warning');
            }
        } catch (err) {
            showToast(language === 'te' ? 'వాయిస్ విఫలమైంది. టైప్ చేయండి?' : language === 'hi' ? 'वॉयस विफल हुआ। टाइप करें?' : 'Voice failed. Type instead?', 'error');
        } finally {
            setIsTranscribing(false);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const sendMessageWithText = async (text) => {
        const message = text.trim();
        if (!message) return;

        setInputValue('');
        setShowTopics(false);
        addMessage('user', message);
        setIsTyping(true);

        try {
            // Send the recent conversation so the plant remembers what was said.
            const history = messages
                .filter((m) => !m.isWelcome)
                .slice(-10)
                .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));
            const startedAt = Date.now();
            const response = await chatWithPlant(message, currentPlant.name, 'unknown', [], language, history);
            if (response?.response || response?.reply) {
                const replyText = response.response || response.reply;
                // A short, length-based "typing" pause reads as a person replying, not a machine.
                const typingMs = Math.min(1400, 350 + replyText.length * 6) - (Date.now() - startedAt);
                if (typingMs > 0) await new Promise((r) => setTimeout(r, typingMs));
                addMessage('plant', replyText);
                if (ttsEnabled) {
                    speakReply(replyText, language);
                }
            } else {
                addMessage('plant', getFallbackResponse());
            }
        } catch {
            addMessage('plant', getErrorResponse());
        } finally {
            setIsTyping(false);
        }
    };

    const sendMessage = () => sendMessageWithText(inputValue);

    const getFallbackResponse = () => {
        const responses = {
            en: "I'm here to help with your plants! Try asking about watering, diseases, or seasonal care. ",
            hi: "मैं आपके पौधों की मदद के लिए यहां हूं! सिंचाई, बीमारियों या मौसमी देखभाल के बारे में पूछें। ",
            te: "నేను మీ మొక్కలకు సహాయం చేయడానికి ఇక్కడ ఉన్నాను! నీటిపారుదల, వ్యాధులు లేదా కాలానుగుణ సంరక్షణ గురించి అడగండి। "
        };
        return responses[language] || responses.en;
    };

    const getErrorResponse = () => {
        const responses = {
            en: "Oops! I had a little hiccup. Please try asking again!",
            hi: "उफ़! थोड़ी समस्या हुई। कृपया फिर से पूछें!",
            te: "అయ్యో! చిన్న సమస్య వచ్చింది। దయచేసి మళ్ళీ అడగండి!"
        };
        return responses[language] || responses.en;
    };

    const handleTopicClick = (topic) => {
        const topicQuestions = {
            disease: { en: "How can I identify if my plant has a disease?", hi: "मैं कैसे पहचानूं कि मेरे पौधे में बीमारी है?", te: "నా మొక్కకు వ్యాధి ఉందా అని ఎలా గుర్తించగలను?" },
            water: { en: "What's the best watering schedule for my crops?", hi: "मेरी फसलों के लिए सबसे अच्छा सिंचाई समय क्या है?", te: "నా పంటలకు ఉత్తమ నీటిపారుదల షెడ్యూల్ ఏమిటి?" },
            fertilizer: { en: "What fertilizers should I use for healthy growth?", hi: "स्वस्थ विकास के लिए कौन सी खाद उपयोग करूं?", te: "ఆరోగ్యకరమైన పెరుగుదలకు ఏ ఎరువులు వాడాలి?" },
            season: { en: "What seasonal care does my plant need right now?", hi: "मेरे पौधे को अभी कौन सी मौसमी देखभाल चाहिए?", te: "నా మొక్కకు ప్రస్తుతం ఏ కాలానుగుణ సంరక్షణ అవసరం?" },
            harvest: { en: "When is the best time to harvest my crop?", hi: "मेरी फसल काटने का सबसे अच्छा समय कब है?", te: "నా పంట కోతకు ఉత్తమ సమయం ఎప్పుడు?" },
            pest: { en: "How can I protect my plants from pests naturally?", hi: "मैं अपने पौधों को कीटों से कैसे बचाऊं?", te: "సహజంగా తెగుళ్ల నుండి నా మొక్కలను ఎలా రక్షించగలను?" },
        };
        const question = topicQuestions[topic.id]?.[language] || topicQuestions[topic.id]?.en;
        if (question) {
            sendMessageWithText(question);
        }
    };

    return (
        <div className="chat-page">
            {/* Header */}
            <div className="chat-header">
                <BackButton />
                <div className="chat-plant-info">
                    <div className="plant-avatar">
                        <NbSprout className="plant-emoji-large" size={24} aria-hidden="true" />
                        <span className="online-dot"></span>
                    </div>
                    <div className="plant-details">
                        <span className="plant-name">{currentPlant.name}</span>
                        <span className="plant-status">
                            {isTyping ? (
                                <><Sparkles size={12} className="typing-sparkle" /> {language === 'te' ? 'ఆలోచిస్తోంది...' : language === 'hi' ? 'सोच रहा हूं...' : 'Thinking...'}</>
                            ) : (
                                <><span className="status-dot"></span> {language === 'te' ? 'ఆన్‌లైన్' : language === 'hi' ? 'ऑनलाइन' : 'Online'}</>
                            )}
                        </span>
                    </div>
                </div>
                <div className="header-actions">
                    <button 
                        className={`header-btn ${ttsEnabled ? 'active' : ''} ${isSpeaking ? 'speaking' : ''}`} 
                        onClick={() => {
                            setTtsEnabled(!ttsEnabled);
                            // Stop any playing audio
                            if (audioRef.current) {
                                audioRef.current.pause();
                                audioRef.current = null;
                            }
                            window.speechSynthesis?.cancel();
                            setIsSpeaking(false);
                        }}
                        title={ttsEnabled ? 'Mute voice' : 'Enable voice'}
                    >
                        {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>
                </div>
            </div>

            {/* Chat Body */}
            <div className="chat-body">
                {/* Suggested Topics */}
                {showTopics && messages.length <= 1 && (
                    <div className="topics-section">
                        <p className="topics-title">
                            <Brain size={16} /> {language === 'te' ? 'త్వరిత అంశాలు' : language === 'hi' ? 'त्वरित विषय' : 'Quick Topics'}
                        </p>
                        <div className="topics-grid">
                            {suggestedTopics.map((topic) => (
                                <button
                                    key={topic.id}
                                    className="topic-card"
                                    onClick={() => handleTopicClick(topic)}
                                    style={{ '--topic-color': topic.color }}
                                >
                                    <topic.icon size={20} />
                                    <span>{topic.text[language] || topic.text.en}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div className="chat-messages">
                    {messages.map((msg, idx) => (
                        <div 
                            key={msg.id || idx} 
                            className={`message ${msg.sender}`}
                            style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                            {msg.sender === 'plant' && (
                                <div className="message-avatar" aria-hidden="true">
                                    <NbSprout size={18} />
                                </div>
                            )}
                            <div className="message-content">
                                <div className="message-bubble">
                                    {msg.text.split('\n').map((line, i) => (
                                        <span key={i}>{line}<br/></span>
                                    ))}
                                </div>
                                <div className="message-time">{msg.time}</div>
                            </div>
                        </div>
                    ))}
                    
                    {isTyping && (
                        <div className="message plant typing">
                            <div className="message-avatar" aria-hidden="true"><NbSprout size={18} /></div>
                            <div className="message-content">
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="chat-input-area">
                <div className="input-container">
                    <button 
                        className={`input-btn mic-btn ${isRecording ? 'recording' : ''} ${isTranscribing ? 'processing' : ''}`}
                        onClick={toggleRecording}
                        disabled={isTranscribing}
                    >
                        {isTranscribing ? (
                            <Loader2 size={20} className="spin" />
                        ) : isRecording ? (
                            <StopCircle size={20} />
                        ) : (
                            <Mic size={20} />
                        )}
                    </button>
                    
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder={
                            isRecording 
                                ? (language === 'te' ? 'వింటోంది...' : language === 'hi' ? 'सुन रहा हूं...' : 'Listening...') 
                                : isTranscribing 
                                    ? (language === 'te' ? 'ప్రాసెస్ చేస్తోంది...' : language === 'hi' ? 'प्रोसेस हो रहा है...' : 'Processing...') 
                                    : (language === 'te' ? 'మొక్కల గురించి ఏదైనా అడగండి...' : language === 'hi' ? 'पौधों के बारे में कुछ भी पूछें...' : 'Ask anything about plants...')
                        }
                        disabled={isRecording || isTranscribing}
                        className="chat-input"
                    />
                    
                    <button 
                        className="input-btn send-btn"
                        onClick={sendMessage}
                        disabled={!inputValue.trim() || isRecording || isTyping}
                    >
                        <Send size={20} />
                    </button>
                </div>
                
                <p className="input-hint">
                    {language === 'te' ? 'జవాబులు తెలుగులో' : language === 'hi' ? 'जवाब हिंदी में' : 'Answers in English'} · {language === 'te' ? 'పిచికారీ ముందు వ్యవసాయ అధికారిని అడగండి' : language === 'hi' ? 'छिड़काव से पहले कृषि अधिकारी से पूछें' : 'Check with your agriculture officer before spraying'}
                </p>
            </div>
        </div>
    );
}
