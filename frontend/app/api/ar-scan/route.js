import { NextResponse } from 'next/server';
import { analyzeForAR } from '@/lib/bedrock';

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
        return NextResponse.json({ identified: false, hint: 'Point at one plant, a little closer', error: error.message }, { status: 500 });
    }
}

// GET endpoint for testing
export async function GET() {
    return NextResponse.json({
        status: 'AR scanner ready',
        endpoint: '/api/ar-scan',
        method: 'POST',
        params: { image: 'File or base64 string (required)', language: 'en | hi | te (optional)' },
    });
}
