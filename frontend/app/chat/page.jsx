'use client';

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
    Thermometer, Scissors, Sparkles, Heart, Zap, Brain,
    FlaskConical, Calendar, MapPin, Wheat, Apple, TreeDeciduous
} from 'lucide-react';

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
    { id: 'disease', icon: Bug, text: { en: 'Identify disease', hi: 'रोग पहचानें', te: 'వ్యాధి గుర్తించు' }, color: '#ef4444' },
    { id: 'water', icon: Droplets, text: { en: 'Watering tips', hi: 'सिंचाई सुझाव', te: 'నీటి చిట్కాలు' }, color: '#3b82f6' },
    { id: 'fertilizer', icon: FlaskConical, text: { en: 'Fertilizer advice', hi: 'खाद सलाह', te: 'ఎరువు సలహా' }, color: '#10b981' },
    { id: 'season', icon: Calendar, text: { en: 'Seasonal care', hi: 'मौसमी देखभाल', te: 'కాలానుగుణ సంరక్షణ' }, color: '#f59e0b' },
    { id: 'harvest', icon: Apple, text: { en: 'Harvest time', hi: 'कटाई का समय', te: 'కోత సమయం' }, color: '#8b5cf6' },
    { id: 'pest', icon: Bug, text: { en: 'Pest control', hi: 'कीट नियंत्रण', te: 'తెగులు నియంత్రణ' }, color: '#ec4899' },
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

    // Deepgram TTS function
    const speakWithDeepgram = async (text, lang = 'en') => {
        try {
            setIsSpeaking(true);
            
            // Stop any currently playing audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            
            // Call our API endpoint for Deepgram TTS
            const response = await fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, language: lang })
            });
            
            if (!response.ok) {
                throw new Error('TTS failed');
            }
            
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            audioRef.current = new Audio(audioUrl);
            audioRef.current.onended = () => {
                setIsSpeaking(false);
                URL.revokeObjectURL(audioUrl);
            };
            audioRef.current.onerror = () => {
                setIsSpeaking(false);
                // Fallback to browser TTS
                fallbackToWebSpeech(text, lang);
            };
            await audioRef.current.play();
        } catch (error) {
            console.log('Deepgram TTS failed, using fallback:', error);
            setIsSpeaking(false);
            fallbackToWebSpeech(text, lang);
        }
    };
    
    // Fallback to browser TTS if Deepgram fails
    const fallbackToWebSpeech = (text, lang) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-US';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
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
            en: `Hey there! 👋 I'm ${currentPlant.name} ${currentPlant.emoji}, your AI plant companion!\n\nI can help you with:\n🌿 Plant care & growth tips\n🔬 Disease diagnosis\n💧 Watering schedules\n🌡️ Weather-based advice\n🌾 Crop recommendations\n\nWhat would you like to know today?`,
            hi: `नमस्ते! 👋 मैं ${currentPlant.name} ${currentPlant.emoji} हूं, आपका AI पौधा साथी!\n\nमैं आपकी मदद कर सकता हूं:\n🌿 पौधों की देखभाल\n🔬 रोग निदान\n💧 सिंचाई सुझाव\n🌡️ मौसम सलाह\n🌾 फसल सिफारिशें\n\nआज क्या जानना चाहते हैं?`,
            te: `హలో! 👋 నేను ${currentPlant.name} ${currentPlant.emoji}, మీ AI మొక్క స్నేహితుడిని!\n\nనేను సహాయం చేయగలను:\n🌿 మొక్కల సంరక్షణ\n🔬 వ్యాధి నిర్ధారణ\n💧 నీటిపారుదల చిట్కాలు\n🌡️ వాతావరణ సలహా\n🌾 పంట సిఫార్సులు\n\nఈరోజు ఏమి తెలుసుకోవాలనుకుంటున్నారు?`
        };
        return greetings[language] || greetings.en;
    };

    const addMessage = (sender, text, saveToSupabase = true) => {
        const newMessage = {
            sender,
            text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            id: Date.now()
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
            showToast(language === 'te' ? '🎤 వింటోంది... మాట్లాడండి!' : language === 'hi' ? '🎤 सुन रहा हूं... बोलें!' : '🎤 Listening... Speak now!', 'info');
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
            formData.append('audio', audioBlob);
            formData.append('language', language);
            
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (data.transcript) {
                setInputValue(data.transcript);
                showToast(language === 'te' ? '✅ అర్థమైంది!' : language === 'hi' ? '✅ समझ गया!' : '✅ Got it!', 'success');
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
            // Pass correct parameters: message, plantType, healthStatus, diseases (array), language
            const response = await chatWithPlant(message, currentPlant.name, 'unknown', [], language);
            if (response?.response || response?.reply) {
                await new Promise(r => setTimeout(r, 500));
                const replyText = response.response || response.reply;
                addMessage('plant', replyText);
                
                // Use Deepgram TTS for voice output
                if (ttsEnabled) {
                    speakWithDeepgram(replyText, language);
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
            en: "I'm here to help with your plants! Try asking about watering, diseases, or seasonal care. 🌿",
            hi: "मैं आपके पौधों की मदद के लिए यहां हूं! सिंचाई, बीमारियों या मौसमी देखभाल के बारे में पूछें। 🌿",
            te: "నేను మీ మొక్కలకు సహాయం చేయడానికి ఇక్కడ ఉన్నాను! నీటిపారుదల, వ్యాధులు లేదా కాలానుగుణ సంరక్షణ గురించి అడగండి। 🌿"
        };
        return responses[language] || responses.en;
    };

    const getErrorResponse = () => {
        const responses = {
            en: "Oops! I had a little hiccup. 🌱 Please try asking again!",
            hi: "उफ़! थोड़ी समस्या हुई। 🌱 कृपया फिर से पूछें!",
            te: "అయ్యో! చిన్న సమస్య వచ్చింది। 🌱 దయచేసి మళ్ళీ అడగండి!"
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
                        <span className="plant-emoji-large">{currentPlant.emoji}</span>
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
                                <div className="message-avatar">
                                    {currentPlant.emoji}
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
                            <div className="message-avatar">{currentPlant.emoji}</div>
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
                                ? (language === 'te' ? '🎤 వింటోంది...' : language === 'hi' ? '🎤 सुन रहा हूं...' : '🎤 Listening...') 
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
                    <Zap size={12} /> {language === 'te' ? 'AI ద్వారా ఆధారితం' : language === 'hi' ? 'AI द्वारा संचालित' : 'Powered by AI'} • {language === 'te' ? 'తెలుగు' : language === 'hi' ? 'हिंदी' : 'English'}
                </p>
            </div>
        </div>
    );
}
