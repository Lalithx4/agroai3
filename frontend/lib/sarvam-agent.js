/**
 * Real phone calls from the plant, via Sarvam Voice Agents (agent "CropMagix").
 * Server-only. Docs: https://docs.sarvam.ai/voice-agents/api/instant-outbound/create
 *
 * .env.local:
 *   SARVAM_AGENT_API_KEY, SARVAM_ORG_ID, SARVAM_WORKSPACE_ID, SARVAM_AGENT_APP_ID,
 *   SARVAM_AGENT_APP_VERSION, SARVAM_CONNECTION_ID, SARVAM_AGENT_NUMBER
 *   PUBLIC_BASE_URL (optional; where Sarvam can reach /api/call/webhook, e.g. the Vercel URL)
 */

const BASE = 'https://apps.sarvam.ai/api/outbounds/v1';

const env = (k) => (process.env[k] || '').trim();

export function agentConfig() {
    return {
        apiKey: env('SARVAM_AGENT_API_KEY'),
        orgId: env('SARVAM_ORG_ID'),
        workspaceId: env('SARVAM_WORKSPACE_ID'),
        appId: env('SARVAM_AGENT_APP_ID'),
        appVersion: parseInt(env('SARVAM_AGENT_APP_VERSION') || '1', 10),
        connectionId: env('SARVAM_CONNECTION_ID'),
        agentNumber: env('SARVAM_AGENT_NUMBER'),
        publicBase: env('PUBLIC_BASE_URL'),
    };
}

/** Which settings are still missing (empty array = ready to call). */
export function missingConfig() {
    const c = agentConfig();
    return Object.entries({
        SARVAM_AGENT_API_KEY: c.apiKey, SARVAM_ORG_ID: c.orgId, SARVAM_WORKSPACE_ID: c.workspaceId,
        SARVAM_AGENT_APP_ID: c.appId, SARVAM_CONNECTION_ID: c.connectionId, SARVAM_AGENT_NUMBER: c.agentNumber,
    }).filter(([, v]) => !v).map(([k]) => k);
}

/** Indian mobile numbers to E.164 (+91XXXXXXXXXX). Returns null when it does not look like a phone number. */
export function toE164(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
    return null;
}

/**
 * Ask Sarvam to ring the farmer. The agent's prompt uses these variables (see the Genie prompt).
 * @returns {Promise<{attempt_id: string}>}
 */
export async function placeCall({ farmerPhone, vars, webhookUrl }) {
    const c = agentConfig();
    const body = {
        app_config: {
            app_id: c.appId,
            app_version: c.appVersion,
            connection_config: { connection_id: c.connectionId, agent_phone_number: toE164(c.agentNumber) || c.agentNumber },
            agent_variables: vars,
            // Every call opens in Telugu; the agent switches if the farmer answers in Hindi or English.
            app_overrides: { initial_language_name: 'Telugu' },
        },
        user_config: { user_phone_number: farmerPhone },
        ...(webhookUrl ? { webhook_config: { url: webhookUrl, metadata: { app: 'cropmagix' } } } : {}),
    };
    const res = await fetch(`${BASE}/orgs/${encodeURIComponent(c.orgId)}/workspaces/${encodeURIComponent(c.workspaceId)}/outbounds`, {
        method: 'POST',
        headers: { 'X-API-Key': c.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch { /* non-JSON error body */ }
    if (!res.ok) {
        const detail = Array.isArray(json.detail) ? json.detail.map((d) => `${(d.loc || []).join('.')}: ${d.msg}`).join('; ') : (json.detail || text.slice(0, 300));
        throw new Error(`Sarvam call failed (${res.status}): ${detail}`);
    }
    return json;
}
