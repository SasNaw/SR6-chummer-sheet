# Spirit Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-device, locally-imported SR6 spirit catalog (6 core spirits, EN/DE) with a loader module, a pure-logic generator, and Load/Clear controls on the character-selection screen — mirroring the existing weapon catalog.

**Architecture:** A pure loader module (`js/spirit-catalog.js`) over a dedicated `localStorage` key, fed by a gitignored JSON catalog. The catalog is produced by a committed pure-logic generator (`tools/build-spirit-catalog.mjs`) that merges a gitignored authored source (`data-local/spirit-source.json`) with localized spirit type-names from the Genesis jar. UI controls live in the existing `js/ui/io.js` IO bar.

**Tech Stack:** Vanilla ES modules, no build step. Node `node --test` for the pure core. `unzip` CLI + Genesis jar for the generator (names only).

## Global Constraints

- Vanilla HTML/CSS/JS, no build step; ES modules require HTTP (dev server).
- The pure core is unit-tested with `node --test`; browser-only code (`localStorage`/DOM) is not Node-tested — use `node --check` + manual browser verification.
- Spirit catalog `localStorage` key is exactly `sr6-spirit-catalog`; it is never written into character data or JSON backups.
- Licensed content (the authored source and the generated catalog) must NEVER be committed. `data-local/` and `*-catalog.json` are already gitignored — keep all spirit data there.
- UI defaults to English; German must be fully translated. `test/i18n.test.js` asserts the German table covers every English key — add both languages for every new key.
- `sw.js` precaches an explicit `ASSETS` array (atomic `addAll`); when adding a JS file, add it to `ASSETS` and bump the `CACHE` version, or offline mode breaks/serves stale code.
- Mirror the weapon-catalog patterns in `js/catalog.js` and `js/ui/io.js` exactly (naming, tolerance, validation): `set*` throws on invalid input, the UI validates with `is*Catalog` before calling.

## File Structure

- Create `js/spirit-catalog.js` — pure loader/accessors + browser-only `localStorage` wrappers. One responsibility: read/validate/shape the spirit catalog.
- Create `test/spirit-catalog.test.js` — unit tests for the pure helpers only.
- Create `tools/build-spirit-catalog.mjs` — committed, pure-logic generator (no rulebook data).
- Create (local, gitignored) `data-local/spirit-source.json` — authored 6-spirit source.
- Create (local, gitignored) `data-local/spirits-catalog.json` — generator output.
- Modify `js/i18n.js` — spirit-catalog UI strings (EN/DE).
- Modify `js/ui/io.js` — Load/Clear spirit catalog controls.
- Modify `sw.js` — add `js/spirit-catalog.js` to `ASSETS`, bump `CACHE`.

---

### Task 1: Spirit catalog loader + unit tests

**Files:**
- Create: `js/spirit-catalog.js`
- Test: `test/spirit-catalog.test.js`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `isSpiritCatalog(obj) -> boolean`
  - `localizedName(entry, lang) -> string|null` where `entry` is `{en, de}`
  - `spiritList(catalog, lang) -> Array<{id, label, spirit}>` sorted by `label`
  - `getSpiritCatalog() -> object|null`
  - `setSpiritCatalog(obj) -> void` (throws if `!isSpiritCatalog(obj)`)
  - `clearSpiritCatalog() -> void`
  - `spiritCatalogCount() -> number`

- [ ] **Step 1: Write the failing tests**

