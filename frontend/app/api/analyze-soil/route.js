import { NextResponse } from 'next/server';
import { analyzeSoil } from '@/lib/gemini';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const imageFile = formData.get('image');
        const language = formData.get('language') || 'en';

        if (!imageFile) {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }

        // Convert file to base64
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = buffer.toString('base64');

        // Analyze soil using Gemini
        const result = await analyzeSoil(base64Image, language);

        return NextResponse.json({
            success: true,
            analysis: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Soil analysis error:', error);
        return NextResponse.json(
            { 
                error: 'Failed to analyze soil',
                details: error.message 
            },
            { status: 500 }
        );
    }
}
