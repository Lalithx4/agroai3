'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'next/navigation';
import { analyzeHealth } from '@/services/api';
import { addScanToHistory } from '@/services/cache';
import { saveScanHistory } from '@/lib/supabase';
import './scanner.css';
import ArOverlay from './ArOverlay';
import ScanReport from './ScanReport';
import { getAnsweredCall, clearCall } from '@/lib/plant-call';
import {
    ArrowLeft,
    FolderOpen,
    Camera,
    Zap,
    ZapOff,
    X,
    CheckCircle,
    AlertTriangle,
    Loader2,
    Droplets,
    Thermometer,
    Leaf,
    FlaskConical,
    Sun,
    Bug,
    Lightbulb,
    Settings,
    ScanLine,
    Sparkles,
    Eye,
    Heart,
    Info,
    Wifi,
    WifiOff,
    Activity,
    HelpCircle,
    Stethoscope
} from 'lucide-react';
import { Sprout as NbSprout, Info as NbInfo, Target as NbTarget } from 'lucide-react';
import { ScanSearch, ImageUp, RefreshCw, CameraOff as CameraOffIcon } from 'lucide-react';

const CAM_COPY = {
    en: {
        title: 'Let\'s look at a leaf',
        why: {
            denied: 'Camera permission is blocked. Tap the lock icon in the address bar, allow Camera, then try again.',
            none: 'No camera was found on this device. Upload a clear photo of the leaf instead.',
            insecure: 'The camera only works on a secure (https) page. Upload a photo, or open the https link.',
            busy: 'The camera is busy in another app or tab. Close it and try again.',
        },
        retry: 'Try camera again',
        upload: 'Upload a leaf photo',
        tipsTitle: 'For the best answer',
        tips: ['Daylight, no flash', 'One leaf, close up', 'Show the spots clearly'],
    },
    hi: {
        title: 'आइए एक पत्ती देखें',
        why: {
            denied: 'कैमरे की अनुमति बंद है। एड्रेस बार में ताले पर टैप करें, कैमरा चालू करें, फिर दोबारा कोशिश करें।',
            none: 'इस डिवाइस में कैमरा नहीं मिला। पत्ती की साफ़ फोटो अपलोड करें।',
            insecure: 'कैमरा सिर्फ़ सुरक्षित (https) पेज पर चलता है। फोटो अपलोड करें या https लिंक खोलें।',
            busy: 'कैमरा किसी दूसरे ऐप या टैब में चल रहा है। उसे बंद करके दोबारा कोशिश करें।',
        },
        retry: 'कैमरा फिर से चालू करें',
        upload: 'पत्ती की फोटो अपलोड करें',
        tipsTitle: 'सबसे अच्छे जवाब के लिए',
        tips: ['दिन की रोशनी, फ्लैश नहीं', 'एक पत्ती, पास से', 'धब्बे साफ़ दिखें'],
    },
    te: {
        title: 'ఒక ఆకును చూద్దాం',
        why: {
            denied: 'కెమెరా అనుమతి ఆపివేయబడింది. అడ్రస్ బార్‌లో తాళం గుర్తుపై నొక్కి, కెమెరాను అనుమతించి, మళ్లీ ప్రయత్నించండి.',
            none: 'ఈ పరికరంలో కెమెరా కనిపించలేదు. ఆకు యొక్క స్పష్టమైన ఫోటోను అప్‌లోడ్ చేయండి.',
            insecure: 'కెమెరా సురక్షిత (https) పేజీలో మాత్రమే పనిచేస్తుంది. ఫోటో అప్‌లోడ్ చేయండి లేదా https లింక్ తెరవండి.',
            busy: 'కెమెరా మరో యాప్ లేదా ట్యాబ్‌లో వాడుకలో ఉంది. దాన్ని మూసి మళ్లీ ప్రయత్నించండి.',
        },
        retry: 'కెమెరాను మళ్లీ ప్రయత్నించండి',
        upload: 'ఆకు ఫోటో అప్‌లోడ్ చేయండి',
        tipsTitle: 'మంచి జవాబు కోసం',
        tips: ['పగటి వెలుతురు, ఫ్లాష్ వద్దు', 'ఒక ఆకు, దగ్గరగా', 'మచ్చలు స్పష్టంగా కనిపించాలి'],
    },
};

