// Local-only generator: extracts the full SR6 weapon/ammo catalog from a licensed
// Genesis install and writes it to data-local/weapons-catalog.json (gitignored).
// This script contains NO copyrighted data — only parsing logic. The OUTPUT is
// licensed content and must never be committed.
//
// Usage:  node tools/build-weapon-catalog.mjs
// Override the jar path with GENESIS_JAR=/path/to/shadowrun6-x.y.z.jar
//
// Requires the dev dependency @xmldom/xmldom (already in package.json) and the
// `unzip` CLI (standard on macOS/Linux).

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';

const HOME = process.env.HOME;
const JAR = process.env.GENESIS_JAR
  || `${HOME}/Library/Application Support/de.rpgframework.Genesis/release/plugins/shadowrun6-2.5.0.jar`;
const OUT = 'data-local/weapons-catalog.json';
const DATA_ROOT = 'org/prelle/rpgframework/shadowrun6/data';

if (!existsSync(JAR)) {
  console.error(`Genesis jar not found: ${JAR}\nSet GENESIS_JAR to your shadowrun6 plugin jar.`);
  process.exit(1);
}

// 1. Extract the SR6 data subtree to a temp dir (never into the repo).
const tmp = mkdtempSync(join(tmpdir(), 'sr6cat-'));
execSync(`unzip -o -q "${JAR}" "${DATA_ROOT}/*" -d "${tmp}"`, { stdio: 'inherit' });
const root = join(tmp, DATA_ROOT);
const books = readdirSync(root).filter((b) => existsSync(join(root, b, 'data')));

const parser = new DOMParser();
const attr = (el, n) => (el.getAttribute ? el.getAttribute(n) : null);
const els = (doc, tag) => Array.from(doc.getElementsByTagName(tag));
const directChild = (el, tag) => Array.from(el.childNodes || []).find((n) => n.nodeName === tag);

// 2. i18n names. Items are keyed item.<id>=Name; ammo types are keyed
//    ammotype.<id>=Name. Base file = English; *_de / *_fr = translations.
const names = {}; const namesDe = {}; const namesFr = {};
const typeNames = {}; const typeNamesDe = {};
function readProps(path, encoding, itemTarget, typeTarget) {
  const text = readFileSync(path, encoding);
  for (const line of text.split(/\r?\n/)) {
    let m = line.match(/^item\.([A-Za-z0-9_-]+)=(.*)$/);
    if (m) { if (itemTarget) itemTarget[m[1]] = m[2].trim(); continue; }
    m = line.match(/^ammotype\.([A-Za-z0-9_-]+)=(.*)$/);
    if (m && typeTarget) typeTarget[m[1]] = m[2].trim();
  }
}
for (const book of books) {
  const i18nDir = join(root, book, 'i18n');
  if (!existsSync(i18nDir)) continue;
  for (const f of readdirSync(i18nDir)) {
    if (!f.endsWith('.properties') || f.includes('-help')) continue;
    const p = join(i18nDir, f);
    if (f.includes('_de.')) readProps(p, 'latin1', namesDe, typeNamesDe);
    else if (f.includes('_fr.')) readProps(p, 'latin1', namesFr, null);
    else if (!/_[a-z]{2}\./.test(f)) readProps(p, 'utf8', names, typeNames); // base = English
  }
}

// 3. Ammo categories + subtype -> category map (from gear_ammunition.xml).
const subtypeToCategory = {};
const ammoCategoryIds = new Set();
const categorySubtypes = {}; // category id -> Set of weapon subtypes it serves
// 4. Ammo types (regular/apds/...) from ammunition_types.xml.
const ammoTypeIds = new Set();

function eachDataFile(cb) {
  for (const book of books) {
    const dataDir = join(root, book, 'data');
    if (!existsSync(dataDir)) continue;
    for (const f of readdirSync(dataDir)) {
      if (f.endsWith('.xml')) cb(f, join(dataDir, f), book);
    }
  }
}

