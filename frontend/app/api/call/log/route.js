import { NextResponse } from 'next/server';
import { listCalls } from '@/lib/call-log';
import { missingConfig } from '@/lib/sarvam-agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({ calls: await listCalls(), configured: missingConfig().length === 0 });
}
