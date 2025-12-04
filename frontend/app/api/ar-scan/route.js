import { NextResponse } from 'next/server';
import { analyzeForAR } from '@/lib/gemini';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const image = formData.get('image');
        const language = formData.get('language') || 'en';
        
        if (!image) {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }

        // Convert image to base64
        let base64Image;
        if (typeof image === 'string') {
            base64Image = image;
        } else {
            const buffer = await image.arrayBuffer();
            base64Image = Buffer.from(buffer).toString('base64');
        }

        // Get AR-optimized analysis
        const arResult = await analyzeForAR(base64Image, language);
        
        return NextResponse.json(arResult);
    } catch (error) {
        console.error('AR scan error:', error);
        return NextResponse.json(
            { 
                identified: false,
                plant_name: 'Scan Error',
                emoji: '❌',
                health_emoji: '❓',
                quick_diagnosis: 'Unable to process image',
                instant_tip: 'Please try again with a clearer image',
                fun_fact: '🌱 There are over 400,000 plant species on Earth!',
                confidence: 0,
                error: error.message,
                animation: 'error_shake'
            },
            { status: 500 }
        );
    }
}

// GET endpoint for testing
export async function GET() {
    return NextResponse.json({
        status: 'AR Scanner API Ready',
        endpoint: '/api/ar-scan',
        method: 'POST',
        params: {
            image: 'File or base64 string (required)',
            language: 'en|hi|te (optional, default: en)'
        },
        features: [
            '🎯 Instant plant identification',
            '✨ Fun facts and superpowers',
            '💚 Health score with emoji',
            '💡 Quick care tips',
            '🎨 AR animation hints'
        ]
    });
}