Create `test/spirit-catalog.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSpiritCatalog, localizedName, spiritList } from '../js/spirit-catalog.js';

const CAT = {
  spirits: {
    spirit_of_fire: {
      id: 'spirit_of_fire',
      name: { en: 'Spirits of Fire', de: 'Feuergeister' },
      attributes: { body: 1, agility: 2, reaction: 3, strength: 0, willpower: 0, logic: 0, intuition: 0, charisma: 0, magic: 0, essence: 0 },
      conditionMonitor: 9,
      skills: [{ en: 'Astral', de: 'Astral' }],
      powers: [{ en: 'Astral Form', de: 'astr. Gestalt' }],
      optionalPowers: [{ en: 'Guard', de: 'Schutz' }],
      weaknesses: [{ en: 'Allergy (cold, severe)', de: 'Allergie (kälte, schwer)' }],
    },
    spirit_of_air: {
      id: 'spirit_of_air',
      name: { en: 'Spirits of Air', de: 'Luftgeister' },
      attributes: { body: -2, agility: 3, reaction: 4, strength: -3, willpower: 0, logic: 0, intuition: 0, charisma: 0, magic: 0, essence: 0 },
      conditionMonitor: 8,
      skills: [],
      powers: [{ en: 'Movement', de: 'Bewegung' }],
      optionalPowers: [],
      weaknesses: [],
    },
  },
};

test('isSpiritCatalog validates shape', () => {
  assert.equal(isSpiritCatalog(CAT), true);
  assert.equal(isSpiritCatalog({}), false);
  assert.equal(isSpiritCatalog({ spirits: {} }), false); // empty is not a usable catalog
  assert.equal(isSpiritCatalog(null), false);
});

test('localizedName falls back to English when German is missing', () => {
  assert.equal(localizedName({ en: 'Guard', de: 'Schutz' }, 'de'), 'Schutz');
  assert.equal(localizedName({ en: 'Guard', de: null }, 'de'), 'Guard'); // no DE -> EN
  assert.equal(localizedName({ en: 'Guard', de: 'Schutz' }, 'en'), 'Guard');
  assert.equal(localizedName(null, 'de'), null);
});

test('spiritList yields labelled, sorted entries', () => {
  const list = spiritList(CAT, 'en');
  assert.deepEqual(list.map((s) => s.label), ['Spirits of Air', 'Spirits of Fire']);
  assert.equal(list[0].id, 'spirit_of_air');
  assert.equal(list[0].spirit.conditionMonitor, 8);
  assert.deepEqual(spiritList(null, 'en'), []);
  assert.deepEqual(spiritList({}, 'en'), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/spirit-catalog.test.js`
Expected: FAIL — `Cannot find module '../js/spirit-catalog.js'` (or import error).

- [ ] **Step 3: Write the loader module**

Create `js/spirit-catalog.js`:

```js
// Optional, on-device spirit catalog (generated locally from licensed SR6 data —
// see tools/build-spirit-catalog.mjs). Stored in its own localStorage key, never
// in character data or backups. Pure helpers below are unit-tested; the
// localStorage-backed wrappers are browser-only.

const KEY = 'sr6-spirit-catalog';
let cache; // undefined = not read yet, null = none loaded, object = loaded catalog

// --- Pure helpers -----------------------------------------------------------

export function isSpiritCatalog(obj) {
  return Boolean(
    obj && typeof obj === 'object'
    && obj.spirits && typeof obj.spirits === 'object'
    && Object.keys(obj.spirits).length > 0,
  );
}

// A localized name from an {en, de} pair (spirit names, skills, powers,
// weaknesses). Falls back to English when the German value is missing.
export function localizedName(entry, lang) {
  if (!entry) return null;
  return (lang === 'de' && entry.de) ? entry.de : (entry.en || null);
}

// Spirits as a list with a localized `label`, sorted by that label.
export function spiritList(catalog, lang) {
  if (!isSpiritCatalog(catalog)) return [];
  return Object.values(catalog.spirits)
    .map((s) => ({ id: s.id, label: localizedName(s.name, lang), spirit: s }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

// --- localStorage-backed (browser only) ------------------------------------

export function getSpiritCatalog() {
  if (cache === undefined) {
    try { cache = JSON.parse(localStorage.getItem(KEY)) || null; } catch { cache = null; }
  }
  return cache;
}

export function setSpiritCatalog(obj) {
  if (!isSpiritCatalog(obj)) throw new Error('not a spirit catalog');
  localStorage.setItem(KEY, JSON.stringify(obj));
  cache = obj;
}

export function clearSpiritCatalog() {
  localStorage.removeItem(KEY);
  cache = null;
}

export function spiritCatalogCount() {
  const c = getSpiritCatalog();
  return c ? Object.keys(c.spirits).length : 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/spirit-catalog.test.js`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/spirit-catalog.js test/spirit-catalog.test.js
