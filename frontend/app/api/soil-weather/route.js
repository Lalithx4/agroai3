import { NextResponse } from 'next/server';
import { analyzeSoil } from '@/lib/gemini';
import { getCurrentWeather, getForecast, getFarmingAdvice } from '@/lib/weather';

export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            image_base64, 
            latitude, 
            longitude, 
            language = 'en' 
        } = body;
        
        let soilResult = null;
        
        // Analyze soil if image provided
        if (image_base64) {
            let imageData = image_base64;
            if (imageData.includes(',')) {
                imageData = imageData.split(',')[1];
            }
            soilResult = await analyzeSoil(imageData, language);
        }
        
        // Get weather data
        const [current, forecast] = await Promise.all([
            getCurrentWeather(latitude || 0, longitude || 0),
            getForecast(latitude || 0, longitude || 0, 5)
        ]);
        
        // Calculate rain probability
        let rainProbability = 0;
        if (forecast && forecast.length > 0) {
            const rainyDays = forecast.filter(day => day.rain_total > 0).length;
            rainProbability = (rainyDays / forecast.length) * 100;
        }
        
        // Get farming advice
        const advice = getFarmingAdvice(current, soilResult, language);
        
        return NextResponse.json({
            soil: soilResult,
            weather: {
                ...current,
                rain_probability: rainProbability,
                forecast
            },
            farming_advice: advice.advice,
            alerts: advice.alerts,
            tasks: advice.tasks,
            best_activities: advice.best_activities,
            farming_score: advice.farming_score,
            conditions_summary: advice.conditions_summary
        });
        
    } catch (error) {
        console.error('Soil/Weather error:', error);
        return NextResponse.json(
            { error: 'Analysis failed', detail: error.message },
            { status: 500 }
        );
    }
}
