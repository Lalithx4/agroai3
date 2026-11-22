/**
 * Weather Service - Enhanced
 * Fetches weather data and provides farming advice
 * Uses Open-Meteo API (FREE, no API key required!)
 * Now with 7-day forecast, crop alerts, and multilingual support
 */

// Reverse geocoding helper function using free Nominatim API (no key required)
async function getLocationName(latitude, longitude) {
    try {
        // Use OpenStreetMap's Nominatim (free, no API key needed)
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CropmagiX/1.0 (Agricultural Weather App)'
            }
        });
        const data = await response.json();
        
        if (data && data.address) {
            // Build a nice location name from the address components
            const addr = data.address;
            const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
            const state = addr.state || addr.region || '';
            
            if (city && state) {
                return `${city}, ${state}`;
            } else if (city) {
                return city;
            } else if (state) {
                return state;
            } else if (data.display_name) {
                // Fallback to first part of display name
                return data.display_name.split(',').slice(0, 2).join(',').trim();
            }
        }
    } catch (error) {
        console.log('Reverse geocoding failed:', error.message);
    }
    return null;
}

// Weather code to description mapping for Open-Meteo
const weatherCodeMap = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
};

function getConditionFromWeatherCode(code) {
    if (code === 0 || code === 1) return 'sunny';
    if (code === 2 || code === 3) return 'cloudy';
    if (code >= 45 && code <= 48) return 'fog';
    if (code >= 51 && code <= 67) return 'rain';
    if (code >= 71 && code <= 86) return 'snow';
    if (code >= 95) return 'thunderstorm';
    return 'cloudy';
}

// Crop-specific temperature and humidity preferences
const cropPreferences = {
    rice: { tempMin: 20, tempMax: 35, humidityMin: 70, humidityMax: 90, waterNeed: 'high' },
    wheat: { tempMin: 10, tempMax: 25, humidityMin: 40, humidityMax: 70, waterNeed: 'medium' },
    tomato: { tempMin: 18, tempMax: 30, humidityMin: 50, humidityMax: 70, waterNeed: 'medium' },
    cotton: { tempMin: 20, tempMax: 35, humidityMin: 50, humidityMax: 70, waterNeed: 'medium' },
    sugarcane: { tempMin: 20, tempMax: 35, humidityMin: 60, humidityMax: 85, waterNeed: 'high' },
    maize: { tempMin: 18, tempMax: 32, humidityMin: 50, humidityMax: 75, waterNeed: 'medium' },
    groundnut: { tempMin: 22, tempMax: 30, humidityMin: 50, humidityMax: 60, waterNeed: 'low' },
    chili: { tempMin: 20, tempMax: 32, humidityMin: 60, humidityMax: 75, waterNeed: 'medium' },
    banana: { tempMin: 22, tempMax: 35, humidityMin: 70, humidityMax: 90, waterNeed: 'high' },
    mango: { tempMin: 24, tempMax: 38, humidityMin: 40, humidityMax: 70, waterNeed: 'low' }
};