git commit -m "feat: spirit-catalog loader module + tests"
```

---

### Task 2: Generator + authored local source

**Files:**
- Create: `tools/build-spirit-catalog.mjs`
- Create (local, gitignored): `data-local/spirit-source.json`, `data-local/spirits-catalog.json`

**Interfaces:**
- Consumes: nothing from earlier tasks (standalone Node script).
- Produces: `data-local/spirits-catalog.json` in the shape `isSpiritCatalog` accepts and `spiritList` reads (Task 1).

**Authored source shape** (`data-local/spirit-source.json`) — `spirits` is an object keyed by Genesis spirit id. Each entry:

```json
{
  "spirits": {
    "spirit_of_air": {
      "nameEn": "Spirits of Air",
      "nameDe": "Luftgeister",
      "attributes": { "body": -2, "agility": 3, "reaction": 4, "strength": -3, "willpower": 0, "logic": 0, "intuition": 0, "charisma": 0, "magic": 0, "essence": 0 },
      "conditionMonitor": 8,
      "initiative": "(F*2)+2 +2D6",
      "astralInitiative": "(F*2)+3D6",
      "actions": "1 Major, 3 Minor",
      "movement": "5/10 +5",
      "skills": [ { "en": "Astral", "de": "Astral" } ],
      "powers": [ { "en": "Astral Form", "de": "astr. Gestalt" } ],
      "optionalPowers": [ { "en": "Elemental Attack", "de": "elem. Angriff" } ],
      "weaknesses": [ { "en": "Allergy (inhaled toxins, severe)", "de": "Allergie (Toxine mit Inhalationsvektor, schwer)" } ]
    }
  }
}
```

The six ids (from the Genesis `spirits.xml` core list, matching imported characters): `spirit_of_air`, `spirit_of_beasts`, `spirit_of_earth`, `spirit_of_fire`, `spirit_of_kin`, `spirit_of_water`.

- [ ] **Step 1: Author the local source from the geister HTML**

Render each German HTML file to text and transcribe the data into
`data-local/spirit-source.json`. To read a file as text:

```bash
python3 - "$HOME/Downloads/geister/Luftgeister.html" <<'PY'
import re, html, sys
t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
t = re.sub(r'(?is)<(script|style).*?</\1>', ' ', t)
t = re.sub(r'(?s)<[^>]+>', ' ', t); t = html.unescape(t)
print(re.sub(r'[ \t]+', ' ', t))
PY
```

For each spirit transcribe: attribute Force-offsets (Konstitution→`body`, Geschicklichkeit→`agility`, Reaktion→`reaction`, Stärke→`strength`, Willenskraft→`willpower`, Logik→`logic`, Intuition→`intuition`, Charisma→`charisma`, Magie→`magic`, Essenz→`essence`), `conditionMonitor` (Zustandsmonitor), the `initiative`/`astralInitiative`/`actions`/`movement` display strings, and the `skills` (Fertigkeiten), `powers` (Kräfte), `optionalPowers` (zusätzliche Kräfte), `weaknesses` (Schwächen) lists. The German term is the `de` value verbatim from the HTML; the `en` value is the official SR6 English core term for that game term. Mapping the HTML's side-by-side power columns requires reading per row — keep the three columns separate.

This file is gitignored — it must contain the licensed data and must never be committed. Verify it parses:

```bash
node -e "const s=require('./data-local/spirit-source.json'); console.log(Object.keys(s.spirits).length, 'spirits')"
```
Expected: `6 spirits`.

- [ ] **Step 2: Write the generator**

Create `tools/build-spirit-catalog.mjs`:

```js
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
// English (utf8); *_de = German (latin1). Best-effort: the catalog still builds
// from the source's own nameEn/nameDe when the jar is absent.
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
    name: { en: namesEn[id] || s.nameEn || id, de: namesDe[id] || s.nameDe || null },
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
```

- [ ] **Step 3: Syntax-check the generator**

Run: `node --check tools/build-spirit-catalog.mjs`
Expected: no output (exit 0).

- [ ] **Step 4: Run the generator and verify output**

Run: `node tools/build-spirit-catalog.mjs`
Expected: logs `Wrote data-local/spirits-catalog.json` and `{ spirits: 6 }`.

Verify the output is a valid catalog and German type-names came through:

```bash
node -e "const c=require('./data-local/spirits-catalog.json'); console.log(c.counts, c.spirits.spirit_of_air.name)"
```
Expected: `{ spirits: 6 } { en: 'Spirits of Air', de: 'Luftgeister' }`.

- [ ] **Step 5: Confirm no licensed data is staged, then commit only the generator**

```bash
git status --porcelain data-local/   # expect: no output (data-local is gitignored)
git add tools/build-spirit-catalog.mjs
git commit -m "feat: spirit-catalog generator (local-only, no rulebook data)"
```

---

### Task 3: i18n strings, IO bar controls, and service-worker asset

**Files:**
- Modify: `js/i18n.js`
- Modify: `js/ui/io.js`
- Modify: `sw.js`

**Interfaces:**
- Consumes (from Task 1): `getSpiritCatalog`, `setSpiritCatalog`, `clearSpiritCatalog`, `spiritCatalogCount`, `isSpiritCatalog` from `js/spirit-catalog.js`.
- Consumes (existing): `el` from `js/ui/dom.js`; `t`, `rerender` from `js/app.js`; `readFile` (local to `io.js`).
- Produces: a second catalog row on the character-selection screen.

- [ ] **Step 1: Add EN strings**

In `js/i18n.js`, inside the `en` object, immediately after the existing
`findWeapon: 'Find weapon (catalog)',` line, add:

```js
    // Spirit catalog
    loadSpiritCatalog: 'Load spirit catalog',
    clearSpiritCatalog: 'Clear spirit catalog',
    spiritCatalogStatus: (n) => `Spirit catalog: ${n} spirits`,
    noSpiritCatalog: 'No spirit catalog loaded',
    spiritCatalogLoaded: (n) => `Loaded ${n} spirits.`,
    spiritCatalogInvalid: 'That file is not a spirit catalog.',
    clearSpiritCatalogConfirm: 'Clear the loaded spirit catalog?',
