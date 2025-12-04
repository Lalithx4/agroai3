'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import BackButton from '@/components/layout/BackButton';
import './calendar.css';
import { 
    Plus, Trash2, ChevronLeft, ChevronRight, Sprout, Apple, Wheat, Leaf, Flame,
    MapPin, CloudSun, Droplets, Calendar, Clock, AlertTriangle, CheckCircle,
    Sparkles, Brain, Target, TrendingUp, Bell, Loader2, Thermometer,
    Sun, CloudRain, Wind, Moon
} from 'lucide-react';

// Crop database with growing info
const CROPS_DATABASE = {
    tomato: { 
        label: 'Tomato', icon: Apple, emoji: '🍅',
        growthDays: 80, waterNeed: 'high', tempRange: '20-30°C',
        seasons: ['summer', 'monsoon'], 
        stages: ['Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Harvest']
    },
    rice: { 
        label: 'Rice', icon: Wheat, emoji: '🌾',
        growthDays: 120, waterNeed: 'very-high', tempRange: '22-35°C',
        seasons: ['kharif', 'monsoon'],
        stages: ['Nursery', 'Transplanting', 'Tillering', 'Flowering', 'Harvest']
    },
    wheat: { 
        label: 'Wheat', icon: Wheat, emoji: '🌾',
        growthDays: 120, waterNeed: 'medium', tempRange: '15-25°C',
        seasons: ['rabi', 'winter'],
        stages: ['Sowing', 'Crown Root', 'Tillering', 'Heading', 'Harvest']
    },
    cotton: { 
        label: 'Cotton', icon: Leaf, emoji: '🌿',
        growthDays: 160, waterNeed: 'medium', tempRange: '25-35°C',
        seasons: ['kharif', 'summer'],
        stages: ['Germination', 'Vegetative', 'Squaring', 'Boll Formation', 'Harvest']
    },
    chili: { 
        label: 'Chili', icon: Flame, emoji: '🌶️',
        growthDays: 90, waterNeed: 'medium', tempRange: '20-30°C',
        seasons: ['summer', 'monsoon'],
        stages: ['Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Harvest']
    },
    mango: {
        label: 'Mango', icon: Apple, emoji: '🥭',
        growthDays: 150, waterNeed: 'low', tempRange: '24-30°C',
        seasons: ['summer'],
        stages: ['Dormancy', 'Flowering', 'Fruit Set', 'Growth', 'Harvest']
    },
    banana: {
        label: 'Banana', icon: Apple, emoji: '🍌',
        growthDays: 300, waterNeed: 'high', tempRange: '20-35°C',
        seasons: ['all'],
        stages: ['Planting', 'Vegetative', 'Flowering', 'Bunch Development', 'Harvest']
    },
    groundnut: {
        label: 'Groundnut', icon: Leaf, emoji: '🥜',
        growthDays: 110, waterNeed: 'medium', tempRange: '25-35°C',
        seasons: ['kharif', 'rabi'],
        stages: ['Sowing', 'Vegetative', 'Flowering', 'Pegging', 'Harvest']
    }
};

// Season recommendations based on month
const getSeasonRecommendations = (month) => {
    const seasons = {
        kharif: [5, 6, 7, 8, 9], // June to October
        rabi: [10, 11, 0, 1, 2], // November to March
        summer: [2, 3, 4, 5], // March to June
    };
    
    const recommendations = [];
    Object.entries(CROPS_DATABASE).forEach(([key, crop]) => {
        if (crop.seasons.includes('all')) {
            recommendations.push(key);
        } else {
            if (crop.seasons.includes('kharif') && seasons.kharif.includes(month)) recommendations.push(key);
            if (crop.seasons.includes('rabi') && seasons.rabi.includes(month)) recommendations.push(key);
            if (crop.seasons.includes('summer') && seasons.summer.includes(month)) recommendations.push(key);
        }
    });
    return [...new Set(recommendations)];
};

