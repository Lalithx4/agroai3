import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Supabase is optional: without the env vars the app still works and keeps history on the device only.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Generate a unique device ID for anonymous users
function getDeviceId() {
  if (typeof window === 'undefined') return null;
  
  let deviceId = localStorage.getItem('agroai_device_id');
  if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('agroai_device_id', deviceId);
  }
  return deviceId;
}

// ============================================
// SCAN HISTORY FUNCTIONS
// ============================================

export async function saveScanHistory(scanData) {
  const deviceId = getDeviceId();
  if (!deviceId) return null;
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('scan_history')
      .insert([
        {
          device_id: deviceId,
          plant_name: scanData.plant_name || scanData.plant_type || 'Unknown Plant',
          plant_type: scanData.plant_type || scanData.crop_name || 'Unknown',
          health_status: scanData.health_status || 'unknown',
          diagnosis: scanData.diagnosis || '',
          diseases: scanData.diseases || [],
          treatment_plan: scanData.treatment_plan || null,
          fertilizer_recommendations: scanData.fertilizer_recommendations || null,
          image_base64: scanData.image_base64 || null,
          confidence_score: scanData.confidence_score || null,
          full_analysis: scanData, // Store complete analysis
        }
      ])
      .select();

    if (error) {
      console.error('Error saving scan history:', error);
      return null;
    }

    return data?.[0];
  } catch (err) {
    console.error('Error saving scan:', err);
    return null;
  }
}

export async function getScanHistory(limit = 20) {
  const deviceId = getDeviceId();
  if (!deviceId) return [];
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('scan_history')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching scan history:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching scans:', err);
    return [];
  }
}

export async function deleteScan(scanId) {
  const deviceId = getDeviceId();
  if (!deviceId) return false;
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('scan_history')
      .delete()
      .eq('id', scanId)
      .eq('device_id', deviceId);

    if (error) {
      console.error('Error deleting scan:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error deleting scan:', err);
    return false;
  }
}

// ============================================
// USER PREFERENCES FUNCTIONS
// ============================================

export async function saveUserPreferences(preferences) {
  const deviceId = getDeviceId();
  if (!deviceId) return null;
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert([
        {
          device_id: deviceId,
          language: preferences.language || 'en',
          theme: preferences.theme || 'light',
          location: preferences.location || null,
          favorite_crops: preferences.favorite_crops || [],
          notifications_enabled: preferences.notifications_enabled ?? true,
          voice_enabled: preferences.voice_enabled ?? true,
        }
      ], { onConflict: 'device_id' })
      .select();

    if (error) {
      console.error('Error saving preferences:', error);
      return null;
    }

    return data?.[0];
  } catch (err) {
    console.error('Error saving preferences:', err);
    return null;
  }
}

export async function getUserPreferences() {
  const deviceId = getDeviceId();
  if (!deviceId || !supabase) {
    return getDefaultPreferences();
  }

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error || !data) {
      return getDefaultPreferences();
    }

    return data;
  } catch (err) {
    console.error('Error fetching preferences:', err);
    return getDefaultPreferences();
  }
}

function getDefaultPreferences() {
  return {
    language: 'en',
    theme: 'light',
    location: null,
    favorite_crops: [],
    notifications_enabled: true,
    voice_enabled: true,
  };
}

// ============================================
// CHAT HISTORY FUNCTIONS
// ============================================

export async function saveChatMessage(message) {
  const deviceId = getDeviceId();
  if (!deviceId) return null;
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('chat_history')
      .insert([
        {
          device_id: deviceId,
          plant_name: message.plant_name || null,
          role: message.role, // 'user' or 'assistant'
          content: message.content,
          session_id: message.session_id || null,
        }
      ])
      .select();

    if (error) {
      // Only log if there's actual error content - tables may not exist yet
      if (error.message || error.code) {
        console.warn('Chat save skipped:', error.message || error.code);
      }
      return null;
    }

    return data?.[0];
  } catch (err) {
    // Silently handle - Supabase tables may not be configured
    console.warn('Chat save skipped:', err?.message || 'database not configured');
    return null;
  }
}

export async function getChatHistory(plantName = null, sessionId = null, limit = 50) {
  const deviceId = getDeviceId();
  if (!deviceId) return [];
  if (!supabase) return [];

  try {
    let query = supabase
      .from('chat_history')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (plantName) {
      query = query.eq('plant_name', plantName);
    }
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    // Handle table not existing or other errors gracefully
    if (error) {
      // Don't log empty objects, only real errors
      if (error.message || error.code) {
        console.warn('Chat history not available:', error.message || error.code);
      }
      return [];
    }

    return data || [];
  } catch (err) {
    // Silently fail - Supabase tables may not exist yet
    console.warn('Chat history fetch skipped:', err?.message || 'tables not configured');
    return [];
  }
}

export async function clearChatHistory(plantName = null) {
  const deviceId = getDeviceId();
  if (!deviceId) return false;
  if (!supabase) return false;

  try {
    let query = supabase
      .from('chat_history')
      .delete()
      .eq('device_id', deviceId);

    if (plantName) {
      query = query.eq('plant_name', plantName);
    }

    const { error } = await query;

    if (error) {
      console.error('Error clearing chat history:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error clearing chat:', err);
    return false;
  }
}

// ============================================
// WEATHER CACHE FUNCTIONS
// ============================================

export async function cacheWeatherData(location, weatherData) {
  const deviceId = getDeviceId();
  if (!deviceId) return null;
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('weather_cache')
      .upsert([
        {
          device_id: deviceId,
          location: location,
          weather_data: weatherData,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        }
      ], { onConflict: 'device_id,location' })
      .select();

    if (error) {
      console.error('Error caching weather:', error);
      return null;
    }

    return data?.[0];
  } catch (err) {
    console.error('Error caching weather:', err);
    return null;
  }
}

export async function getCachedWeather(location) {
  const deviceId = getDeviceId();
  if (!deviceId) return null;
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('weather_cache')
      .select('*')
      .eq('device_id', deviceId)
      .eq('location', location)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return null;
    }

    return data.weather_data;
  } catch (err) {
    console.error('Error fetching cached weather:', err);
    return null;
  }
}

// ============================================
// HELPER - Initialize and sync local storage
// ============================================

export async function syncFromLocalStorage() {
  if (typeof window === 'undefined') return;

  // Sync language preference from localStorage if exists
  const savedLang = localStorage.getItem('agroai_language');
  const savedTheme = localStorage.getItem('agroai_theme');
  
  if (savedLang || savedTheme) {
    const prefs = await getUserPreferences();
    await saveUserPreferences({
      ...prefs,
      language: savedLang || prefs.language,
      theme: savedTheme || prefs.theme,
    });
  }
}

// Export device ID for use in other modules
export { getDeviceId };