```

- [ ] **Step 2: Add DE strings**

In `js/i18n.js`, inside the `de` object, immediately after the existing
`findWeapon: 'Waffe suchen (Katalog)',` line, add:

```js
    loadSpiritCatalog: 'Geisterkatalog laden',
    clearSpiritCatalog: 'Geisterkatalog löschen',
    spiritCatalogStatus: (n) => `Geisterkatalog: ${n} Geister`,
    noSpiritCatalog: 'Kein Geisterkatalog geladen',
    spiritCatalogLoaded: (n) => `${n} Geister geladen.`,
    spiritCatalogInvalid: 'Diese Datei ist kein Geisterkatalog.',
    clearSpiritCatalogConfirm: 'Geladenen Geisterkatalog löschen?',
```

- [ ] **Step 3: Run the i18n key-parity test**

Run: `node --test test/i18n.test.js`
Expected: PASS — including "German table covers every English key" (proves both tables got all 7 new keys).

- [ ] **Step 4: Import the loader into the IO bar**

In `js/ui/io.js`, change the catalog import line:

```js
import { getCatalog, setCatalog, clearCatalog, catalogCount, isWeaponCatalog } from '../catalog.js';
```

to also import the spirit-catalog functions (only the ones used here; the Magic
section will import `getSpiritCatalog`/`spiritList` later when it consumes the data):

```js
import { getCatalog, setCatalog, clearCatalog, catalogCount, isWeaponCatalog } from '../catalog.js';
import { setSpiritCatalog, clearSpiritCatalog, spiritCatalogCount, isSpiritCatalog } from '../spirit-catalog.js';
```

- [ ] **Step 5: Add the spirit-catalog row**

In `js/ui/io.js`, find the end of `renderIoBar` — the weapon-catalog block that
ends with:

```js
  const clearCat = count
    ? el('button', { class: 'danger', onclick: () => { if (confirm(t('clearCatalogConfirm'))) { clearCatalog(); rerender(); } } }, t('clearCatalog'))
    : null;
  container.append(el('div', { class: 'card row' }, [status, loadCat, clearCat].filter(Boolean)));
}
```

Insert the spirit-catalog block immediately before the final closing `}` of the
function (after the weapon-catalog `container.append(...)`):

```js
  // Spirit catalog (on-device, optional): load a locally-generated catalog file.
  const sCount = spiritCatalogCount();
  const sStatus = el('span', { class: 'muted' }, sCount ? t('spiritCatalogStatus', sCount) : t('noSpiritCatalog'));
  const loadSpirit = el('button', {
    onclick: () => readFile('.json,application/json', (text) => {
      let obj;
      try { obj = JSON.parse(text); } catch { obj = null; }
      if (!isSpiritCatalog(obj)) { alert(t('spiritCatalogInvalid')); return; }
      setSpiritCatalog(obj);
      alert(t('spiritCatalogLoaded', Object.keys(obj.spirits).length));
      rerender();
    }),
  }, t('loadSpiritCatalog'));
  const clearSpirit = sCount
    ? el('button', { class: 'danger', onclick: () => { if (confirm(t('clearSpiritCatalogConfirm'))) { clearSpiritCatalog(); rerender(); } } }, t('clearSpiritCatalog'))
    : null;
  container.append(el('div', { class: 'card row' }, [sStatus, loadSpirit, clearSpirit].filter(Boolean)));
