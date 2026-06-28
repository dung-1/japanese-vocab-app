#!/usr/bin/env node
/**
 * scripts/fix-bom.mjs
 * Loại bỏ BOM UTF-8 (EF BB BF) khỏi tất cả file .json trong
 * src/assets/kanji-words-data/N2/
 *
 * Chạy: node scripts/fix-bom.mjs
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const TARGET_DIRS = [
  'src/assets/kanji-words-data/N2',
  'src/assets/kanji-words-data/N3',
  'src/assets/kanji-words-data/N4',
  'src/assets/vocab-data/N3',
  'src/assets/vocab-data/N4',
  'src/assets/kanji-radicard-data',
  'src/assets/reduplicative-words-data',
];

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

async function fixFile(path) {
  const buf = await readFile(path);
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    await writeFile(path, buf.subarray(3));
    return true;
  }
  return false;
}

async function walk(dir) {
  let fixed = 0;
  let scanned = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return { fixed, scanned };
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walk(full);
      fixed += sub.fixed;
      scanned += sub.scanned;
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      scanned++;
      if (await fixFile(full)) fixed++;
    }
  }
  return { fixed, scanned };
}

let totalFixed = 0;
let totalScanned = 0;
for (const d of TARGET_DIRS) {
  const { fixed, scanned } = await walk(d);
  if (scanned > 0) {
    console.log(`[fix-bom] ${d}: scanned=${scanned} fixed=${fixed}`);
  }
  totalFixed += fixed;
  totalScanned += scanned;
}
console.log(`[fix-bom] DONE: scanned=${totalScanned} fixed=${totalFixed}`);