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


// Below 70% the accuracy ladder found answers unreliable, so we say so plainly.
const UNSURE_BELOW = 70;
function scanVerdict(r) {
    const issue = r.diagnosis?.primary_issue || r.diseases?.[0]?.name || '';
    if (r.confidence != null && r.confidence < UNSURE_BELOW) {
        return { cls: 'unsure', Icon: HelpCircle, title: 'Not sure yet', sub: `${issue ? `It may be ${issue.toLowerCase()}. ` : ''}Take another photo in daylight, closer to the leaf, or show it to your agriculture officer.` };
    }
    if (r.health_status === 'healthy') {
        return { cls: 'healthy', Icon: CheckCircle, title: 'Looks healthy', sub: 'Keep checking the plant every few days.' };
    }
    if (r.health_status === 'critical') {
        return { cls: 'serious', Icon: AlertTriangle, title: 'Serious problem', sub: `${issue ? `Likely ${issue.toLowerCase()}. ` : ''}Show this to your agriculture officer soon.` };
    }
    return { cls: 'care', Icon: AlertTriangle, title: 'Needs care', sub: issue ? `Likely ${issue.toLowerCase()}. The treatment is below.` : 'The details and treatment are below.' };
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
    
    // AR mode: the live overlay runs its own scan loop (ArOverlay.jsx)
    const [isARMode, setIsARMode] = useState(false);

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
                    language={language}
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
                        {/* Captured Image */}
                        {resultImage && (
                            <div className="result-image-container">
                                <img src={resultImage} alt="Analyzed plant" />
                            </div>
                        )}

                        {/* Bento Grid Results */}
                        <div className="result-bento">
                            {/* Plant Identity Card */}
                            <div className="bento-card full-width plant-identity">
                                <div className="plant-identity-header">
                                    <div className="plant-emoji-large" aria-hidden="true"><NbSprout size={28} /></div>
                                    <div className="plant-names">
                                        <h3>{analysisResult.plant_type || analysisResult.plant_name || 'Unknown Plant'}</h3>
                                        {analysisResult.plant_species && (
                                            <span className="scientific-name">{analysisResult.plant_species}</span>
                                        )}
                                        {analysisResult.crop_category && (
                                            <span className="crop-badge">{analysisResult.crop_category}</span>
                                        )}
                                    </div>
                                </div>
                                {analysisResult.growth_stage && (
                                    <div className="growth-stage">
                                        <Leaf size={16} />
                                        <span>Growth Stage: {analysisResult.growth_stage}</span>
                                    </div>
                                )}
                            </div>

                            {/* Verdict (EXPERIENCE.md State Patterns): shown before any detail */}
                            {(() => {
                                const v = scanVerdict(analysisResult);
                                const conf = Math.round(analysisResult.confidence ?? 0);
                                return (
                                    <div className={`bento-card full-width scan-verdict ${v.cls}`} role="status" aria-live="polite">
                                        <div className="scan-verdict-head">
                                            <v.Icon size={30} strokeWidth={2} aria-hidden="true" />
                                            <div>
                                                <h3>{v.title}</h3>
                                                <p>{v.sub}</p>
                                            </div>
                                        </div>
                                        {analysisResult.confidence != null && (
                                            <div className="scan-confidence">
                                                <div className="scan-confidence-bar" aria-hidden="true">
                                                    <span style={{ width: `${Math.min(100, Math.max(0, conf))}%` }} />
                                                </div>
                                                <span className="scan-confidence-num">About {conf}% sure</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Summary Card */}
                            {analysisResult.summary && (
                                <div className="bento-card full-width summary-card">
                                    <div className="bento-card-header">
                                        <Info size={20} />
                                        <h4>Summary</h4>
                                    </div>
                                    <p className="summary-text">{analysisResult.summary}</p>
                                </div>
                            )}

                            {/* Diagnosis Card */}
                            {analysisResult.diagnosis && (
                                <div className="bento-card full-width diagnosis-card">
                                    <div className="bento-card-header">
                                        <Stethoscope size={20} />
                                        <h4>Diagnosis</h4>
                                    </div>
                                    <div className="diagnosis-content">
                                        <div className="diagnosis-primary">
                                            <strong>Primary Issue:</strong> {analysisResult.diagnosis.primary_issue}
                                        </div>
                                        {analysisResult.diagnosis.urgency_level && (
                                            <div className={`urgency-badge ${analysisResult.diagnosis.urgency_level}`}>
                                                Urgency: {analysisResult.diagnosis.urgency_level}
                                            </div>
                                        )}
                                        {analysisResult.diagnosis.prognosis && (
                                            <div className="prognosis">
                                                <strong>Prognosis:</strong> {analysisResult.diagnosis.prognosis}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Diseases Card */}
                            {analysisResult.diseases?.length > 0 && (
                                <div className="bento-card full-width diseases-card">
                                    <div className="bento-card-header">
                                        <Bug size={20} />
                                        <h4>Detected Diseases</h4>
                                    </div>
                                    <div className="disease-list">
                                        {analysisResult.diseases.map((d, i) => (
                                            <div key={i} className="disease-item-full">
                                                <div className="disease-header">
                                                    <span className="disease-name">{d.name}</span>
                                                    <span className={`disease-severity ${d.severity || 'medium'}`}>
                                                        {d.severity || 'medium'}
                                                    </span>
                                                </div>
                                                {d.type && <span className="disease-type">Type: {d.type}</span>}
                                                {d.description && <p className="disease-desc">{d.description}</p>}
                                                {d.affected_parts?.length > 0 && (
                                                    <div className="affected-parts">
                                                        <strong>Affected:</strong> {d.affected_parts.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Causes Card - WHY IT HAPPENED */}
                            {analysisResult.causes?.length > 0 && (
                                <div className="bento-card full-width causes-card">
                                    <div className="bento-card-header">
                                        <HelpCircle size={20} />
                                        <h4>Why This Happened</h4>
                                    </div>
                                    <div className="causes-list">
                                        {analysisResult.causes.map((cause, i) => (
                                            <div key={i} className="cause-item">
                                                <div className="cause-header">
                                                    <span className="cause-factor">{cause.factor}</span>
                                                    <span className={`cause-likelihood ${cause.likelihood}`}>
                                                        {cause.likelihood} likelihood
                                                    </span>
                                                </div>
                                                <p className="cause-explanation">{cause.explanation}</p>
                                                {cause.prevention && (
                                                    <div className="cause-prevention">
                                                        <strong>Prevention:</strong> {cause.prevention}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Treatment Plan Card */}
                            {analysisResult.treatment_plan && (
                                <div className="bento-card full-width treatment-card">
                                    <div className="bento-card-header">
                                        <Activity size={20} />
                                        <h4>Treatment Plan</h4>
                                    </div>
                                    <div className="treatment-sections">
                                        {analysisResult.treatment_plan.immediate?.length > 0 && (
                                            <div className="treatment-section urgent">
                                                <h5>Immediate (Today)</h5>
                                                <ul>
                                                    {analysisResult.treatment_plan.immediate.map((item, i) => (
                                                        <li key={i}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {analysisResult.treatment_plan.daily?.length > 0 && (
                                            <div className="treatment-section daily">
                                                <h5>Daily Care</h5>
                                                <ul>
                                                    {analysisResult.treatment_plan.daily.map((item, i) => (
                                                        <li key={i}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {analysisResult.treatment_plan.weekly?.length > 0 && (
                                            <div className="treatment-section weekly">
                                                <h5>Weekly Care</h5>
                                                <ul>
                                                    {analysisResult.treatment_plan.weekly.map((item, i) => (
                                                        <li key={i}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {analysisResult.treatment_plan.long_term?.length > 0 && (
                                            <div className="treatment-section longterm">
                                                <h5>Long-term Strategy</h5>
                                                <ul>
                                                    {analysisResult.treatment_plan.long_term.map((item, i) => (
                                                        <li key={i}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Fertilizer Recommendations */}
                            {analysisResult.fertilizer_recommendations?.length > 0 && (
                                <div className="bento-card full-width fertilizer-card">
                                    <div className="bento-card-header">
                                        <FlaskConical size={20} />
                                        <h4>Fertilizer Recommendations</h4>
                                    </div>
                                    <div className="fertilizer-list">
                                        {analysisResult.fertilizer_recommendations.map((fert, i) => (
                                            <div key={i} className="fertilizer-item">
                                                <div className="fert-header">
                                                    <span className="fert-type">{fert.type || fert.name}</span>
                                                </div>
                                                {fert.purpose && <p><strong>Purpose:</strong> {fert.purpose}</p>}
                                                {fert.dosage && <p><strong>Dosage:</strong> {fert.dosage}</p>}
                                                {fert.frequency && <p><strong>Frequency:</strong> {fert.frequency}</p>}
                                                {fert.organic_alternative && (
                                                    <p className="organic-alt">Organic: {fert.organic_alternative}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Organic Remedies */}
                            {analysisResult.organic_remedies?.length > 0 && (
                                <div className="bento-card full-width organic-card">
                                    <div className="bento-card-header">
                                        <Leaf size={20} />
                                        <h4>Organic Remedies</h4>
                                    </div>
                                    <div className="organic-list">
                                        {analysisResult.organic_remedies.map((remedy, i) => (
                                            <div key={i} className="organic-item">
                                                <h5>{remedy.name}</h5>
                                                {remedy.ingredients && <p><strong>Ingredients:</strong> {remedy.ingredients}</p>}
                                                {remedy.preparation && <p><strong>Preparation:</strong> {remedy.preparation}</p>}
                                                {remedy.application && <p><strong>How to apply:</strong> {remedy.application}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Ideal Conditions */}
                            {analysisResult.ideal_conditions && (
                                <div className="bento-card full-width conditions-card">
                                    <div className="bento-card-header">
                                        <Sun size={20} />
                                        <h4>Ideal Growing Conditions</h4>
                                    </div>
                                    <div className="conditions-grid">
                                        {analysisResult.ideal_conditions.temperature_optimal && (
                                            <div className="condition-item">
                                                <Thermometer size={18} />
                                                <span>Temp: {analysisResult.ideal_conditions.temperature_optimal}</span>
                                            </div>
                                        )}
                                        {analysisResult.ideal_conditions.humidity && (
                                            <div className="condition-item">
                                                <Droplets size={18} />
                                                <span>Humidity: {analysisResult.ideal_conditions.humidity}</span>
                                            </div>
                                        )}
                                        {analysisResult.ideal_conditions.sunlight_hours && (
                                            <div className="condition-item">
                                                <Sun size={18} />
                                                <span>Sunlight: {analysisResult.ideal_conditions.sunlight_hours}</span>
                                            </div>
                                        )}
                                        {analysisResult.ideal_conditions.soil_ph && (
                                            <div className="condition-item">
                                                <FlaskConical size={18} />
                                                <span>Soil pH: {analysisResult.ideal_conditions.soil_ph}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Watering Schedule */}
                            {analysisResult.watering_schedule && (
                                <div className="bento-card full-width watering-card">
                                    <div className="bento-card-header">
                                        <Droplets size={20} />
                                        <h4>Watering Guide</h4>
                                    </div>
                                    <div className="watering-info">
                                        {analysisResult.watering_schedule.frequency && (
                                            <p><strong>Frequency:</strong> {analysisResult.watering_schedule.frequency}</p>
                                        )}
                                        {analysisResult.watering_schedule.best_time && (
                                            <p><strong>Best Time:</strong> {analysisResult.watering_schedule.best_time}</p>
                                        )}
                                        {analysisResult.watering_schedule.current_recommendation && (
                                            <p className="current-rec">{analysisResult.watering_schedule.current_recommendation}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Quick Tips */}
                            {analysisResult.quick_tips?.length > 0 && (
                                <div className="bento-card full-width tips-card">
                                    <div className="bento-card-header">
                                        <Lightbulb size={20} />
                                        <h4>Quick Tips</h4>
                                    </div>
                                    <div className="quick-tips-grid">
                                        {analysisResult.quick_tips.map((tip, i) => (
                                            <div key={i} className="quick-tip-item">
                                                <span className="tip-icon">{tip.icon}</span>
                                                <div>
                                                    <strong>{tip.title}</strong>
                                                    <p>{tip.tip}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recommendations Card */}
                            {analysisResult.recommendations?.length > 0 && (
                                <div className="bento-card full-width recommendations-card">
                                    <div className="bento-card-header">
                                        <CheckCircle size={20} />
                                        <h4>Top Recommendations</h4>
                                    </div>
                                    <div className="tips-list">
                                        {analysisResult.recommendations.map((tip, i) => {
                                            const TipIcon = tipIcons[i % tipIcons.length];
                                            return (
                                                <div key={i} className="tip-card">
                                                    <div className="tip-icon">
                                                        <TipIcon size={20} />
                                                    </div>
                                                    <div className="tip-content">
                                                        <p>{tip}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="result-actions">
                            <button className="result-action-btn secondary" onClick={closeResult}>
                                Scan Again
                            </button>
                            <button className="result-action-btn primary">
                                Save to History
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
