import { NextResponse } from 'next/server';
import { placeCall, missingConfig, toE164, agentConfig } from '@/lib/sarvam-agent';
import { recordCall } from '@/lib/call-log';

export const runtime = 'nodejs';

const REASONS = ['follow_up', 'recovery_check', 'outbreak_alert', 'weather_alert', 'reminder'];

/**
 * POST { phone, farmerName, plant, issue, healthStatus, confidence, todo[], fieldName?, reason? }
 * Rings the farmer's phone from the CropMagix Sarvam agent.
 */
export async function POST(request) {
    const missing = missingConfig();
    if (missing.length) {
        return NextResponse.json({ error: 'calling_not_configured', missing }, { status: 501 });
    }
    try {
        const b = await request.json();
        const phone = toE164(b.phone);
        if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
        if (!b.consent) return NextResponse.json({ error: 'consent_required' }, { status: 400 });

        const vars = {
            farmer_name: String(b.farmerName || 'farmer').slice(0, 60),
            plant_name: String(b.plant || 'plant').slice(0, 60),
            field_name: String(b.fieldName || 'field').slice(0, 60),
            issue: String(b.issue || 'none').slice(0, 120),
            health_status: ['healthy', 'mild', 'needs_attention', 'serious'].includes(b.healthStatus) ? b.healthStatus : 'needs_attention',
            confidence: Math.max(0, Math.min(100, Math.round(Number(b.confidence) || 0))),
            scan_date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }),
            todo: (Array.isArray(b.todo) ? b.todo : []).slice(0, 3).join('; ').slice(0, 300) || 'check the leaves',
            call_reason: REASONS.includes(b.reason) ? b.reason : 'follow_up',
            language: 'Telugu',
        };

        // Sarvam can only reach the webhook on a public URL (deployed app), not localhost.
        const base = agentConfig().publicBase || request.headers.get('origin') || '';
        const webhookUrl = /^https:\/\//.test(base) && !/localhost|127\.0\.0\.1/.test(base) ? `${base}/api/call/webhook` : null;

        const { attempt_id } = await placeCall({ farmerPhone: phone, vars, webhookUrl });
        await recordCall({ attempt_id, status: 'ringing', phone: phone.replace(/\d(?=\d{4})/g, '•'), plant: vars.plant_name, issue: vars.issue, started_at: Date.now(), webhook: !!webhookUrl });
        return NextResponse.json({ ok: true, attempt_id, webhook: !!webhookUrl });
    } catch (e) {
        console.error('Call error:', e.message);
        return NextResponse.json({ error: 'call_failed', detail: e.message }, { status: 502 });
    }
}
