import { NextResponse } from 'next/server';
import { recordCall } from '@/lib/call-log';

export const runtime = 'nodejs';

/** Sarvam posts here when a call attempt ends: status, duration, transcript, captured fields. */
export async function POST(request) {
    try {
        const p = await request.json();
        if (!p?.attempt_id) return NextResponse.json({ error: 'no attempt_id' }, { status: 400 });
        await recordCall({
            attempt_id: p.attempt_id,
            status: p.status || 'unknown',
            duration: p.duration ?? null,
            failure_reason: p.failure_reason || null,
            transcript: Array.isArray(p.interaction_transcript) ? p.interaction_transcript.map((t) => ({ role: t.role, text: t.en_text })) : [],
            outcome: p.final_agent_variables || null,
            ended_at: Date.now(),
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('Call webhook error:', e.message);
        return NextResponse.json({ error: 'bad payload' }, { status: 400 });
    }
}
