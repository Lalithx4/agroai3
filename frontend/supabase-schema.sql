-- ============================================
-- AgroAI Supabase Database Schema
-- Run this SQL in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. SCAN HISTORY TABLE
-- Stores plant scan results
-- ============================================
CREATE TABLE IF NOT EXISTS scan_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  device_id TEXT NOT NULL,
  plant_name TEXT,
  plant_type TEXT,
  health_status TEXT,
  diagnosis TEXT,
  diseases JSONB DEFAULT '[]',
  treatment_plan JSONB,
  fertilizer_recommendations JSONB,
  image_base64 TEXT,
  confidence_score NUMERIC(5,2),
  full_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries by device
CREATE INDEX IF NOT EXISTS idx_scan_history_device_id ON scan_history(device_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for anonymous users based on device_id
CREATE POLICY "Allow all operations on scan_history" ON scan_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. USER PREFERENCES TABLE
-- Stores user settings
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'light',
  location TEXT,
  favorite_crops JSONB DEFAULT '[]',
  notifications_enabled BOOLEAN DEFAULT true,
  voice_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for device_id lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_device_id ON user_preferences(device_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy for user_preferences
CREATE POLICY "Allow all operations on user_preferences" ON user_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. CHAT HISTORY TABLE
-- Stores conversation history
-- ============================================
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  device_id TEXT NOT NULL,
  plant_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_history_device_id ON chat_history(device_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_plant_name ON chat_history(plant_name);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);

-- Enable RLS
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Policy for chat_history
CREATE POLICY "Allow all operations on chat_history" ON chat_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. WEATHER CACHE TABLE
-- Caches weather data to reduce API calls
-- ============================================
CREATE TABLE IF NOT EXISTS weather_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  device_id TEXT NOT NULL,
  location TEXT NOT NULL,
  weather_data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(device_id, location)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_weather_cache_lookup ON weather_cache(device_id, location);
CREATE INDEX IF NOT EXISTS idx_weather_cache_expires ON weather_cache(expires_at);

-- Enable RLS
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;

-- Policy for weather_cache
CREATE POLICY "Allow all operations on weather_cache" ON weather_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- AUTOMATIC CLEANUP FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_preferences
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANT PERMISSIONS FOR ANONYMOUS ACCESS
-- ============================================
GRANT ALL ON scan_history TO anon;
GRANT ALL ON user_preferences TO anon;
GRANT ALL ON chat_history TO anon;
GRANT ALL ON weather_cache TO anon;

-- ============================================
-- DONE! Your AgroAI database is ready.
-- ============================================
