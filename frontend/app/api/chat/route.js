import { NextResponse } from 'next/server';
import { chatWithPlant } from '@/lib/cerebras';

export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            message, 
            plant_type = 'Unknown', 
            health_status = 'healthy',
            diseases = [],
            conversation_history = [],
            language = 'en' 
        } = body;
        
        if (!message) {
            return NextResponse.json(
                { error: 'No message provided' },
                { status: 400 }
            );
        }
        
        const result = await chatWithPlant(
            message, 
            plant_type, 
            health_status, 
            diseases,
            conversation_history,
            language
        );
        
        return NextResponse.json(result);
        
    } catch (error) {
        console.error('Chat error:', error);
        return NextResponse.json(
            { error: 'Chat failed', detail: error.message },
            { status: 500 }
        );
    }
}
