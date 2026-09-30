// Local-only generator: extracts every SR6 drone (items of type DRONE_*) with its
// vehicle stats from a licensed Genesis install and writes
// data-local/drones-catalog.json (gitignored). This script contains NO rulebook
// data — only parsing logic. The OUTPUT is licensed content and must never be
// committed.
//
// Usage:  node tools/build-drone-catalog.mjs
// Override the jar path with GENESIS_JAR=/path/to/shadowrun6-x.y.z.jar
//
// Requires the dev dependency @xmldom/xmldom and the `unzip` CLI.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';

const HOME = process.env.HOME;
const JAR = process.env.GENESIS_JAR
  || `${HOME}/Library/Application Support/de.rpgframework.Genesis/release/plugins/shadowrun6-2.5.0.jar`;
const OUT = 'data-local/drones-catalog.json';
const DATA_ROOT = 'org/prelle/rpgframework/shadowrun6/data';

if (!existsSync(JAR)) {
  console.error(`Genesis jar not found: ${JAR}\nSet GENESIS_JAR to your shadowrun6 plugin jar.`);
  process.exit(1);
}

// 1. Extract the SR6 data subtree to a temp dir (never into the repo).
const tmp = mkdtempSync(join(tmpdir(), 'sr6drone-'));
execSync(`unzip -o -q "${JAR}" "${DATA_ROOT}/*" -d "${tmp}"`, { stdio: 'inherit' });
const root = join(tmp, DATA_ROOT);
// Core first: later books (e.g. Double Clutch) re-list core drones; the first
// definition seen wins.
const books = readdirSync(root)
  .filter((b) => existsSync(join(root, b, 'data')))
  .sort((a, b) => (a === 'core' ? -1 : b === 'core' ? 1 : a.localeCompare(b)));

// 2. i18n names (item.<id>=Name). Base file = English (utf8); *_de = German (latin1).
const namesEn = {}; const namesDe = {};
for (const book of books) {
  const i18nDir = join(root, book, 'i18n');
  if (!existsSync(i18nDir)) continue;
  for (const f of readdirSync(i18nDir)) {
    if (!f.endsWith('.properties') || f.includes('-help')) continue;
    const isDe = f.includes('_de.');
    if (!isDe && /_[a-z]{2}\./.test(f)) continue; // skip other translations
    const text = readFileSync(join(i18nDir, f), isDe ? 'latin1' : 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^item\.([A-Za-z0-9_-]+)=(.*)$/);
      if (m) (isDe ? namesDe : namesEn)[m[1]] = m[2].trim();
    }
  }
}

// 3. Drones from every data file.
const parser = new DOMParser();
const num = (v) => (v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const drones = {};
for (const book of books) {
  const dataDir = join(root, book, 'data');
  for (const f of readdirSync(dataDir)) {
    if (!f.endsWith('.xml')) continue;
    const doc = parser.parseFromString(readFileSync(join(dataDir, f), 'utf8'), 'text/xml');
    for (const it of Array.from(doc.getElementsByTagName('item'))) {
      const type = it.getAttribute('type') || '';
      const id = it.getAttribute('id');
      if (!id || !type.startsWith('DRONE_') || drones[id]) continue;
      const v = Array.from(it.childNodes || []).find((n) => n.nodeName === 'vehicle');
      if (!v) continue;
      drones[id] = {
        id,
        name: { en: namesEn[id] || id, de: namesDe[id] || null },
        size: type,
        subtype: it.getAttribute('subtype') || null,
        stats: {
          handling: v.getAttribute('han') || null,
          acceleration: num(v.getAttribute('acc')),
          speedInterval: num(v.getAttribute('spdi')),
          topSpeed: num(v.getAttribute('tspd')),
          body: num(v.getAttribute('bod')),
          armor: num(v.getAttribute('arm')),
          pilot: num(v.getAttribute('pil')),
          sensor: num(v.getAttribute('sen')),
        },
      };
    }
  }
}

mkdirSync('data-local', { recursive: true });
writeFileSync(OUT, JSON.stringify({ version: 1, drones }, null, 2));
console.log(`Wrote ${OUT} (${Object.keys(drones).length} drones)`);
