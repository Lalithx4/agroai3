/**
 * Call log store (server). Uses a JSON file in the OS temp folder so it works without a database;
 * swap for Supabase in production (serverless file storage does not persist between instances).
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FILE = path.join(os.tmpdir(), 'cropmagix-calls.json');

async function readAll() {
    try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return []; }
}

/** Insert or merge one call record by attempt_id. */
export async function recordCall(rec) {
    const all = await readAll();
    const i = all.findIndex((c) => c.attempt_id === rec.attempt_id);
    if (i >= 0) all[i] = { ...all[i], ...rec };
    else all.unshift(rec);
    await fs.writeFile(FILE, JSON.stringify(all.slice(0, 200)));
}

export async function listCalls() {
    return readAll();
}