export async function getCurrentWeather(latitude, longitude) {
    // Get location name via reverse geocoding
    let locationName = await getLocationName(latitude, longitude);
    
    try {
        // Use Open-Meteo API (FREE, no API key required!)
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure&timezone=auto`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.current) {
            return getMockWeather(latitude, longitude, 'No current weather data', locationName);
        }
        
        const current = data.current;
        const weatherCode = current.weather_code || 0;
        
        if (!locationName) {
            locationName = `Location (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`;
        }
        
        return {
            temperature: Math.round(current.temperature_2m),
            feels_like: Math.round(current.apparent_temperature),
            humidity: current.relative_humidity_2m,
            pressure: Math.round(current.surface_pressure || 1013),
            description: weatherCodeMap[weatherCode] || 'Unknown',
            condition: weatherCodeMap[weatherCode] || 'Unknown',
            icon: getConditionFromWeatherCode(weatherCode),
            wind_speed: Math.round(current.wind_speed_10m || 0),
            clouds: weatherCode >= 2 && weatherCode <= 3 ? 50 : 0,
            visibility: 10,
            rain_1h: (weatherCode >= 51 && weatherCode <= 67) ? 2 : 0,
            location: locationName
        };
    } catch (error) {
        console.error('Weather fetch error:', error);
        return getMockWeather(latitude, longitude, error.message, locationName);
    }
}

export async function getForecast(latitude, longitude, days = 7) {
    try {
        // Use Open-Meteo API for forecast (FREE!)
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean&timezone=auto&forecast_days=${days}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.daily) {
            return getMockForecast(days);
        }
        
        const daily = data.daily;
        const forecasts = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        for (let i = 0; i < daily.time.length && i < days; i++) {
            const date = new Date(daily.time[i]);
            const weatherCode = daily.weather_code[i] || 0;
            
            forecasts.push({
                date: daily.time[i],
                day: dayNames[date.getDay()],
                temp_min: Math.round(daily.temperature_2m_min[i]),
                temp_max: Math.round(daily.temperature_2m_max[i]),
                temp_avg: Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
                humidity_avg: Math.round(daily.relative_humidity_2m_mean?.[i] || 60),
                description: weatherCodeMap[weatherCode] || 'Unknown',
                condition: getConditionFromWeatherCode(weatherCode),
                rain_total: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10
            });
        }
        
        return forecasts;
    } catch (error) {
        console.error('Forecast fetch error:', error);
        return getMockForecast(days);
    }
}

export function getFarmingAdvice(weather, soilData = null, language = 'en', crop = null) {
    const advice = [];
    const alerts = [];
    const tasks = [];
    const temp = weather.temperature || 25;
    const humidity = weather.humidity || 50;
    const rain = weather.rain_1h || 0;
    const wind = weather.wind_speed || 0;
    const texts = getWeatherTexts(language);
    
    if (crop && cropPreferences[crop.toLowerCase()]) {
        const pref = cropPreferences[crop.toLowerCase()];
        if (temp < pref.tempMin) alerts.push(`🌡️ ${texts.tooCold} ${crop}! ${texts.optimalTemp}: ${pref.tempMin}-${pref.tempMax}°C`);
        else if (temp > pref.tempMax) alerts.push(`🔥 ${texts.tooHot} ${crop}! ${texts.provideShade}`);
        if (humidity < pref.humidityMin) alerts.push(`💨 ${texts.lowHumidity} ${crop}. ${texts.increaseWater}`);
        else if (humidity > pref.humidityMax) alerts.push(`💧 ${texts.highHumidity} ${crop}. ${texts.fungalRisk}`);
    }
    
    if (temp > 35) {
        alerts.push(`🌡️ ${texts.extremeHeat}`);
        advice.push(texts.waterEarlyMorning);
        advice.push(texts.useMulch);
        tasks.push({ task: texts.emergencyWatering, priority: "high", time: texts.earlyMorning, icon: "💧" });
    } else if (temp > 30) {
        advice.push(texts.hotWeather);
        tasks.push({ task: texts.checkHydration, priority: "medium", time: texts.midday, icon: "🌡️" });
    } else if (temp < 10) {
        alerts.push(`❄️ ${texts.coldAlert}`);
        advice.push(texts.coverPlants);
        tasks.push({ task: texts.protectSensitive, priority: "high", time: texts.beforeSunset, icon: "🛡️" });
    } else {
        advice.push(texts.optimalTemp + "! " + texts.greatDay);
    }
    
    if (humidity > 85) {
        alerts.push(`💧 ${texts.veryHighHumidity}`);
        advice.push(texts.improveAir);
        tasks.push({ task: texts.inspectFungal, priority: "high", time: texts.morning, icon: "🔍" });
    } else if (humidity < 30) {
        alerts.push(`🏜️ ${texts.veryLowHumidity}`);
        advice.push(texts.increaseMisting);
        tasks.push({ task: texts.extraWatering, priority: "high", time: texts.twiceDaily, icon: "💧" });
    }
    
    if (rain > 20) {
        alerts.push(`🌧️ ${texts.heavyRain}`);
        advice.push(texts.delaySpray);
        tasks.push({ task: texts.checkDrainage, priority: "high", time: texts.afterRain, icon: "🚰" });
    } else if (rain > 0) advice.push(texts.lightRain);
    
    if (wind > 15) {
        alerts.push(`💨 ${texts.strongWind}`);
        advice.push(texts.delayAllSpray);
        tasks.push({ task: texts.stakePlants, priority: "high", time: texts.immediately, icon: "🌬️" });
    }
    
    if (soilData) {
        const moisture = soilData.moisture_level?.toLowerCase() || '';
        if (moisture === 'dry' && rain === 0) {
            alerts.push(`🏜️ ${texts.drySoil}`);
            tasks.push({ task: texts.urgentIrrigation, priority: "high", time: texts.immediately, icon: "🚿" });
        } else if (moisture === 'waterlogged') alerts.push(`⚠️ ${texts.waterlogged}`);
    }
    
    if (!alerts.length) advice.unshift(`✅ ${texts.goodConditions}`);
    
    const bestActivities = [];
    if (wind < 8 && rain === 0) {
        bestActivities.push({ activity: texts.sprayPesticides, icon: "🧪" });
        bestActivities.push({ activity: texts.applyFoliar, icon: "🌿" });
    }
    if (temp > 15 && temp < 30) {
        bestActivities.push({ activity: texts.transplantSeedlings, icon: "🌱" });
        bestActivities.push({ activity: texts.plantNewCrops, icon: "🌾" });
    }
    if (!bestActivities.length) bestActivities.push({ activity: texts.generalMaintenance, icon: "🔧" });
    
    const month = new Date().getMonth();
    return {
        advice, alerts, tasks,
        best_activities: bestActivities,
        farming_score: calculateFarmingScore(weather, crop),
        conditions_summary: getConditionsSummary(weather, language),
        seasonal_tips: getSeasonalTips(month, language),
        crop_specific: crop ? getCropSpecificAdvice(weather, crop, language) : null
    };
}

function getCropSpecificAdvice(weather, crop, language) {
    const pref = cropPreferences[crop.toLowerCase()];
    if (!pref) return null;
    const temp = weather.temperature || 25;
    const humidity = weather.humidity || 50;
    const tempScore = temp >= pref.tempMin && temp <= pref.tempMax ? 100 : Math.max(0, 100 - Math.abs(temp - (pref.tempMin + pref.tempMax) / 2) * 5);
    const humidityScore = humidity >= pref.humidityMin && humidity <= pref.humidityMax ? 100 : Math.max(0, 100 - Math.abs(humidity - (pref.humidityMin + pref.humidityMax) / 2) * 2);
    const overall = Math.round((tempScore + humidityScore) / 2);
    const labels = {
        en: { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' },
        hi: { excellent: 'उत्कृष्ट', good: 'अच्छा', fair: 'ठीक', poor: 'खराब' },
        te: { excellent: 'అద్భుతం', good: 'మంచి', fair: 'సరిపోతుంది', poor: 'తక్కువ' }
    };
    const l = labels[language] || labels.en;
    return {
        crop, suitability_score: overall,
        suitability_label: overall >= 80 ? l.excellent : overall >= 60 ? l.good : overall >= 40 ? l.fair : l.poor,
        optimal_temp: `${pref.tempMin}-${pref.tempMax}°C`,
        optimal_humidity: `${pref.humidityMin}-${pref.humidityMax}%`,
        water_need: pref.waterNeed
    };
}

function getSeasonalTips(month, language) {
    const tips = {
        en: { winter: ['Protect crops from frost', 'Prepare soil for Rabi crops', 'Good time for wheat, mustard'], summer: ['Ensure adequate irrigation', 'Use mulching', 'Watch for heat stress'], monsoon: ['Prepare drainage', 'Watch for fungal diseases', 'Good time for rice'], autumn: ['Harvest Kharif crops', 'Prepare for next season'] },
        hi: { winter: ['फसलों को पाले से बचाएं', 'रबी फसलों के लिए तैयारी', 'गेहूं बुवाई का समय'], summer: ['पर्याप्त सिंचाई करें', 'मल्चिंग करें', 'गर्मी से बचाएं'], monsoon: ['जल निकासी तैयार करें', 'फफूंद पर नजर रखें', 'धान का समय'], autumn: ['खरीफ कटाई', 'अगले मौसम की तैयारी'] },
        te: { winter: ['పంటలను మంచు నుండి రక్షించండి', 'రబీ పంటలకు సిద్ధం', 'గోధుమ నాటడానికి సమయం'], summer: ['తగినంత నీటిపారుదల', 'మల్చింగ్ వాడండి', 'వేడి నుండి రక్షించండి'], monsoon: ['డ్రైనేజీ సిద్ధం చేయండి', 'ఫంగల్ వ్యాధులు గమనించండి', 'వరికి సమయం'], autumn: ['ఖరీఫ్ కోత', 'తదుపరి సీజన్ కోసం సిద్ధం'] }
    };
    const l = tips[language] || tips.en;
    if (month >= 11 || month <= 1) return l.winter;
    if (month >= 2 && month <= 4) return l.summer;
    if (month >= 5 && month <= 8) return l.monsoon;
    return l.autumn;
}

function calculateFarmingScore(weather, crop = null) {
    let score = 100;
    const temp = weather.temperature || 25;
    const humidity = weather.humidity || 50;
    const rain = weather.rain_1h || 0;
    const wind = weather.wind_speed || 0;
    
    if (crop && cropPreferences[crop.toLowerCase()]) {
        const pref = cropPreferences[crop.toLowerCase()];
        if (temp < pref.tempMin || temp > pref.tempMax) score -= 25;
        if (humidity < pref.humidityMin || humidity > pref.humidityMax) score -= 15;
    } else {
        if (temp < 10 || temp > 35) score -= 30;
        else if (temp < 15 || temp > 30) score -= 15;
        if (humidity > 85 || humidity < 25) score -= 20;
        else if (humidity > 75 || humidity < 35) score -= 10;
    }
    if (rain > 20) score -= 25; else if (rain > 10) score -= 15;
    if (wind > 15) score -= 20; else if (wind > 10) score -= 10;
    return Math.max(0, Math.min(100, score));
}

function getConditionsSummary(weather, language = 'en') {
    const temp = weather.temperature || 25;
    const humidity = weather.humidity || 50;
    const s = {
        en: { veryHot: 'Very hot', hot: 'Hot', warm: 'Warm', pleasant: 'Pleasant', cool: 'Cool', veryHumid: 'very humid', humid: 'humid', comfortable: 'comfortable', dry: 'dry' },
        hi: { veryHot: 'बहुत गर्म', hot: 'गर्म', warm: 'हल्का गर्म', pleasant: 'सुहावना', cool: 'ठंडा', veryHumid: 'बहुत नम', humid: 'नम', comfortable: 'आरामदायक', dry: 'सूखा' },
        te: { veryHot: 'చాలా వేడి', hot: 'వేడి', warm: 'వెచ్చగా', pleasant: 'ఆహ్లాదకరంగా', cool: 'చల్లగా', veryHumid: 'చాలా తేమగా', humid: 'తేమగా', comfortable: 'సౌకర్యంగా', dry: 'పొడిగా' }
    }[language] || { veryHot: 'Very hot', hot: 'Hot', warm: 'Warm', pleasant: 'Pleasant', cool: 'Cool', veryHumid: 'very humid', humid: 'humid', comfortable: 'comfortable', dry: 'dry' };
    const tempDesc = temp > 35 ? s.veryHot : temp > 30 ? s.hot : temp > 25 ? s.warm : temp > 18 ? s.pleasant : s.cool;
    const humidDesc = humidity > 80 ? s.veryHumid : humidity > 60 ? s.humid : humidity > 40 ? s.comfortable : s.dry;
    return `${tempDesc}, ${humidDesc}`;
}

function getWeatherTexts(language) {
    const texts = {
        en: { extremeHeat: "Extreme heat warning!", waterEarlyMorning: "Water early morning or evening.", useMulch: "Use mulch to retain moisture.", emergencyWatering: "Emergency watering", earlyMorning: "Early morning", hotWeather: "Hot weather - increase watering.", checkHydration: "Check plant hydration", midday: "Midday", coldAlert: "Cold weather alert!", coverPlants: "Cover young plants at night.", protectSensitive: "Cover sensitive plants", beforeSunset: "Before sunset", optimalTemp: "Optimal temperature", greatDay: "Great day for field work!", veryHighHumidity: "Very high humidity - fungal risk.", improveAir: "Improve air circulation.", inspectFungal: "Inspect for fungal diseases", morning: "Morning", veryLowHumidity: "Very low humidity - plants may wilt.", increaseMisting: "Increase watering.", extraWatering: "Extra watering", twiceDaily: "Twice daily", heavyRain: "Heavy rain - check drainage.", delaySpray: "Delay pesticide applications.", checkDrainage: "Check drainage", afterRain: "After rain stops", lightRain: "Light rain - good for crops.", strongWind: "Strong winds - secure plants.", delayAllSpray: "Delay spraying.", stakePlants: "Stake tall plants", immediately: "Immediately", drySoil: "Dry soil - irrigate urgently!", urgentIrrigation: "Urgent irrigation", waterlogged: "Waterlogged - improve drainage.", goodConditions: "Good conditions for farming!", sprayPesticides: "Spray pesticides", applyFoliar: "Apply foliar fertilizers", transplantSeedlings: "Transplant seedlings", plantNewCrops: "Plant new crops", generalMaintenance: "General maintenance", tooHot: "Too hot for", tooCold: "Too cold for", provideShade: "Provide shade", lowHumidity: "Low humidity for", highHumidity: "High humidity for", fungalRisk: "Fungal disease risk", increaseWater: "Increase watering" },
        hi: { extremeHeat: "अत्यधिक गर्मी!", waterEarlyMorning: "सुबह या शाम पानी दें।", useMulch: "नमी के लिए मल्च करें।", emergencyWatering: "आपातकालीन सिंचाई", earlyMorning: "सुबह", hotWeather: "गर्म मौसम - सिंचाई बढ़ाएं।", checkHydration: "नमी जांचें", midday: "दोपहर", coldAlert: "ठंड की चेतावनी!", coverPlants: "पौधों को ढकें।", protectSensitive: "नाजुक पौधे ढकें", beforeSunset: "शाम से पहले", optimalTemp: "आदर्श तापमान", greatDay: "खेती का अच्छा दिन!", veryHighHumidity: "बहुत नमी - फफूंद का खतरा।", improveAir: "हवा संचार बढ़ाएं।", inspectFungal: "फफूंद जांचें", morning: "सुबह", veryLowHumidity: "कम नमी - मुरझाने का खतरा।", increaseMisting: "सिंचाई बढ़ाएं।", extraWatering: "अतिरिक्त सिंचाई", twiceDaily: "दिन में दो बार", heavyRain: "भारी बारिश - निकासी जांचें।", delaySpray: "छिड़काव टालें।", checkDrainage: "निकासी जांचें", afterRain: "बारिश के बाद", lightRain: "हल्की बारिश - अच्छी।", strongWind: "तेज हवा - पौधे बांधें।", delayAllSpray: "छिड़काव टालें।", stakePlants: "पौधे बांधें", immediately: "तुरंत", drySoil: "सूखी मिट्टी - सिंचाई करें!", urgentIrrigation: "तत्काल सिंचाई", waterlogged: "जलभराव - निकासी सुधारें।", goodConditions: "खेती के लिए अच्छा!", sprayPesticides: "कीटनाशक छिड़काव", applyFoliar: "पत्तों पर खाद", transplantSeedlings: "रोपाई", plantNewCrops: "नई फसल", generalMaintenance: "रखरखाव", tooHot: "बहुत गर्म", tooCold: "बहुत ठंडा", provideShade: "छाया दें", lowHumidity: "कम नमी", highHumidity: "अधिक नमी", fungalRisk: "फफूंद खतरा", increaseWater: "सिंचाई बढ़ाएं" },
        te: { extremeHeat: "తీవ్రమైన వేడి!", waterEarlyMorning: "ఉదయం లేదా సాయంత్రం నీరు పెట్టండి.", useMulch: "తేమ కోసం మల్చ్ వాడండి.", emergencyWatering: "అత్యవసర నీటిపారుదల", earlyMorning: "ఉదయం", hotWeather: "వేడి - నీటిపారుదల పెంచండి.", checkHydration: "తేమ తనిఖీ", midday: "మధ్యాహ్నం", coldAlert: "చలి హెచ్చరిక!", coverPlants: "మొక్కలను కప్పండి.", protectSensitive: "సున్నితమైన మొక్కలు కప్పండి", beforeSunset: "సాయంత్రం ముందు", optimalTemp: "అనుకూల ఉష్ణోగ్రత", greatDay: "వ్యవసాయానికి మంచి రోజు!", veryHighHumidity: "చాలా తేమ - ఫంగల్ ప్రమాదం.", improveAir: "గాలి ప్రసరణ పెంచండి.", inspectFungal: "ఫంగల్ తనిఖీ", morning: "ఉదయం", veryLowHumidity: "తక్కువ తేమ - వాడిపోవచ్చు.", increaseMisting: "నీటిపారుదల పెంచండి.", extraWatering: "అదనపు నీటిపారుదల", twiceDaily: "రోజుకు రెండుసార్లు", heavyRain: "భారీ వర్షం - డ్రైనేజీ చూడండి.", delaySpray: "స్ప్రే వాయిదా వేయండి.", checkDrainage: "డ్రైనేజీ చూడండి", afterRain: "వర్షం తర్వాత", lightRain: "తేలికపాటి వర్షం - మంచిది.", strongWind: "బలమైన గాలి - మొక్కలు బంధించండి.", delayAllSpray: "స్ప్రే వాయిదా.", stakePlants: "మొక్కలు బంధించండి", immediately: "వెంటనే", drySoil: "పొడి మట్టి - నీరు పెట్టండి!", urgentIrrigation: "అత్యవసర నీటిపారుదల", waterlogged: "నీరు నిలిచింది - డ్రైనేజీ మెరుగుపరచండి.", goodConditions: "వ్యవసాయానికి మంచి పరిస్థితులు!", sprayPesticides: "పురుగుమందులు స్ప్రే", applyFoliar: "ఫోలియర్ ఎరువులు", transplantSeedlings: "మొక్కలు నాటడం", plantNewCrops: "కొత్త పంటలు", generalMaintenance: "నిర్వహణ", tooHot: "చాలా వేడి", tooCold: "చాలా చల్లగా", provideShade: "నీడ ఇవ్వండి", lowHumidity: "తక్కువ తేమ", highHumidity: "అధిక తేమ", fungalRisk: "ఫంగల్ ప్రమాదం", increaseWater: "నీటిపారుదల పెంచండి" }
    };
    return texts[language] || texts.en;
}

function getMockWeather(lat, lon, error = null, locationName = null) {
    return { 
        temperature: 28, 
        feels_like: 30, 
        humidity: 65, 
        pressure: 1013, 
        description: 'partly cloudy',
        condition: 'partly cloudy',
        icon: '02d', 
        wind_speed: 3.5, 
        clouds: 40, 
        visibility: 10, 
        rain_1h: 0, 
        location: locationName || `Location (${lat?.toFixed(2) || '0'}°, ${lon?.toFixed(2) || '0'}°)`, 
        mock: true, 
        error 
    };
}

function getMockForecast(days = 7) {
    const forecasts = [];
    const today = new Date();
    const conditions = ['sunny', 'partly cloudy', 'cloudy', 'light rain', 'sunny', 'cloudy', 'sunny'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        forecasts.push({ date: date.toISOString().split('T')[0], day: dayNames[date.getDay()], temp_min: 22 + Math.floor(Math.random() * 5), temp_max: 30 + Math.floor(Math.random() * 5), temp_avg: 27, humidity_avg: 60, description: conditions[i % conditions.length], condition: conditions[i % conditions.length].includes('rain') ? 'rain' : conditions[i % conditions.length].includes('cloud') ? 'cloudy' : 'sunny', rain_total: conditions[i % conditions.length].includes('rain') ? 5 : 0, mock: true });
    }
    return forecasts;
}
