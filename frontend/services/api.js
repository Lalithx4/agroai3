/**
 * CropMagix - API Service
 * Handles all backend communication via Next.js API routes
 */

const API_CONFIG = {
    TIMEOUT: 60000, // 60 seconds for AI processing
    RETRY_ATTEMPTS: 2
};

async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function apiRequest(endpoint, options = {}) {
    // Use relative URLs for Next.js API routes (same server)
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const config = { ...defaultOptions, ...options };
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
        
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `HTTP ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
}

export async function analyzeHealth(imageInput, plantType = null, language = null) {
    let imageBase64 = imageInput;
    
    if (imageInput instanceof Blob || imageInput instanceof File) {
        imageBase64 = await blobToBase64(imageInput);
    }
    
    const lang = language || (typeof window !== 'undefined' ? localStorage.getItem('cropmagix-lang') : 'en') || 'en';
    
    return apiRequest('/api/analyze-health', {
        method: 'POST',
        body: JSON.stringify({
            image_base64: imageBase64,
            plant_type: plantType,
            language: lang
        })
    });
}

export async function chatWithPlant(message, plantType = 'Unknown', healthStatus = 'healthy', diseases = [], language = null) {
    const lang = language || (typeof window !== 'undefined' ? localStorage.getItem('cropmagix-lang') : 'en') || 'en';
    return apiRequest('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
            message: message,
            plant_type: plantType,
            health_status: healthStatus,
            diseases: diseases,
            conversation_history: [],
            language: lang
        })
    });
}

export async function getWeather(latitude, longitude, language = null) {
    const lang = language || (typeof window !== 'undefined' ? localStorage.getItem('cropmagix-lang') : 'en') || 'en';
    return apiRequest(`/api/weather?lat=${latitude}&lon=${longitude}&language=${lang}`, {
        method: 'GET'
    });
}

export async function getSoilWeather(latitude, longitude, soilImageInput = null, language = null) {
    let soilImageBase64 = null;
    
    if (soilImageInput instanceof Blob || soilImageInput instanceof File) {
        soilImageBase64 = await blobToBase64(soilImageInput);
    } else if (soilImageInput) {
        soilImageBase64 = soilImageInput;
    }
    
    const lang = language || (typeof window !== 'undefined' ? localStorage.getItem('cropmagix-lang') : 'en') || 'en';
    
    return apiRequest('/api/soil-weather', {
        method: 'POST',
        body: JSON.stringify({
            image_base64: soilImageBase64,
            latitude: latitude,
            longitude: longitude,
            language: lang
        })
    });
}

export async function healthCheck() {
    try {
        const result = await apiRequest('/api/health');
        return result.status === 'healthy';
    } catch (e) {
        return false;
    }
}

export function setBaseUrl(url) {
    // Not needed for internal API routes
    console.log('API routes are internal, base URL not needed');
}

export function getBaseUrl() {
    return '/api';
}
