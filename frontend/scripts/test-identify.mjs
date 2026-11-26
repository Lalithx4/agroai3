/**
 * Check plant naming on your own photos.
 *
 *   node --env-file=.env.local scripts/test-identify.mjs <photo-or-folder> [...] [--lang=hi]
 *
 * The right answer comes from --expect=<name>, or else the file name ("money-plant_1.jpg") or its
 * folder ("money plant/2.jpg"). The script then prints whether the name matched, and the accuracy.
 * BEDROCK_ID_MODEL=<model id> compares another model.
 */

import fs from 'node:fs';
import path from 'node:path';
import { identifyPlant, ID_MODEL } from '../lib/bedrock.js';

const args = process.argv.slice(2);
const lang = (args.find((a) => a.startsWith('--lang=')) || '--lang=en').slice(7);
const expect = (args.find((a) => a.startsWith('--expect=')) || '').slice(9);
const IMG = /\.(jpe?g|png|webp)$/i;
const files = args.filter((a) => !a.startsWith('--')).flatMap((p) => (fs.statSync(p).isDirectory()
    ? fs.readdirSync(p, { recursive: true }).map((f) => path.join(p, f)).filter((f) => IMG.test(f))
    : [p]));

if (!files.length) {
    console.log('Usage: node --env-file=.env.local scripts/test-identify.mjs <photo-or-folder> [...] [--lang=hi]');
    process.exit(1);
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
/** "money-plant_2.jpg" or ".../money plant/2.jpg" -> "moneyplant" */
const expectedOf = (f) => {
    if (expect) return norm(expect);
    const stem = path.basename(f).replace(IMG, '').replace(/[_ ]?\d+$/, '');
    return norm(stem) || norm(path.basename(path.dirname(f)));
};

console.log(`Model: ${ID_MODEL}, language: ${lang}\n`);
let checked = 0;
let right = 0;
for (const f of files) {
    const t0 = Date.now();
    try {
        const r = await identifyPlant(fs.readFileSync(f).toString('base64'), lang);
        const want = expectedOf(f);
        const names = [r.plant_name, r.scientific_name].map(norm);
        const ok = want && names.some((n) => n && (n.includes(want) || want.includes(n)));
        if (want) { checked += 1; if (ok) right += 1; }
        console.log(`${ok ? 'OK  ' : want ? 'MISS' : '    '} ${f}`);
        console.log(`     -> ${r.display_name} (${r.scientific_name}) ${r.confidence}%  [${r.model}, ${((Date.now() - t0) / 1000).toFixed(1)}s]`);
        if (r.alternatives.length) console.log(`     or ${r.alternatives.map((a) => `${a.plant_name} ${a.confidence}%`).join(', ')}`);
        if (r.observations) console.log(`     saw: ${r.observations}`);
    } catch (e) {
        console.log(`ERR  ${f}: ${e.message}`);
    }
}
if (checked) console.log(`\nName matched on ${right}/${checked} (${Math.round((100 * right) / checked)}%)`);