```

- [ ] **Step 6: Syntax-check the UI**

Run: `node --check js/ui/io.js`
Expected: no output (exit 0).

- [ ] **Step 7: Register the new module in the service worker**

In `sw.js`, add `'js/spirit-catalog.js'` to the `ASSETS` array (next to
`'js/catalog.js'`), and bump the cache version:

```js
const CACHE = 'sr6-ammo-v8';
```

- [ ] **Step 8: Full test suite + syntax checks**

Run: `npm test`
Expected: PASS — 64 tests (61 existing + 3 from Task 1), 0 fail.

Run: `node --check js/ui/io.js && node --check sw.js`
Expected: no output (exit 0).

- [ ] **Step 9: Manual browser verification**

Start the dev server (`python3 -m http.server 8000`) and hard-reload
`http://localhost:8000` (bypass the service worker). On the character-selection
screen, below the weapon-catalog row:
- Confirm a status line "No spirit catalog loaded" and a "Load spirit catalog" button.
- Click "Load spirit catalog", choose `data-local/spirits-catalog.json` → alert "Loaded 6 spirits.", status becomes "Spirit catalog: 6 spirits", and a red "Clear spirit catalog" button appears.
- Loading a non-spirit JSON (e.g. a weapon catalog) → alert "That file is not a spirit catalog.", nothing changes.
- Switch language to German → labels/status read in German.
- Click "Clear spirit catalog", confirm → status returns to "No spirit catalog loaded".

- [ ] **Step 10: Commit**

```bash
git add js/i18n.js js/ui/io.js sw.js
git commit -m "feat: load/clear spirit catalog on the character-selection screen"
```

---

## Notes on execution order & ownership

- Task 1 is pure and fully delegatable. Task 3 consumes Task 1's exports.
- Task 2's **Step 1 (authoring `data-local/spirit-source.json`)** requires reading the user's local `geister/` HTML and applying SR6 English terminology — best performed by whoever has the local files and domain knowledge, not a context-free subagent. The generator itself (Steps 2–5) is delegatable.
- Verify after each task that `git status --porcelain data-local/` is empty before committing — the licensed source and catalog must stay untracked.