eachDataFile((f, path) => {
  if (f === 'gear_ammunition.xml') {
    const doc = parser.parseFromString(readFileSync(path, 'utf8'), 'text/xml');
    for (const item of els(doc, 'item')) {
      const id = attr(item, 'id');
      if (!id) continue;
      ammoCategoryIds.add(id);
      categorySubtypes[id] ||= new Set();
      for (const req of els(item, 'itemsubtypereq')) {
        for (const st of (attr(req, 'type') || '').split(',').map((s) => s.trim()).filter(Boolean)) {
          categorySubtypes[id].add(st);
          if (!subtypeToCategory[st]) subtypeToCategory[st] = id;
        }
      }
    }
  } else if (f === 'ammunition_types.xml') {
    const doc = parser.parseFromString(readFileSync(path, 'utf8'), 'text/xml');
    for (const t of els(doc, 'ammotype')) {
      const id = attr(t, 'id');
      if (id) ammoTypeIds.add(id);
    }
  }
});

// 5. Firearms: any item with a <weapon> that has a numeric magazine ("15(c)").
const weapons = {};
eachDataFile((f, path, book) => {
  if (!f.startsWith('gear_')) return;
  const doc = parser.parseFromString(readFileSync(path, 'utf8'), 'text/xml');
  for (const item of els(doc, 'item')) {
    const id = attr(item, 'id');
    const weapon = directChild(item, 'weapon');
    const useas = directChild(item, 'useas');
    if (!id || !weapon || !useas) continue;
    const type = attr(useas, 'type') || '';
    if (!type.startsWith('WEAPON')) continue;
    const ammoStr = attr(weapon, 'ammo') || '';
    const mag = parseInt(ammoStr, 10);
    if (!Number.isInteger(mag)) continue; // skip weapons without a numeric magazine (most melee)
    const subtype = attr(useas, 'subtype') || null;
    const modes = (attr(weapon, 'mode') || '').split('/').map((s) => s.trim()).filter(Boolean);
    if (weapons[id]) continue; // first sourcebook wins
    weapons[id] = {
      id,
      name: names[id] || id,
      nameDe: namesDe[id] || null,
      nameFr: namesFr[id] || null,
      subtype,
      ammoCategory: subtype ? (subtypeToCategory[subtype] || null) : null,
      magazineCapacity: mag,
      reload: (ammoStr.match(/\(([^)]+)\)/) || [, null])[1], // c/m/b/d (clip/magazine/break/drum)
      firingModes: modes,
      source: book,
    };
  }
});

// Keep only ammunition for firearms / bows / crossbows. Explicit set of
// conventional weapon subtypes; energy weapons (lasers/pulse), flamethrowers
// (THROWERS), grenades, rockets, etc. are excluded. Laser/pulse/gas weapons share
// the OTHER_SPECIAL subtype with dart guns, so their "battery"/"gas" ammo is
// dropped by id.
const ALLOWED_SUBTYPES = new Set([
  'BOWS', 'CROSSBOWS',
  'HOLDOUTS', 'PISTOLS_LIGHT', 'PISTOLS_HEAVY', 'MACHINE_PISTOLS', 'SUBMACHINE_GUNS',
  'RIFLE_ASSAULT', 'RIFLE_HUNTING', 'RIFLE_SNIPER', 'SHOTGUNS',
  'LMG', 'MMG', 'HMG', 'ASSAULT_CANNON', 'TASERS', 'OTHER_SPECIAL',
]);
const isProjectileAmmo = (id) => {
  if (/battery|gas/i.test(id)) return false;
  const reqs = categorySubtypes[id];
  return reqs && [...reqs].some((st) => ALLOWED_SUBTYPES.has(st));
};

const ammoCategories = {};
for (const id of [...ammoCategoryIds].sort()) {
  if (!isProjectileAmmo(id)) continue;
  ammoCategories[id] = { en: names[id] || null, de: namesDe[id] || null };
}
const ammoTypes = {};
for (const id of [...ammoTypeIds].sort()) ammoTypes[id] = { en: typeNames[id] || null, de: typeNamesDe[id] || null };

mkdirSync('data-local', { recursive: true });
const out = {
  source: 'Genesis (de.rpgframework) — licensed SR6 data, local use only',
  jar: JAR.split('/').pop(),
  counts: { weapons: Object.keys(weapons).length, ammoCategories: Object.keys(ammoCategories).length, ammoTypes: Object.keys(ammoTypes).length },
  weapons,
  ammoCategories,
  ammoTypes,
};
writeFileSync(OUT, JSON.stringify(out, null, 2));

console.log(`Wrote ${OUT}`);
console.log(out.counts);
for (const id of ['ares_predator_vi', 'fn_har', 'remington_roomsweeper']) {
  console.log(id, '→', JSON.stringify(weapons[id]));
}