/** Shown when the live camera cannot start: says why, offers retry and upload. */
function CameraOff({ reason, language, onRetry, onUpload }) {
    const c = CAM_COPY[language] || CAM_COPY.en;
    const TIP_ICONS = [Sun, Leaf, ScanSearch];
    return (
        <div className="scanner-error">
            <div className="camoff">
                <div className="camoff-frame" aria-hidden="true">
                    <i /><i /><i /><i />
                    <Leaf size={56} strokeWidth={1.4} />
                    <span className="camoff-off"><CameraOffIcon size={18} /></span>
                </div>
                <h2>{c.title}</h2>
                <p className="camoff-why">{c.why[reason] || c.why.busy}</p>
                <div className="camoff-actions">
                    <button type="button" className="camoff-btn is-primary" onClick={onUpload}>
                        <ImageUp size={20} aria-hidden="true" /> {c.upload}
                    </button>
                    {reason !== 'none' && reason !== 'insecure' && (
                        <button type="button" className="camoff-btn" onClick={onRetry}>
                            <RefreshCw size={18} aria-hidden="true" /> {c.retry}
                        </button>
                    )}
                </div>
                <div className="camoff-tips">
                    <span className="camoff-tips-title">{c.tipsTitle}</span>
                    <ul>
                        {c.tips.map((tip, i) => {
                            const Icon = TIP_ICONS[i];
                            return <li key={tip}><Icon size={16} aria-hidden="true" /> {tip}</li>;
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default function ScannerPage() {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    const router = useRouter();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [resultImage, setResultImage] = useState(null);
    const [cameraError, setCameraError] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const lastPhotoRef = useRef(null);   // the photo in the open report, kept so a wrong plant name can be corrected
    
    // AR mode: the live overlay runs its own scan loop (ArOverlay.jsx)
    // An answered plant call (lib/plant-call.js) opens straight into the live camera, already talking.
    const [call] = useState(() => (typeof window !== 'undefined' ? getAnsweredCall() : null));
    const [isARMode, setIsARMode] = useState(() => !!call);
    useEffect(() => { if (call) clearCall(); }, [call]);

    useEffect(() => {
        startCamera();
        return () => { 
            stream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    const toggleARMode = () => setIsARMode((on) => !on);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            setStream(mediaStream);
            if (videoRef.current) videoRef.current.srcObject = mediaStream;
            setCameraError(false);
        } catch (err) {
            // Why the camera is off decides what we tell the farmer.
            const reason = !window.isSecureContext ? 'insecure'
                : err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'denied'
                : err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError' ? 'none'
                : 'busy';
            setCameraError(reason);
        }
    };

    const toggleFlash = async () => {
        if (stream) {
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities?.();
            if (capabilities?.torch) {
                await track.applyConstraints({ advanced: [{ torch: !isFlashOn }] });
                setIsFlashOn(!isFlashOn);
            } else {
                showToast('Flash not available', 'info');
            }
        }
    };

    // plant: the name the live view already settled on ({plant_name, display_name, scientific_name}), so the report agrees with it.
    const captureImage = useCallback(async (plant = null) => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsCapturing(true);
        setTimeout(() => setIsCapturing(false), 500);

        setIsAnalyzing(true);
        const canvas = canvasRef.current, video = videoRef.current;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(async (blob) => { if (blob) await analyzeImage(blob, plant); }, 'image/jpeg', 0.9);
    }, []);

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (file) { setIsAnalyzing(true); await analyzeImage(file); e.target.value = ''; }
    };

    const analyzeImage = async (imageBlob, plant = null, imageUrl = null) => {
        try {
            const url = imageUrl || URL.createObjectURL(imageBlob);
            lastPhotoRef.current = { blob: imageBlob, url };
            setResultImage(url);
            const result = await analyzeHealth(imageBlob, plant?.display_name || plant?.plant_name || null, null, plant?.scientific_name || null);
            if (!result) throw new Error('empty result');
            setAnalysisResult(result);
            if (!result.not_plant) {
                // Save to local cache
                addScanToHistory({ ...result, image: url, timestamp: Date.now() });
                // Save to Supabase for persistence
                saveScanHistory(result).catch(err => console.log('Supabase save error:', err));
            }
            showToast(t('analysisResult'), 'success');
        } catch {
            showToast(t('analysisFailed'), 'error');
            setAnalysisResult(null);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // The farmer says the name is wrong: redo the report for the same photo with their name.
    const correctPlant = async (name, scientific = null) => {
        const photo = lastPhotoRef.current;
        if (!photo || !name) return;
        setIsAnalyzing(true);
        await analyzeImage(photo.blob, { plant_name: name, scientific_name: scientific }, photo.url);
    };

    const closeResult = () => {
        setAnalysisResult(null);
        setResultImage(null);
    };

    const tipIcons = [Droplets, Thermometer, Leaf, FlaskConical, Sun];

    return (
        <div className="scanner-page">
            {/* Fullscreen Camera */}
            {cameraError ? (
                <CameraOff
                    reason={cameraError}
                    language={language}
                    onRetry={startCamera}
                    onUpload={() => fileInputRef.current?.click()}
                />
            ) : (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="scanner-camera"
                />
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Floating Header */}
            <div className="scanner-floating-header">
                <button className="scanner-header-btn" onClick={() => router.back()}>
                    <ArrowLeft size={22} />
                </button>

                <div className="scanner-status-pill">
                    <span className={`status-dot ${isAnalyzing ? 'analyzing' : isARMode ? 'ar-active' : cameraError ? 'is-off' : ''}`} />
                    <span>{isAnalyzing ? 'Analyzing…' : isARMode ? 'Live view' : cameraError ? 'Camera off' : 'Ready to scan'}</span>
                </div>

                <button 
                    className={`scanner-header-btn ${isARMode ? 'ar-active' : ''}`}
                    onClick={toggleARMode}
                    title="Toggle AR Mode"
                >
                    {isARMode ? <Eye size={22} /> : <ScanLine size={22} />}
                </button>
            </div>

            {/* Live AR overlay */}
            {isARMode && !cameraError && (
                <ArOverlay
                    videoRef={videoRef}
                    language={call?.language || language}
                    call={call}
                    onFullReport={(plant) => { setIsARMode(false); captureImage(plant); }}
                />
            )}

            {/* Scanning Focus Ring - Modified for AR */}
            {!cameraError && !isARMode && (
                <div className={`scanner-focus-ring ${isAnalyzing ? 'active' : ''}`}>
                    <div className="focus-ring-outer" />
                    <div className="focus-ring-middle" />
                    <div className="focus-ring-inner" />
                    <div className="focus-crosshair">
                        <div className="crosshair-h" />
                        <div className="crosshair-v" />
                    </div>
                </div>
            )}

            {/* Bottom Control Dock */}
            <div className={`scanner-dock ${isARMode ? 'ar-mode' : ''}`}>
                <button
                    className="dock-btn"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <FolderOpen size={24} />
                    <span>Gallery</span>
                </button>

                {isARMode ? (
                    <button
                        className="ar-mode-btn active"
                        onClick={toggleARMode}
                    >
                        <Eye size={28} />
                        <span className="ar-pulse" />
                    </button>
                ) : (
                    <button
                        className={`capture-btn ${isCapturing ? 'capturing' : ''}`}
                        onClick={captureImage}
                        disabled={isAnalyzing || cameraError}
                    >
                        {isAnalyzing ? (
                            <Loader2 size={28} className="spin" />
                        ) : (
                            <Camera size={28} />
                        )}
                    </button>
                )}

                <button 
                    className={`dock-btn ${isARMode ? 'active' : ''}`}
                    onClick={toggleARMode}
                >
                    <Eye size={24} />
                    <span>Live</span>
                </button>
            </div>

            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                hidden
                onChange={handleFileSelect}
            />

            {/* Loading Overlay */}
            {isAnalyzing && (
                <div className="scanner-loading">
                    <div className="loading-ring">
                        <div className="loading-ring-inner" />
                    </div>
                    <p>Analyzing your plant...</p>
                    <span className="loading-subtitle">This may take a few seconds</span>
                </div>
            )}

            {/* Result Panel - COMPREHENSIVE */}
            <div className={`result-panel ${analysisResult ? 'open' : ''}`}>
                <div className="result-panel-header">
                    <h2>Plant Analysis Report</h2>
                    <button className="result-close-btn" onClick={closeResult}>
                        <X size={22} />
                    </button>
                </div>

                {analysisResult && (
                    <div className="result-content">
                        <ScanReport
                            key={`${analysisResult.plant_type}-${analysisResult.identification?.given ? 'given' : 'auto'}`}
                            result={analysisResult}
                            image={resultImage}
                            language={language}
                            onScanAgain={closeResult}
                            onCorrectPlant={correctPlant}
                            onTalk={cameraError ? null : () => { closeResult(); setIsARMode(true); }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
