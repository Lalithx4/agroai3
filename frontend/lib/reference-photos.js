/**
 * Loads the labelled example photos shown to the model before it looks at the farmer's photo.
 *
 * Layout (relative to the frontend folder):
 *   reference-photos/<crop>/<diagnosis_id>/<any name>.jpg|png|webp
 * e.g. reference-photos/tomato/late_blight/1.jpg, reference-photos/tomato/healthy/1.jpg
 *
 * Adding a crop = adding a folder. No code change, no training. Server-only.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'reference-photos');
const PER_CLASS = parseInt(process.env.REFERENCE_PHOTOS_PER_CLASS || '2', 10);
const IMG = /\.(jpe?g|png|webp)$/i;
const cache = new Map();

function dirs(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch { return []; }
}

/** crops that have at least one labelled example folder */
export function referenceCrops() { return dirs(ROOT).filter((c) => dirs(path.join(ROOT, c)).length > 0); }

/**
 * @returns {Promise<Array<{label: string, imageBase64: string}> | null>} null when the crop has no examples
 */
export async function loadReferences(crop) {
  if (!crop || !/^[a-z0-9_-]+$/i.test(crop)) return null;          // never build a path from untrusted text
  if (cache.has(crop)) return cache.get(crop);
  const cropDir = path.join(ROOT, crop);
  const labels = dirs(cropDir).sort((a, b) => (a === 'healthy' ? -1 : b === 'healthy' ? 1 : a.localeCompare(b)));
  if (!labels.length) { cache.set(crop, null); return null; }
  const sharp = (await import('sharp')).default;
  const out = [];
  const perClass = labels.length > 6 ? 1 : PER_CLASS;      // keep the prompt small when a crop has many diseases
  for (const label of labels) {
    const files = fs.readdirSync(path.join(cropDir, label)).filter((f) => IMG.test(f)).sort().slice(0, label === 'healthy' ? Math.max(perClass, 2) : perClass);   // healthy needs the most examples

    for (const f of files) {
      const buf = await sharp(path.join(cropDir, label, f)).rotate().resize(512, 512, { fit: 'inside' }).jpeg({ quality: 88 }).toBuffer();
      out.push({ label, imageBase64: buf.toString('base64') });
    }
  }
  const res = out.length ? out : null;
  cache.set(crop, res);
  return res;
}