export default function CalendarPage() {
    const { t, language } = useLanguage();
    const { showToast } = useToast();
    
    const [crops, setCrops] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [formData, setFormData] = useState({ type: 'tomato', date: '', field: '', area: '' });
    const [location, setLocation] = useState(null);
    const [weather, setWeather] = useState(null);
    const [aiAdvice, setAiAdvice] = useState(null);
    const [loadingAdvice, setLoadingAdvice] = useState(false);
    const [selectedCrop, setSelectedCrop] = useState(null);
    const [activeTab, setActiveTab] = useState('calendar');

    // Load saved crops
    useEffect(() => { 
        const saved = localStorage.getItem('cropmagix_crops'); 
        if (saved) setCrops(JSON.parse(saved)); 
        
        // Get location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    fetchWeather(pos.coords.latitude, pos.coords.longitude);
                },
                () => {
                    // Default to Hyderabad
                    setLocation({ lat: 17.385, lng: 78.4867, name: 'Hyderabad' });
                }
            );
        }
    }, []);

    // Fetch weather for location
    const fetchWeather = async (lat, lng) => {
        try {
            const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
            const data = await res.json();
            if (data) setWeather(data);
        } catch (err) {
            console.log('Weather fetch failed');
        }
    };

    // Get AI advice for crops
    const getAIAdvice = async () => {
        if (crops.length === 0) {
            showToast('Add crops first to get AI advice', 'info');
            return;
        }
        
        setLoadingAdvice(true);
        try {
            const cropList = crops.map(c => CROPS_DATABASE[c.type]?.label).join(', ');
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Give me specific farming advice for my crops: ${cropList}. Current month is ${monthNames[currentMonth]}. Include: watering schedule, fertilizer timing, pest alerts, and expected harvest dates. Be concise.`,
                    language
                })
            });
            const data = await response.json();
            if (data.reply) {
                setAiAdvice(data.reply);
            }
        } catch (err) {
            showToast('Could not get AI advice', 'error');
        } finally {
            setLoadingAdvice(false);
        }
    };

    const saveCrops = (newCrops) => { 
        setCrops(newCrops); 
        localStorage.setItem('cropmagix_crops', JSON.stringify(newCrops)); 
    };
    
    const addCrop = () => { 
        if (!formData.date || !formData.field) {
            showToast('Please fill all fields', 'warning');
            return;
        }
        const cropInfo = CROPS_DATABASE[formData.type];
        const plantingDate = new Date(formData.date);
        const harvestDate = new Date(plantingDate);
        harvestDate.setDate(harvestDate.getDate() + cropInfo.growthDays);
        
        const newCrop = { 
            id: Date.now(), 
            type: formData.type, 
            plantingDate: formData.date, 
            fieldName: formData.field,
            area: formData.area || '1 acre',
            harvestDate: harvestDate.toISOString().split('T')[0],
            currentStage: 0,
            notes: []
        };
        
        saveCrops([...crops, newCrop]); 
        setShowModal(false); 
        setFormData({ type: 'tomato', date: '', field: '', area: '' });
        showToast(`${cropInfo.label} added! 🌱`, 'success');
    };
    
    const deleteCrop = (id) => {
        saveCrops(crops.filter(c => c.id !== id));
        showToast('Crop removed', 'info');
    };

    // Calculate crop progress
    const getCropProgress = (crop) => {
        const start = new Date(crop.plantingDate);
        const end = new Date(crop.harvestDate);
        const now = new Date();
        const total = end - start;
        const elapsed = now - start;
        return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    };

    // Get current stage
    const getCurrentStage = (crop) => {
        const progress = getCropProgress(crop);
        const cropInfo = CROPS_DATABASE[crop.type];
        const stageIndex = Math.floor((progress / 100) * (cropInfo.stages.length - 1));
        return cropInfo.stages[Math.min(stageIndex, cropInfo.stages.length - 1)];
    };

    // Get days until harvest
    const getDaysUntilHarvest = (crop) => {
        const harvest = new Date(crop.harvestDate);
        const now = new Date();
        const days = Math.ceil((harvest - now) / (1000 * 60 * 60 * 24));
        return days;
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (m, y) => new Date(y, m, 1).getDay();

    // Check if date has crop events
    const getCropEventsForDay = (day) => {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return crops.filter(c => c.plantingDate === dateStr || c.harvestDate === dateStr);
    };

    const recommendedCrops = getSeasonRecommendations(currentMonth);

    return (
        <section className="screen active calendar-page">
            {/* Header */}
            <div className="calendar-header">
                <BackButton />
                <h2><Calendar size={20} /> {t('cropCalendar')}</h2>
                <button className="add-btn primary" onClick={() => setShowModal(true)}>
                    <Plus size={20} />
                </button>
            </div>

            {/* Weather Banner */}
            {weather && (
                <div className="weather-banner">
                    <div className="weather-info">
                        <Thermometer size={18} />
                        <span>{weather.temperature || weather.current?.temp || '28'}°C</span>
                    </div>
                    <div className="weather-info">
                        <Droplets size={18} />
                        <span>{weather.humidity || weather.current?.humidity || '65'}%</span>
                    </div>
                    <div className="weather-info">
                        <MapPin size={18} />
                        <span>{weather.location || location?.name || 'Your Location'}</span>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="calendar-tabs">
                <button 
                    className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
                    onClick={() => setActiveTab('calendar')}
                >
                    <Calendar size={16} /> Calendar
                </button>
                <button 
                    className={`tab ${activeTab === 'crops' ? 'active' : ''}`}
                    onClick={() => setActiveTab('crops')}
                >
                    <Sprout size={16} /> My Crops ({crops.length})
                </button>
                <button 
                    className={`tab ${activeTab === 'ai' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai')}
                >
                    <Brain size={16} /> AI Advisor
                </button>
            </div>

            <div className="calendar-content">
                {/* Calendar Tab */}
                {activeTab === 'calendar' && (
                    <>
                        {/* Mini Calendar */}
                        <div className="calendar-card">
                            <div className="calendar-nav">
                                <button onClick={() => { 
                                    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } 
                                    else setCurrentMonth(m => m - 1); 
                                }}>
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="month-label">{monthNames[currentMonth]} {currentYear}</span>
                                <button onClick={() => { 
                                    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } 
                                    else setCurrentMonth(m => m + 1); 
                                }}>
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                            
                            <div className="calendar-grid">
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                    <div key={d} className="day-header">{d}</div>
                                ))}
                                {Array(getFirstDayOfMonth(currentMonth, currentYear)).fill(null).map((_, i) => (
                                    <div key={`e${i}`} className="day empty"></div>
                                ))}
                                {Array(getDaysInMonth(currentMonth, currentYear)).fill(null).map((_, i) => {
                                    const day = i + 1;
                                    const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
                                    const events = getCropEventsForDay(day);
                                    
                                    return (
                                        <div 
                                            key={i} 
                                            className={`day ${isToday ? 'today' : ''} ${events.length > 0 ? 'has-event' : ''}`}
                                        >
                                            {day}
                                            {events.length > 0 && (
                                                <div className="event-dots">
                                                    {events.slice(0, 3).map((e, idx) => (
                                                        <span 
                                                            key={idx} 
                                                            className="event-dot"
                                                            style={{ background: e.plantingDate.includes(`-${String(day).padStart(2, '0')}`) ? '#10b981' : '#f59e0b' }}
                                                        ></span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Season Recommendations */}
                        <div className="recommendations-card">
                            <h4><Sparkles size={18} /> Recommended for {monthNames[currentMonth]}</h4>
                            <div className="crop-chips">
                                {recommendedCrops.map(cropKey => {
                                    const crop = CROPS_DATABASE[cropKey];
                                    return (
                                        <button 
                                            key={cropKey} 
                                            className="crop-chip"
                                            onClick={() => {
                                                setFormData({ ...formData, type: cropKey });
                                                setShowModal(true);
                                            }}
                                        >
                                            <span>{crop.emoji}</span>
                                            {crop.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* Crops Tab */}
                {activeTab === 'crops' && (
                    <div className="crops-list">
                        {crops.length === 0 ? (
                            <div className="empty-state">
                                <Sprout size={48} strokeWidth={1.5} />
                                <h3>No crops yet</h3>
                                <p>Add your first crop to start tracking</p>
                                <button className="add-crop-btn" onClick={() => setShowModal(true)}>
                                    <Plus size={18} /> Add Your First Crop
                                </button>
                            </div>
                        ) : (
                            crops.map(crop => {
                                const cropInfo = CROPS_DATABASE[crop.type];
                                const progress = getCropProgress(crop);
                                const stage = getCurrentStage(crop);
                                const daysLeft = getDaysUntilHarvest(crop);
                                
                                return (
                                    <div key={crop.id} className="crop-card">
                                        <div className="crop-card-header">
                                            <div className="crop-icon-wrap">
                                                <span className="crop-emoji">{cropInfo.emoji}</span>
                                            </div>
                                            <div className="crop-info">
                                                <h4>{cropInfo.label}</h4>
                                                <span className="crop-field">{crop.fieldName} • {crop.area}</span>
                                            </div>
                                            <button className="delete-btn" onClick={() => deleteCrop(crop.id)}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        
                                        <div className="crop-progress">
                                            <div className="progress-bar">
                                                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                                            </div>
                                            <div className="progress-labels">
                                                <span>{progress}% Complete</span>
                                                <span className="stage-badge">{stage}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="crop-stats">
                                            <div className="stat">
                                                <Calendar size={14} />
                                                <span>Planted: {new Date(crop.plantingDate).toLocaleDateString()}</span>
                                            </div>
                                            <div className="stat">
                                                <Target size={14} />
                                                <span>
                                                    {daysLeft > 0 
                                                        ? `${daysLeft} days to harvest` 
                                                        : daysLeft === 0 
                                                            ? '🎉 Harvest today!' 
                                                            : 'Ready to harvest!'}
                                                </span>
                                            </div>
                                            <div className="stat">
                                                <Droplets size={14} />
                                                <span>Water: {cropInfo.waterNeed}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* AI Advisor Tab */}
                {activeTab === 'ai' && (
                    <div className="ai-advisor">
                        <div className="ai-header">
                            <div className="ai-avatar">
                                <Brain size={32} />
                            </div>
                            <div>
                                <h3>AI Farming Advisor</h3>
                                <p>Get personalized advice for your crops</p>
                            </div>
                        </div>
                        
                        <button 
                            className="get-advice-btn"
                            onClick={getAIAdvice}
                            disabled={loadingAdvice || crops.length === 0}
                        >
                            {loadingAdvice ? (
                                <><Loader2 size={18} className="spin" /> Analyzing...</>
                            ) : (
                                <><Sparkles size={18} /> Get AI Advice for My Crops</>
                            )}
                        </button>
                        
                        {aiAdvice && (
                            <div className="ai-advice-card">
                                <div className="advice-content">
                                    {aiAdvice.split('\n').map((line, i) => (
                                        <p key={i}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {crops.length === 0 && (
                            <div className="ai-empty">
                                <AlertTriangle size={24} />
                                <p>Add crops first to get personalized advice</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add Crop Modal */}
            {showModal && (
                <div className="modal">
                    <div className="modal-overlay" onClick={() => setShowModal(false)}></div>
                    <div className="modal-box">
                        <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        <h3><Sprout size={24} /> Add New Crop</h3>
                        
                        <div className="crop-type-grid">
                            {Object.entries(CROPS_DATABASE).map(([key, crop]) => (
                                <button
                                    key={key}
                                    className={`crop-type-btn ${formData.type === key ? 'selected' : ''}`}
                                    onClick={() => setFormData({ ...formData, type: key })}
                                >
                                    <span className="emoji">{crop.emoji}</span>
                                    <span>{crop.label}</span>
                                </button>
                            ))}
                        </div>
                        
                        <div className="form-group">
                            <label><Calendar size={16} /> Planting Date</label>
                            <input 
                                type="date" 
                                value={formData.date} 
                                onChange={e => setFormData({ ...formData, date: e.target.value })} 
                            />
                        </div>
                        
                        <div className="form-group">
                            <label><MapPin size={16} /> Field Name</label>
                            <input 
                                type="text" 
                                placeholder="e.g., North Field" 
                                value={formData.field} 
                                onChange={e => setFormData({ ...formData, field: e.target.value })} 
                            />
                        </div>
                        
                        <div className="form-group">
                            <label><Target size={16} /> Area</label>
                            <input 
                                type="text" 
                                placeholder="e.g., 2 acres" 
                                value={formData.area} 
                                onChange={e => setFormData({ ...formData, area: e.target.value })} 
                            />
                        </div>
                        
                        {formData.type && (
                            <div className="crop-info-preview">
                                <div className="info-item">
                                    <Clock size={14} />
                                    <span>{CROPS_DATABASE[formData.type].growthDays} days to harvest</span>
                                </div>
                                <div className="info-item">
                                    <Thermometer size={14} />
                                    <span>Best: {CROPS_DATABASE[formData.type].tempRange}</span>
                                </div>
                            </div>
                        )}
                        
                        <button className="submit-btn" onClick={addCrop}>
                            <Plus size={18} /> Add Crop
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
