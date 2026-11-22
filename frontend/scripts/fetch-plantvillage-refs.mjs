/**
 * Adds labelled example photos for crops from the public PlantVillage dataset.
 *
 *   node scripts/fetch-plantvillage-refs.mjs Tomato Potato Corn Grape Apple Pepper
 *
 * Writes reference-photos/<crop>/<diagnosis_id>/<n>.jpg (first PER_CLASS photos of each group).
 * Uses the GitHub API (60 requests/hour without a token: 1 request to list the groups + 1 per group).
 * Check the dataset licence before redistributing the photos. Your own district photos work better: just put them in the same folders.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'spMohanty/PlantVillage-Dataset';
const OUT = path.join(process.cwd(), 'reference-photos');
const PER_CLASS = parseInt(process.env.PER_CLASS || '2', 10);
const wanted = process.argv.slice(2).map((s) => s.toLowerCase());
if (!wanted.length) { console.log('Usage: node scripts/fetch-plantvillage-refs.mjs Tomato Potato Corn ...'); process.exit(1); }

const H = { 'User-Agent': 'cropmagix-refs' };
const api = async (p) => { const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${p}`, { headers: H }); if (!r.ok) throw new Error(`GitHub ${r.status} for ${p}`); return r.json(); };

const clean = (s) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
function split(dir) {                       // "Corn_(maize)___Common_rust_" -> ["corn", "common_rust"]
  const [crop, cls] = dir.split('___');
  let id = clean(cls || 'unknown');
  if (id.startsWith('spider_mites')) id = 'spider_mites';
  return [clean(crop), id];
}

const groups = (await api('raw/color')).filter((d) => d.type === 'dir').map((d) => d.name);
const chosen = groups.filter((g) => wanted.some((w) => g.toLowerCase().startsWith(w)));
console.log(`${chosen.length} groups: ${chosen.join(', ')}`);
for (const g of chosen) {
  const [crop, id] = split(g);
  const dir = path.join(OUT, crop, id);
  fs.mkdirSync(dir, { recursive: true });
  const have = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).length;
  if (have >= PER_CLASS) { console.log(`  ${crop}/${id}: already has ${have}`); continue; }
  const list = (await api(`raw/color/${encodeURIComponent(g)}`)).filter((x) => /\.jpe?g$/i.test(x.name)).slice(0, PER_CLASS);
  for (let i = 0; i < list.length; i++) {
    const buf = Buffer.from(await (await fetch(list[i].download_url)).arrayBuffer());
    fs.writeFileSync(path.join(dir, `${i + 1}.jpg`), buf);
  }
  console.log(`  ${crop}/${id}: ${list.length} photos`);
}
console.log('done');
