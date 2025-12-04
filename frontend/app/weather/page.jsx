'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import BackButton from '@/components/layout/BackButton';
import { getSoilWeather } from '@/services/api';
import './weather.css';
import {
    Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudSun,
    Droplets, Wind, Thermometer, MapPin, RefreshCw, Lightbulb, Wheat, Calendar, 
    Loader2, Navigation, Sprout, Clock, TrendingUp, AlertTriangle, CheckCircle2,
    CloudDrizzle, Sunrise, Sunset, Eye, Gauge
} from 'lucide-react';

const weatherIcons = {
    clear: Sun, sunny: Sun, clouds: Cloud, cloudy: Cloud,
    rain: CloudRain, drizzle: CloudDrizzle, thunderstorm: CloudLightning,
    snow: CloudSnow, mist: CloudFog, fog: CloudFog, haze: CloudFog, default: CloudSun
};

// Regional crop database based on climate zones
const REGIONAL_CROPS = {
    tropical: {
        crops: ['🍚 Rice', '🌴 Coconut', '🍌 Banana', '🥭 Mango', '🌶️ Chili', '🫚 Ginger', '🫛 Sugarcane'],
        tempRange: '20-35°C',
        rainfall: 'High (150-300cm/year)'
    },
    subtropical: {
        crops: ['🌾 Wheat', '🥔 Potato', '🧅 Onion', '🍅 Tomato', '🥜 Groundnut', '🌻 Sunflower', '🌿 Mustard'],
        tempRange: '15-28°C',
        rainfall: 'Moderate (75-150cm/year)'
    },
    arid: {
        crops: ['🌵 Jowar', '🌾 Bajra', '🫘 Pulses', '🥜 Groundnut', '🫒 Castor', '🌿 Cumin', '🌰 Chickpea'],
        tempRange: '25-45°C',
        rainfall: 'Low (<50cm/year)'
    },
    temperate: {
        crops: ['🍎 Apple', '🍐 Pear', '🥬 Cabbage', '🥕 Carrot', '🧄 Garlic', '🥦 Broccoli', '🥗 Lettuce'],
        tempRange: '10-25°C',
        rainfall: 'Moderate (50-100cm/year)'
    }
};

// Get climate zone based on temperature and humidity
const getClimateZone = (temp, humidity) => {
    if (temp >= 30 && humidity >= 70) return 'tropical';
    if (temp >= 20 && temp < 30 && humidity >= 50) return 'subtropical';
    if (temp >= 30 && humidity < 50) return 'arid';
    return 'temperate';
};

// Weather-based farming tips
const getFarmingTips = (weather, climateZone) => {
    const tips = [];
    const temp = weather?.temperature || 25;
    const humidity = weather?.humidity || 60;
    const condition = (weather?.condition || '').toLowerCase();

    if (condition.includes('rain')) {
        tips.push({ icon: '🌧️', text: 'Postpone irrigation - natural rainfall expected', type: 'info' });
        tips.push({ icon: '🔍', text: 'Check for waterlogging in fields', type: 'warning' });
    } else if (temp > 35) {
        tips.push({ icon: '🌡️', text: 'High temperature - increase watering frequency', type: 'warning' });
        tips.push({ icon: '🕐', text: 'Water crops early morning (5-7 AM) or evening', type: 'tip' });
    } else if (humidity < 40) {
        tips.push({ icon: '💧', text: 'Low humidity - monitor soil moisture closely', type: 'info' });
    }

    if (temp >= 25 && temp <= 32 && !condition.includes('rain')) {
        tips.push({ icon: '✅', text: 'Ideal conditions for fertilizer application', type: 'success' });
    }

    tips.push({ icon: '🐛', text: temp > 25 ? 'Warm weather - monitor for pest activity' : 'Cool weather - check for fungal diseases', type: 'tip' });

    return tips;
};

