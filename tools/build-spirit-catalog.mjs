// Local-only generator: merges the authored spirit source (data-local/spirit-source.json)
// with localized spirit type-names extracted from a licensed Genesis install, and
// writes data-local/spirits-catalog.json (gitignored). This script contains NO
// rulebook data — only structure/validation logic and the Genesis name lookup. The
// authored source and the OUTPUT are licensed content and must never be committed.
//
// Usage:  node tools/build-spirit-catalog.mjs
// Override the jar path with GENESIS_JAR=/path/to/shadowrun6-x.y.z.jar

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOME = process.env.HOME;
const JAR = process.env.GENESIS_JAR
  || `${HOME}/Library/Application Support/de.rpgframework.Genesis/release/plugins/shadowrun6-2.5.0.jar`;
const SRC = 'data-local/spirit-source.json';
const OUT = 'data-local/spirits-catalog.json';
const DATA_ROOT = 'org/prelle/rpgframework/shadowrun6/data';

if (!existsSync(SRC)) {
  console.error(`Authored source not found: ${SRC}\nCreate it first (see the spirit-catalog spec for the shape).`);
  process.exit(1);
}
const source = JSON.parse(readFileSync(SRC, 'utf8'));

// Localized spirit type-names from Genesis i18n (spirit.<id>=Name). Base file =
// English (utf8); *_de = German (latin1). Used only as a FALLBACK — the authored
// source's nameEn/nameDe win (Genesis stores plural type names like "Erdgeister";
// the source uses the singular "Erdgeist" shown in the UI).
const namesEn = {}; const namesDe = {};
if (existsSync(JAR)) {
  const tmp = mkdtempSync(join(tmpdir(), 'sr6spirit-'));
  execSync(`unzip -o -q "${JAR}" "${DATA_ROOT}/*" -d "${tmp}"`, { stdio: 'inherit' });
  const root = join(tmp, DATA_ROOT);
  for (const book of readdirSync(root)) {
    const i18nDir = join(root, book, 'i18n');
    if (!existsSync(i18nDir)) continue;
    for (const f of readdirSync(i18nDir)) {
      if (!f.endsWith('.properties') || f.includes('-help')) continue;
      const isDe = f.includes('_de.');
      if (!isDe && /_[a-z]{2}\./.test(f)) continue; // skip non-English translations
      const text = readFileSync(join(i18nDir, f), isDe ? 'latin1' : 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^spirit\.([A-Za-z0-9_-]+)=(.*)$/);
        if (m) (isDe ? namesDe : namesEn)[m[1]] = m[2].trim();
      }
    }
  }
} else {
  console.warn(`Genesis jar not found at ${JAR}; using source-provided names only.`);
}

const REQUIRED = ['attributes', 'conditionMonitor', 'skills', 'powers', 'optionalPowers'];
const spirits = {};
for (const [id, s] of Object.entries(source.spirits || {})) {
  for (const field of REQUIRED) {
    if (!(field in s)) throw new Error(`spirit "${id}" missing required field "${field}"`);
  }
  spirits[id] = {
    id,
    name: { en: s.nameEn || namesEn[id] || id, de: s.nameDe || namesDe[id] || null },
    attributes: s.attributes,
    conditionMonitor: s.conditionMonitor,
    initiative: s.initiative ?? null,
    astralInitiative: s.astralInitiative ?? null,
    actions: s.actions ?? null,
    movement: s.movement ?? null,
    skills: s.skills,
    powers: s.powers,
    optionalPowers: s.optionalPowers,
    weaknesses: s.weaknesses ?? [],
  };
}

mkdirSync('data-local', { recursive: true });
const out = {
  source: 'geister/ HTML (GRW) + Genesis names — licensed SR6 data, local use only',
  jar: existsSync(JAR) ? JAR.split('/').pop() : null,
  counts: { spirits: Object.keys(spirits).length },
  spirits,
};
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`Wrote ${OUT}`);
console.log(out.counts);
