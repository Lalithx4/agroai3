import { NextResponse } from 'next/server';
import { analyzePlantHealth } from '@/lib/gemini';

export async function POST(request) {
    try {
        const body = await request.json();
        const { image_base64, plant_type, language = 'en' } = body;
        
        if (!image_base64) {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }
        
        // Remove data URL prefix if present
        let imageData = image_base64;
        if (imageData.includes(',')) {
            imageData = imageData.split(',')[1];
        }
        
        const result = await analyzePlantHealth(imageData, plant_type, language);
        
        // Ensure required fields exist
        result.plant_type = result.plant_type || plant_type || 'Unknown';
        result.health_status = result.health_status || 'unknown';
        result.diseases = result.diseases || [];
        result.recommendations = result.recommendations || [];
        result.confidence = result.confidence || 85;
        result.summary = result.summary || 'Analysis complete.';
        
        return NextResponse.json(result);
        
    } catch (error) {
        console.error('Health analysis error:', error);
        return NextResponse.json(
            { error: 'Health analysis failed', detail: error.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({ status: 'healthy', service: 'CropMagix API' });
}
