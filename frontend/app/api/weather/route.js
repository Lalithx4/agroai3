import { NextResponse } from 'next/server';
import { getCurrentWeather, getForecast, getFarmingAdvice } from '@/lib/weather';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get('lat') || '0');
        // Support both 'lon' and 'lng' parameter names
        const lon = parseFloat(searchParams.get('lon') || searchParams.get('lng') || '0');
        const language = searchParams.get('language') || 'en';
        
        if (!lat || !lon) {
            return NextResponse.json(
                { error: 'Latitude and longitude required' },
                { status: 400 }
            );
        }
        
        const [current, forecast] = await Promise.all([
            getCurrentWeather(lat, lon),
            getForecast(lat, lon, 5)
        ]);
        
        const advice = getFarmingAdvice(current, null, language);
        
        return NextResponse.json({
            current,
            forecast,
            advice: advice.advice,
            alerts: advice.alerts,
            tasks: advice.tasks,
            best_activities: advice.best_activities,
            farming_score: advice.farming_score,
            conditions_summary: advice.conditions_summary
        });
        
    } catch (error) {
        console.error('Weather error:', error);
        return NextResponse.json(
            { error: 'Weather fetch failed', detail: error.message },
            { status: 500 }
        );
    }
}
