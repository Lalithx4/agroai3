import { NextResponse } from 'next/server';
import { analyzePlantHealth } from '@/lib/bedrock';

// Naming (stronger model) + the long report run one after the other: about 15-25 s.
export const maxDuration = 60;

export async function POST(request) {
    try {
        const body = await request.json();
        const { image_base64, language = 'en' } = body;
        // The farmer's own name for the plant (after correcting a wrong one). Short text only.
        const shortText = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null);
        const plant_type = shortText(body.plant_type);
        const plant_species = plant_type ? shortText(body.plant_species) : null;
        
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
        
        const result = await analyzePlantHealth(imageData, plant_type, language, plant_species);
        
        // Ensure required fields exist
        if (!result.not_plant) result.plant_type = result.plant_type || plant_type || 'Unknown';
        result.health_status = result.health_status || 'unknown';
        result.diseases = result.diseases || [];
        result.recommendations = result.recommendations || [];
        // No invented confidence: if the model gave none, the report shows none.
        result.confidence = result.confidence == null || !Number.isFinite(Number(result.confidence)) ? null : Number(result.confidence);
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
