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
        } catch {
            setCameraError(true);
            showToast('Camera access denied', 'error');
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

    const captureImage = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsCapturing(true);
        setTimeout(() => setIsCapturing(false), 500);

        setIsAnalyzing(true);
        const canvas = canvasRef.current, video = videoRef.current;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(async (blob) => { if (blob) await analyzeImage(blob); }, 'image/jpeg', 0.9);
    }, []);

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (file) { setIsAnalyzing(true); await analyzeImage(file); e.target.value = ''; }
    };

    const analyzeImage = async (imageBlob) => {
        try {
            const imageUrl = URL.createObjectURL(imageBlob);
            setResultImage(imageUrl);
            const result = await analyzeHealth(imageBlob);
            if (result) {
                setAnalysisResult(result);
                // Save to local cache
                addScanToHistory({ ...result, image: imageUrl, timestamp: Date.now() });
                // Save to Supabase for persistence
                saveScanHistory(result).catch(err => console.log('Supabase save error:', err));
                showToast(t('analysisResult'), 'success');
            } else {
                // Fallback demo result
                setAnalysisResult({
                    health_status: 'healthy',
                    plant_name: 'Tomato Plant',
                    confidence: 0.92,
                    diseases: [],
                    recommendations: ['Keep watering regularly', 'Good sunlight exposure', 'Monitor for pests']
                });
            }
        } catch {
            showToast(t('analysisFailed'), 'error');
            setAnalysisResult(null);
        } finally {
            setIsAnalyzing(false);
        }
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
                <div className="scanner-error">
                    <div className="scanner-error-content">
                        <Camera size={64} strokeWidth={1.5} />
                        <h2>Camera Unavailable</h2>
                        <p>Please allow camera access or upload an image</p>
                        <button
                            className="scanner-upload-btn"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FolderOpen size={20} />
                            Upload Image
                        </button>
                    </div>
                </div>
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
                    <span className={`status-dot ${isAnalyzing ? 'analyzing' : isARMode ? 'ar-active' : ''}`} />
                    <span>{isAnalyzing ? 'Analyzing…' : isARMode ? 'Live view' : 'Ready to scan'}</span>
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
                    onFullReport={() => { setIsARMode(false); captureImage(); }}
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
                            result={analysisResult}
                            image={resultImage}
                            language={language}
                            onScanAgain={closeResult}
                            onTalk={cameraError ? null : () => { closeResult(); setIsARMode(true); }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