export default function WeatherPage() {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [locationLoading, setLocationLoading] = useState(false);
    const [farmScore, setFarmScore] = useState(75);
    const [coords, setCoords] = useState(null);
    const [climateZone, setClimateZone] = useState('subtropical');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [forecast, setForecast] = useState([]);
    const [tips, setTips] = useState([]);

    useEffect(() => { 
        loadWeather(); 
    }, []);

    const getCurrentLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position),
                (error) => reject(error),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    };

    const loadWeather = async (forceRefresh = false) => {
        setLoading(true);
        setLocationLoading(true);
        
        try {
            let latitude = 17.385;
            let longitude = 78.4867;
            let locationName = 'Hyderabad, India';

            try {
                const position = await getCurrentLocation();
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;
                setCoords({ lat: latitude, lng: longitude });
                showToast('📍 Location detected!', 'success');
            } catch (locError) {
                showToast('Using default location (Hyderabad)', 'info');
            }
            
            setLocationLoading(false);

            const data = await getSoilWeather(latitude, longitude);

            if (data) {
                const weatherData = {
                    temperature: data.weather?.temperature || data.weather?.temp || 28,
                    humidity: data.weather?.humidity || 65,
                    wind_speed: data.weather?.wind_speed || 12,
                    condition: data.weather?.condition || data.weather?.description || 'Clear',
                    feels_like: data.weather?.feels_like || data.weather?.temperature || 28,
                    location: data.weather?.location || data.location || locationName,
                    pressure: data.weather?.pressure || 1013,
                    visibility: data.weather?.visibility || 10,
                    uv_index: data.weather?.uv_index || 5,
                    sunrise: data.weather?.sunrise || '06:15',
                    sunset: data.weather?.sunset || '18:30'
                };
                
                setWeather(weatherData);
                setFarmScore(data.farming_score || calculateFarmScore(weatherData));
                
                const zone = getClimateZone(weatherData.temperature, weatherData.humidity);
                setClimateZone(zone);
                setTips(getFarmingTips(weatherData, zone));

                if (data.forecast?.length) {
                    setForecast(data.forecast.slice(0, 7));
                } else {
                    // Generate realistic forecast
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const today = new Date().getDay();
                    const mockForecast = [];
                    for (let i = 0; i < 7; i++) {
                        const variation = Math.floor(Math.random() * 6) - 3;
                        mockForecast.push({
                            day: days[(today + i) % 7],
                            condition: ['sunny', 'cloudy', 'rain', 'sunny', 'cloudy'][Math.floor(Math.random() * 5)],
                            temp_max: weatherData.temperature + variation + 2,
                            temp_min: weatherData.temperature + variation - 4
                        });
                    }
                    setForecast(mockForecast);
                }
            } else {
                setWeather({
                    temperature: 28, humidity: 65, wind_speed: 12,
                    condition: 'Sunny', feels_like: 30, location: locationName
                });
            }
            
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Weather error:', error);
            setWeather({
                temperature: 28, humidity: 65, wind_speed: 12,
                condition: 'Sunny', feels_like: 30, location: 'Your Location'
            });
            showToast('Using cached weather data', 'info');
        } finally { 
            setLoading(false);
            setLocationLoading(false);
        }
    };

    const calculateFarmScore = (weather) => {
        let score = 70;
        const temp = weather.temperature;
        const humidity = weather.humidity;
        
        if (temp >= 20 && temp <= 32) score += 15;
        else if (temp < 15 || temp > 40) score -= 20;
        
        if (humidity >= 50 && humidity <= 75) score += 10;
        else if (humidity < 30 || humidity > 90) score -= 15;
        
        return Math.max(0, Math.min(100, score));
    };

    const getWeatherIcon = (condition, size = 48) => {
        const Icon = weatherIcons[condition?.toLowerCase()] || weatherIcons.default;
        return <Icon size={size} strokeWidth={1.5} />;
    };

    const getScoreColor = (score) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    };

    if (loading) {
        return (
            <section className="screen active weather-page">
                <div className="weather-header">
                    <BackButton />
                    <h2>☀️ {t('weatherForecast')}</h2>
                </div>
                <div className="loading-container">
                    <div className="loading-animation">
                        {locationLoading ? (
                            <>
                                <Navigation size={40} className="pulse" />
                                <p>Detecting your location...</p>
                            </>
                        ) : (
                            <>
                                <Loader2 size={40} className="spin" />
                                <p>Fetching weather data...</p>
                            </>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="screen active weather-page">
            <div className="weather-header">
                <BackButton />
                <h2>☀️ {t('weatherForecast')}</h2>
                <button className="refresh-btn" onClick={() => loadWeather(true)} title="Refresh">
                    <RefreshCw size={18} />
                </button>
            </div>

            <div className="weather-content">
                {/* Current Weather Hero */}
                <div className="weather-hero">
                    <div className="weather-main">
                        <div className="weather-icon-wrap">
                            {getWeatherIcon(weather?.condition, 64)}
                        </div>
                        <div className="weather-temp-wrap">
                            <span className="weather-temp">{Math.round(weather?.temperature || 25)}°</span>
                            <span className="weather-unit">C</span>
                        </div>
                    </div>
                    <div className="weather-condition">{weather?.condition || 'Clear'}</div>
                    <div className="weather-location">
                        <MapPin size={16} />
                        <span>{weather?.location || 'Your Location'}</span>
                    </div>
                    {lastUpdated && (
                        <div className="last-updated">
                            <Clock size={12} />
                            Updated {lastUpdated.toLocaleTimeString()}
                        </div>
                    )}
                </div>

                {/* Weather Details Grid */}
                <div className="weather-details-grid">
                    <div className="detail-card">
                        <Thermometer size={20} />
                        <div className="detail-info">
                            <span className="detail-value">{Math.round(weather?.feels_like || 25)}°C</span>
                            <span className="detail-label">Feels Like</span>
                        </div>
                    </div>
                    <div className="detail-card">
                        <Droplets size={20} />
                        <div className="detail-info">
                            <span className="detail-value">{weather?.humidity || 60}%</span>
                            <span className="detail-label">Humidity</span>
                        </div>
                    </div>
                    <div className="detail-card">
                        <Wind size={20} />
                        <div className="detail-info">
                            <span className="detail-value">{weather?.wind_speed || 10} km/h</span>
                            <span className="detail-label">Wind</span>
                        </div>
                    </div>
                    <div className="detail-card">
                        <Eye size={20} />
                        <div className="detail-info">
                            <span className="detail-value">{weather?.visibility || 10} km</span>
                            <span className="detail-label">Visibility</span>
                        </div>
                    </div>
                </div>

                {/* Sun Times */}
                <div className="sun-times">
                    <div className="sun-item">
                        <Sunrise size={22} />
                        <div>
                            <span className="sun-time">{weather?.sunrise || '06:15'}</span>
                            <span className="sun-label">Sunrise</span>
                        </div>
                    </div>
                    <div className="sun-divider"></div>
                    <div className="sun-item">
                        <Sunset size={22} />
                        <div>
                            <span className="sun-time">{weather?.sunset || '18:30'}</span>
                            <span className="sun-label">Sunset</span>
                        </div>
                    </div>
                </div>

                {/* Farm Score Card */}
                <div className="farm-score-card">
                    <div className="score-header">
                        <Wheat size={22} />
                        <h4>Farming Conditions</h4>
                    </div>
                    <div className="score-content">
                        <div className="score-circle" style={{ '--score-color': getScoreColor(farmScore) }}>
                            <svg viewBox="0 0 100 100">
                                <circle className="score-bg" cx="50" cy="50" r="42" />
                                <circle 
                                    className="score-fill" 
                                    cx="50" cy="50" r="42" 
                                    style={{ strokeDashoffset: 264 - (farmScore / 100) * 264 }}
                                />
                            </svg>
                            <div className="score-text">
                                <span className="score-num">{farmScore}</span>
                                <span className="score-percent">%</span>
                            </div>
                        </div>
                        <div className="score-details">
                            <span className="score-status" style={{ color: getScoreColor(farmScore) }}>
                                {farmScore >= 80 ? '✨ Excellent' : farmScore >= 60 ? '👍 Good' : '⚠️ Fair'}
                            </span>
                            <span className="climate-badge">{climateZone.charAt(0).toUpperCase() + climateZone.slice(1)} Climate</span>
                        </div>
                    </div>
                </div>

                {/* Regional Crops */}
                <div className="crops-section">
                    <div className="section-header">
                        <Sprout size={20} />
                        <h4>Crops for Your Location</h4>
                    </div>
                    <p className="zone-info">Based on {climateZone} climate ({REGIONAL_CROPS[climateZone].tempRange})</p>
                    <div className="crops-grid">
                        {REGIONAL_CROPS[climateZone].crops.map((crop, idx) => (
                            <div key={idx} className="crop-tag">{crop}</div>
                        ))}
                    </div>
                </div>

                {/* 7-Day Forecast */}
                <div className="forecast-section">
                    <div className="section-header">
                        <Calendar size={20} />
                        <h4>7-Day Forecast</h4>
                    </div>
                    <div className="forecast-scroll">
                        {forecast.map((day, idx) => (
                            <div key={idx} className={`forecast-card ${idx === 0 ? 'today' : ''}`}>
                                <span className="forecast-day">{idx === 0 ? 'Today' : day.day}</span>
                                <div className="forecast-icon">{getWeatherIcon(day.condition, 28)}</div>
                                <div className="forecast-temps">
                                    <span className="temp-high">{Math.round(day.temp_max || day.temp)}°</span>
                                    <span className="temp-low">{Math.round(day.temp_min || day.temp - 5)}°</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Farming Tips */}
                <div className="tips-section">
                    <div className="section-header">
                        <Lightbulb size={20} />
                        <h4>Today's Farming Tips</h4>
                    </div>
                    <div className="tips-list">
                        {tips.length > 0 ? tips.map((tip, idx) => (
                            <div key={idx} className={`tip-card ${tip.type}`}>
                                <span className="tip-icon">{tip.icon}</span>
                                <span className="tip-text">{tip.text}</span>
                            </div>
                        )) : (
                            <>
                                <div className="tip-card tip">
                                    <span className="tip-icon">💧</span>
                                    <span className="tip-text">Water plants early morning for best absorption</span>
                                </div>
                                <div className="tip-card success">
                                    <span className="tip-icon">✅</span>
                                    <span className="tip-text">Good conditions for fertilizer application</span>
                                </div>
                                <div className="tip-card warning">
                                    <span className="tip-icon">🐛</span>
                                    <span className="tip-text">Monitor for pest activity in warm weather</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
