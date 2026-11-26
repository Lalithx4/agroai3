import { NextResponse } from 'next/server';
import { scanForAR } from '@/lib/bedrock';

// First lock names the plant on the stronger model (about 8 s); later frames are quicker.
export const maxDuration = 30;

const str = (v, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** The plant the overlay already locked onto, sent back as JSON. Untrusted: keep only short strings. */
function parsePlant(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    try {
        const p = JSON.parse(raw);
        const plant_name = str(p?.plant_name);
        return plant_name ? { plant_name, display_name: str(p.display_name) || plant_name, scientific_name: str(p.scientific_name) } : null;
    } catch {
        return null;
    }
}

export async function POST(request) {
    try {
        const formData = await request.formData();
        const image = formData.get('image');
        const language = formData.get('language') || 'en';
        const plant = parsePlant(formData.get('plant'));
        
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

        // Name once on the stronger model, then keep it (see scanForAR)
        const arResult = await scanForAR(base64Image, language, { plant });
        
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
        params: { image: 'File or base64 string (required)', language: 'en | hi | te (optional)', plant: 'JSON {plant_name, display_name, scientific_name} of the locked plant (optional)' },
    });
}
