# SR6 Ammo Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-friendly, offline-capable web app for tracking Shadowrun 6 weapon ammunition across multiple characters, with `sr6char` XML import and JSON backup.

**Architecture:** Vanilla HTML/CSS/JS using native ES modules, no build step. Pure logic modules (`util`, `ammo-db`, `weapons-db`, `model`, `xml-import`, `store` serialization) are unit-tested with Node's built-in test runner. The UI is thin render functions over a single in-memory state object that is persisted to `localStorage` on every mutation. Ships as a PWA on GitHub Pages.

**Tech Stack:** HTML5, CSS3, ES2020 JavaScript modules, `localStorage`, Service Worker + Web App Manifest, `node --test` (dev only), `@xmldom/xmldom` (test-only devDependency for parsing XML in Node).

## Global Constraints

- No bundler, framework, or runtime `node_modules`. The shipped app loads only static files.
- ES modules everywhere (`import`/`export`); `package.json` has `"type": "module"`.
- The only devDependency is `@xmldom/xmldom`, used solely in tests.
- All logic-module functions are **pure**: they take state and return new state; they never mutate inputs and never touch `localStorage`, the DOM, or globals (except `newId`/`importFromXmlString`, which are explicitly the impure seams).
- Persistence key: `localStorage` key `"sr6-ammo-tracker"`, holding `{ version: 1, characters: [...], activeId: string|null }`.
- IDs come from `globalThis.crypto.randomUUID()` (available in modern browsers over HTTPS/localhost and in Node ≥ 20).
- Tests live in `test/*.test.js`, run with `node --test`.
- Commit after every task with a `feat:`/`test:`/`chore:` prefix.

## Canonical Data Shapes

Used across all tasks — copy verbatim:

```js
// ReservePool — uniquely identified by (ammoCategory, ammoType)
{ ammoCategory: "ammo_rifles", ammoType: "regular", count: 29 }

// FiringMode
{ mode: "BF", rounds: 3 }

// Weapon
{
  id: "uuid",
  name: "FN HAR",
  ref: "fn_har",
  mount: "carried",            // "carried" or a vehicle/drone display name
  magazineCapacity: 20,
  ammoCategory: "ammo_rifles", // or null if unknown
  firingModes: [ { mode, rounds }, ... ],
  loaded: { ammoType: "regular", count: 20 },
  notes: ""
}

// Character
{ id: "uuid", name: "S4T0", realName: "Kenji \"Ken\" Sato", weapons: [Weapon], reserves: [ReservePool] }

// App state
{ version: 1, characters: [Character], activeId: "uuid"|null }
```

---

### Task 1: Project scaffolding + utilities

**Files:**
- Create: `package.json`
- Create: `js/util.js`
- Create: `test/util.test.js`
- Create: `README.md`

**Interfaces:**
- Produces: `prettifyRef(ref: string): string`, `clamp(n, min, max): number`, `newId(): string`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "sr6-ammo-tracker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "devDependencies": {
    "@xmldom/xmldom": "^0.9.6"
  }
}
```

- [ ] **Step 2: Install the test-only dependency**

Run: `npm install`
Expected: creates `node_modules/` and `package-lock.json`; `@xmldom/xmldom` is present.

- [ ] **Step 3: Write the failing test** — `test/util.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prettifyRef, clamp, newId } from '../js/util.js';

test('prettifyRef turns refs into human-readable names', () => {
  assert.equal(prettifyRef('ares_predator_vi'), 'Ares Predator Vi');
  assert.equal(prettifyRef('mct-nissan_roto_drone'), 'Mct Nissan Roto Drone');
  assert.equal(prettifyRef(''), '');
});

test('clamp constrains a number to a range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

test('newId returns unique uuid-shaped strings', () => {
  const a = newId();
  const b = newId();
  assert.match(a, /^[0-9a-f-]{36}$/);
  assert.notEqual(a, b);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `node --test test/util.test.js`
Expected: FAIL — cannot find module `../js/util.js`.

- [ ] **Step 5: Implement `js/util.js`**

```js
export function prettifyRef(ref) {
  if (!ref) return '';
  return ref
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function newId() {
  return globalThis.crypto.randomUUID();
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test test/util.test.js`
Expected: PASS (3 tests).

- [ ] **Step 7: Write `README.md`**

```markdown
# SR6 Ammo Tracker

A mobile-friendly, offline web app for tracking Shadowrun 6 weapon ammunition
across multiple characters. Vanilla HTML/CSS/JS, no build step, installable as a
PWA. Import characters from `sr6char` XML exports; back up everything as JSON.

## Develop

Run tests: `npm install` then `npm test`.

Serve locally (ES modules need HTTP, not `file://`):
`python3 -m http.server 8000` then open http://localhost:8000

## Deploy

GitHub Pages, served from the `main` branch root. Pushing publishes.
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json js/util.js test/util.test.js README.md
git commit -m "chore: scaffold project with utilities and test harness"
```

---

### Task 2: Ammo reference data (`ammo-db.js`)

**Files:**
- Create: `js/ammo-db.js`
- Create: `test/ammo-db.test.js`

**Interfaces:**
- Consumes: `prettifyRef` from `js/util.js`
- Produces: `AMMO_CATEGORIES: Record<ref,string>`, `AMMO_TYPES: string[]`, `categoryName(ref): string`

- [ ] **Step 1: Write the failing test** — `test/ammo-db.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMMO_CATEGORIES, AMMO_TYPES, categoryName } from '../js/ammo-db.js';

test('AMMO_CATEGORIES covers the canonical SR6 pools', () => {
  const refs = Object.keys(AMMO_CATEGORIES);
  for (const r of [
    'ammo_holdout_light_machine', 'ammo_heavy_smg', 'ammo_rifles', 'ammo_shotgun',
    'ammo_machine_gun', 'ammo_cannon', 'ammo_taser', 'ammo_darts', 'ammo_dmso',
    'ammo_arrow', 'ammo_injection_arrow',
  ]) {
    assert.ok(refs.includes(r), `missing category ${r}`);
  }
});

test('AMMO_TYPES includes regular and the common special rounds', () => {
  assert.ok(AMMO_TYPES.includes('regular'));
  assert.ok(AMMO_TYPES.includes('APDS'));
  assert.ok(AMMO_TYPES.includes('explosive'));
});

test('categoryName returns the display name, or prettifies unknown refs', () => {
  assert.equal(categoryName('ammo_heavy_smg'), 'Heavy Pistol / SMG');
  assert.equal(categoryName('ammo_grenade'), 'Ammo Grenade');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/ammo-db.test.js`
Expected: FAIL — cannot find module `../js/ammo-db.js`.

- [ ] **Step 3: Implement `js/ammo-db.js`**

```js
import { prettifyRef } from './util.js';

// Canonical SR6 ammunition categories (which weapon families share which ammo).
export const AMMO_CATEGORIES = {
  ammo_holdout_light_machine: 'Holdout / Light / Machine Pistol',
  ammo_heavy_smg: 'Heavy Pistol / SMG',
  ammo_rifles: 'Rifle',
  ammo_shotgun: 'Shotgun',
  ammo_machine_gun: 'Machine Gun',
  ammo_cannon: 'Cannon / Assault Cannon',
  ammo_taser: 'Taser Dart',
  ammo_darts: 'Dart',
  ammo_dmso: 'DMSO Rounds',
  ammo_arrow: 'Arrow',
  ammo_injection_arrow: 'Injection Arrow',
};

// Default, user-extensible list of ammo types within a category.
export const AMMO_TYPES = [
  'regular', 'APDS', 'explosive', 'ex-explosive', 'gel', 'flechette',
  'stick-n-shock', 'tracer', 'hollow-point', 'subsonic', 'frangible', 'capsule',
];

export function categoryName(ref) {
  return AMMO_CATEGORIES[ref] || prettifyRef(ref);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/ammo-db.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add js/ammo-db.js test/ammo-db.test.js
git commit -m "feat: add ammo category and type reference data"
```

---

### Task 3: Weapon lookup table (`weapons-db.js`)

**Files:**
- Create: `js/weapons-db.js`
- Create: `test/weapons-db.test.js`

**Interfaces:**
- Consumes: `prettifyRef` from `js/util.js`
- Produces: `WEAPONS_DB: Record<ref,WeaponDef>`, `getWeaponDef(ref): WeaponDef` where `WeaponDef = { name, magazineCapacity, ammoCategory, firingModes:[{mode,rounds}] }`. The fallback for unknown refs is `{ name: prettifyRef(ref), magazineCapacity: 10, ammoCategory: null, firingModes: [{mode:'SS',rounds:1},{mode:'SA',rounds:1}] }`.

Note: magazine sizes and firing-mode costs are editable defaults, not authoritative rules.

- [ ] **Step 1: Write the failing test** — `test/weapons-db.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS_DB, getWeaponDef } from '../js/weapons-db.js';

test('known weapons resolve to full definitions', () => {
  const har = getWeaponDef('fn_har');
  assert.equal(har.name, 'FN HAR');
  assert.equal(har.ammoCategory, 'ammo_rifles');
  assert.ok(har.magazineCapacity > 0);
  assert.ok(har.firingModes.some((m) => m.mode === 'FA'));
});

test('heavy pistols share SMG ammo', () => {
  assert.equal(getWeaponDef('ares_predator_vi').ammoCategory, 'ammo_heavy_smg');
});

test('unknown refs fall back to a prettified, editable default', () => {
  const def = getWeaponDef('some_unknown_gun');
  assert.equal(def.name, 'Some Unknown Gun');
  assert.equal(def.magazineCapacity, 10);
  assert.equal(def.ammoCategory, null);
  assert.deepEqual(def.firingModes, [
    { mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 1 },
  ]);
});

test('WEAPONS_DB entries are distinct objects (no shared mutation)', () => {
  assert.notEqual(getWeaponDef('fn_har').firingModes, getWeaponDef('fn_har').firingModes);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/weapons-db.test.js`
Expected: FAIL — cannot find module `../js/weapons-db.js`.

- [ ] **Step 3: Implement `js/weapons-db.js`**

```js
import { prettifyRef } from './util.js';

// ref -> { name, magazineCapacity, ammoCategory, firingModes }
// Magazine sizes and firing-mode round costs are sensible defaults the user edits.
export const WEAPONS_DB = {
  ares_predator_vi: {
    name: 'Ares Predator VI', magazineCapacity: 15, ammoCategory: 'ammo_heavy_smg',
    firingModes: [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 1 }],
  },
  fn_har: {
    name: 'FN HAR', magazineCapacity: 20, ammoCategory: 'ammo_rifles',
    firingModes: [{ mode: 'SA', rounds: 1 }, { mode: 'BF', rounds: 3 }, { mode: 'FA', rounds: 6 }],
  },
  remington_roomsweeper: {
    name: 'Remington Roomsweeper', magazineCapacity: 8, ammoCategory: 'ammo_shotgun',
    firingModes: [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 1 }],
  },
};

function cloneDef(def) {
  return { ...def, firingModes: def.firingModes.map((m) => ({ ...m })) };
}

export function getWeaponDef(ref) {
  if (WEAPONS_DB[ref]) return cloneDef(WEAPONS_DB[ref]);
  return {
    name: prettifyRef(ref),
    magazineCapacity: 10,
    ammoCategory: null,
    firingModes: [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 1 }],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/weapons-db.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add js/weapons-db.js test/weapons-db.test.js
git commit -m "feat: add weapon lookup table with editable defaults"
```

---

### Task 4: Model factories (`model.js` part 1)

**Files:**
- Create: `js/model.js`
- Create: `test/model-factories.test.js`

**Interfaces:**
- Consumes: `newId` from `js/util.js`
- Produces: `createReservePool(props): ReservePool`, `createWeapon(props): Weapon`, `createCharacter(props): Character` (shapes per "Canonical Data Shapes"). All accept an optional `id` for deterministic tests and deep-clone array/object fields.

- [ ] **Step 1: Write the failing test** — `test/model-factories.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReservePool, createWeapon, createCharacter } from '../js/model.js';

test('createReservePool fills defaults', () => {
  assert.deepEqual(createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 5 }),
    { ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 5 });
  assert.deepEqual(createReservePool({ ammoCategory: 'ammo_rifles' }),
    { ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 0 });
});

test('createWeapon assigns an id and a default empty magazine', () => {
  const w = createWeapon({ name: 'Test', magazineCapacity: 10 });
  assert.match(w.id, /^[0-9a-f-]{36}$/);
  assert.equal(w.mount, 'carried');
  assert.deepEqual(w.loaded, { ammoType: 'regular', count: 0 });
  assert.deepEqual(w.firingModes, []);
});

test('createWeapon honours an explicit id and loaded value', () => {
  const w = createWeapon({ id: 'fixed', name: 'X', magazineCapacity: 5, loaded: { ammoType: 'APDS', count: 5 } });
  assert.equal(w.id, 'fixed');
  assert.deepEqual(w.loaded, { ammoType: 'APDS', count: 5 });
});

test('createCharacter builds an empty character', () => {
  const c = createCharacter({ name: 'S4T0' });
  assert.equal(c.name, 'S4T0');
  assert.equal(c.realName, '');
  assert.deepEqual(c.weapons, []);
  assert.deepEqual(c.reserves, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/model-factories.test.js`
Expected: FAIL — cannot find module `../js/model.js`.

- [ ] **Step 3: Implement factories in `js/model.js`**

```js
import { newId, clamp } from './util.js';

export function createReservePool(props = {}) {
  const { ammoCategory, ammoType = 'regular', count = 0 } = props;
  return { ammoCategory, ammoType, count };
}

export function createWeapon(props = {}) {
  const {
    name = '', ref = '', mount = 'carried', magazineCapacity = 0,
    ammoCategory = null, firingModes = [], loaded, notes = '', id,
  } = props;
  return {
    id: id || newId(),
    name, ref, mount, magazineCapacity, ammoCategory,
    firingModes: firingModes.map((m) => ({ ...m })),
    loaded: loaded ? { ...loaded } : { ammoType: 'regular', count: 0 },
    notes,
  };
}

export function createCharacter(props = {}) {
  const { name = '', realName = '', weapons = [], reserves = [], id } = props;
  return {
    id: id || newId(),
    name, realName,
    weapons: weapons.map((w) => ({ ...w })),
    reserves: reserves.map((r) => ({ ...r })),
  };
}
```

(`clamp` import is used by Task 5; leave it imported now.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/model-factories.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add js/model.js test/model-factories.test.js
git commit -m "feat: add model entity factories"
```

---

### Task 5: Weapon round operations (`model.js` part 2)

**Files:**
- Modify: `js/model.js`
- Create: `test/model-weapon-ops.test.js`

**Interfaces:**
- Consumes: `clamp` from `js/util.js`, `createWeapon` (in tests)
- Produces (all pure, return a new Weapon, never mutate input):
  - `fire(weapon, mode): Weapon` — subtract the matching firing mode's `rounds`, floored at 0; throws `Error` if `mode` is not in `weapon.firingModes`.
  - `spend(weapon, n=1): Weapon` — subtract `n`, floored at 0.
  - `addRounds(weapon, n=1): Weapon` — add `n`, capped at `magazineCapacity`.
  - `setLoaded(weapon, n): Weapon` — set count to `clamp(n, 0, magazineCapacity)`.

- [ ] **Step 1: Write the failing test** — `test/model-weapon-ops.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeapon, fire, spend, addRounds, setLoaded } from '../js/model.js';

function har() {
  return createWeapon({
    name: 'FN HAR', magazineCapacity: 20,
    firingModes: [{ mode: 'SA', rounds: 1 }, { mode: 'BF', rounds: 3 }, { mode: 'FA', rounds: 6 }],
    loaded: { ammoType: 'regular', count: 20 },
  });
}

test('fire subtracts the mode round cost', () => {
  assert.equal(fire(har(), 'BF').loaded.count, 17);
  assert.equal(fire(har(), 'FA').loaded.count, 14);
});

test('fire floors at zero, never negative', () => {
  const low = createWeapon({ magazineCapacity: 20, firingModes: [{ mode: 'FA', rounds: 6 }], loaded: { ammoType: 'regular', count: 2 } });
  assert.equal(fire(low, 'FA').loaded.count, 0);
});

test('fire throws on an unsupported mode', () => {
  assert.throws(() => fire(har(), 'BF2'), /mode/i);
});

test('fire does not mutate the input weapon', () => {
  const w = har();
  fire(w, 'BF');
  assert.equal(w.loaded.count, 20);
});

test('spend and addRounds clamp to [0, capacity]', () => {
  assert.equal(spend(har(), 5).loaded.count, 15);
  assert.equal(spend(har(), 999).loaded.count, 0);
  const empty = setLoaded(har(), 0);
  assert.equal(addRounds(empty, 3).loaded.count, 3);
  assert.equal(addRounds(har(), 5).loaded.count, 20);
});

test('setLoaded clamps to capacity', () => {
  assert.equal(setLoaded(har(), 7).loaded.count, 7);
  assert.equal(setLoaded(har(), 99).loaded.count, 20);
  assert.equal(setLoaded(har(), -4).loaded.count, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/model-weapon-ops.test.js`
Expected: FAIL — `fire` is not exported.

- [ ] **Step 3: Add operations to `js/model.js`** (append below the factories)

```js
function withCount(weapon, count) {
  return { ...weapon, loaded: { ...weapon.loaded, count } };
}

export function fire(weapon, mode) {
  const fm = weapon.firingModes.find((m) => m.mode === mode);
  if (!fm) throw new Error(`Unknown firing mode "${mode}"`);
  return withCount(weapon, Math.max(0, weapon.loaded.count - fm.rounds));
}

export function spend(weapon, n = 1) {
  return withCount(weapon, Math.max(0, weapon.loaded.count - n));
}

export function addRounds(weapon, n = 1) {
  return withCount(weapon, Math.min(weapon.magazineCapacity, weapon.loaded.count + n));
}

export function setLoaded(weapon, n) {
  return withCount(weapon, clamp(n, 0, weapon.magazineCapacity));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/model-weapon-ops.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add js/model.js test/model-weapon-ops.test.js
git commit -m "feat: add weapon round operations (fire/spend/add/set)"
```

---

### Task 6: Reserves and reload (`model.js` part 3)

**Files:**
- Modify: `js/model.js`
- Create: `test/model-reload.test.js`

**Interfaces:**
- Consumes: `createCharacter`, `createWeapon`, `createReservePool`
- Produces (pure, operate on a Character, return a new Character unless noted):
  - `matchingReserves(character, weaponId): ReservePool[]` — reserves whose `ammoCategory` equals the weapon's.
  - `reload(character, weaponId, chosenType): Character` — implements the spec reload algorithm. If no matching pool of `chosenType` exists, returns the character unchanged.
  - `addReserve(character, pool): Character` — adds a pool; if `(category,type)` already exists, sums the counts.
  - `setReserveCount(character, ammoCategory, ammoType, count): Character` — sets an existing pool's count (floored at 0); no-op if absent.
  - `removeReserve(character, ammoCategory, ammoType): Character` — removes a pool.

- [ ] **Step 1: Write the failing test** — `test/model-reload.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter, createWeapon, createReservePool,
  matchingReserves, reload, addReserve, setReserveCount, removeReserve,
} from '../js/model.js';

function setup(reserves, loaded = { ammoType: 'regular', count: 7 }) {
  const weapon = createWeapon({ id: 'w1', name: 'FN HAR', magazineCapacity: 20, ammoCategory: 'ammo_rifles', loaded });
  return createCharacter({ name: 'T', weapons: [weapon], reserves });
}

test('matchingReserves filters by ammoCategory', () => {
  const c = setup([
    createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 29 }),
    createReservePool({ ammoCategory: 'ammo_shotgun', ammoType: 'regular', count: 6 }),
  ]);
  assert.equal(matchingReserves(c, 'w1').length, 1);
  assert.equal(matchingReserves(c, 'w1')[0].ammoCategory, 'ammo_rifles');
});

test('reload tops off the magazine from the matching pool', () => {
  const c = reload(setup([createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 29 })]), 'w1', 'regular');
  assert.equal(c.weapons[0].loaded.count, 20);
  assert.equal(c.reserves[0].count, 16); // 29 - (20-7)
});

test('reload is partial when the reserve is low', () => {
  const c = reload(setup([createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 5 })]), 'w1', 'regular');
  assert.equal(c.weapons[0].loaded.count, 12); // 7 + 5
  assert.equal(c.reserves[0].count, 0);
});

test('switching ammo type returns leftover rounds to reserve', () => {
  const c = reload(setup([
    createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 0 }),
    createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'APDS', count: 30 }),
  ]), 'w1', 'APDS');
  assert.equal(c.weapons[0].loaded.ammoType, 'APDS');
  assert.equal(c.weapons[0].loaded.count, 20);
  const regular = c.reserves.find((r) => r.ammoType === 'regular');
  const apds = c.reserves.find((r) => r.ammoType === 'APDS');
  assert.equal(regular.count, 7);  // 7 leftover returned
  assert.equal(apds.count, 10);    // 30 - 20
});

test('switching type creates a return pool when none exists', () => {
  const c = reload(setup([createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'APDS', count: 30 })]), 'w1', 'APDS');
  assert.ok(c.reserves.find((r) => r.ammoType === 'regular' && r.count === 7));
});

test('reload with no matching pool is a no-op', () => {
  const c0 = setup([createReservePool({ ammoCategory: 'ammo_shotgun', ammoType: 'regular', count: 6 })]);
  assert.deepEqual(reload(c0, 'w1', 'regular'), c0);
});

test('addReserve sums counts for an existing (category,type)', () => {
  let c = setup([]);
  c = addReserve(c, createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 10 }));
  c = addReserve(c, createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 5 }));
  assert.equal(c.reserves.length, 1);
  assert.equal(c.reserves[0].count, 15);
});

test('setReserveCount and removeReserve manage pools', () => {
  let c = setup([createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 10 })]);
  c = setReserveCount(c, 'ammo_rifles', 'regular', 3);
  assert.equal(c.reserves[0].count, 3);
  c = removeReserve(c, 'ammo_rifles', 'regular');
  assert.equal(c.reserves.length, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/model-reload.test.js`
Expected: FAIL — `reload` is not exported.

- [ ] **Step 3: Add reserve + reload logic to `js/model.js`** (append)

```js
export function matchingReserves(character, weaponId) {
  const w = character.weapons.find((x) => x.id === weaponId);
  if (!w) return [];
  return character.reserves.filter((r) => r.ammoCategory === w.ammoCategory);
}

function reserveIndex(reserves, ammoCategory, ammoType) {
  return reserves.findIndex((r) => r.ammoCategory === ammoCategory && r.ammoType === ammoType);
}

export function reload(character, weaponId, chosenType) {
  const wIdx = character.weapons.findIndex((x) => x.id === weaponId);
  if (wIdx === -1) return character;
  const weapon = character.weapons[wIdx];
  const reserves = character.reserves.map((r) => ({ ...r }));

  if (reserveIndex(reserves, weapon.ammoCategory, chosenType) === -1) return character;

  let loaded = { ...weapon.loaded };
  if (loaded.count > 0 && loaded.ammoType !== chosenType) {
    const backIdx = reserveIndex(reserves, weapon.ammoCategory, loaded.ammoType);
    if (backIdx === -1) {
      reserves.push({ ammoCategory: weapon.ammoCategory, ammoType: loaded.ammoType, count: loaded.count });
    } else {
      reserves[backIdx] = { ...reserves[backIdx], count: reserves[backIdx].count + loaded.count };
    }
    loaded = { ...loaded, count: 0 };
  }

  const pIdx = reserveIndex(reserves, weapon.ammoCategory, chosenType);
  const need = weapon.magazineCapacity - loaded.count;
  const take = Math.min(need, reserves[pIdx].count);
  reserves[pIdx] = { ...reserves[pIdx], count: reserves[pIdx].count - take };
  loaded = { ammoType: chosenType, count: loaded.count + take };

  const weapons = character.weapons.map((x, i) => (i === wIdx ? { ...x, loaded } : x));
  return { ...character, weapons, reserves };
}

export function addReserve(character, pool) {
  const reserves = character.reserves.map((r) => ({ ...r }));
  const idx = reserveIndex(reserves, pool.ammoCategory, pool.ammoType);
  if (idx === -1) reserves.push({ ...pool });
  else reserves[idx] = { ...reserves[idx], count: reserves[idx].count + pool.count };
  return { ...character, reserves };
}

export function setReserveCount(character, ammoCategory, ammoType, count) {
  const reserves = character.reserves.map((r) =>
    (r.ammoCategory === ammoCategory && r.ammoType === ammoType
      ? { ...r, count: Math.max(0, count) } : r));
  return { ...character, reserves };
}

export function removeReserve(character, ammoCategory, ammoType) {
  return {
    ...character,
    reserves: character.reserves.filter(
      (r) => !(r.ammoCategory === ammoCategory && r.ammoType === ammoType)),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/model-reload.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add js/model.js test/model-reload.test.js
git commit -m "feat: add reserve management and reload algorithm"
```

---

### Task 7: Character collection operations (`model.js` part 4)

**Files:**
- Modify: `js/model.js`
- Create: `test/model-character-ops.test.js`

**Interfaces:**
- Consumes: `createCharacter`, `createWeapon`
- Produces (pure):
  - `addWeapon(character, weapon): Character`
  - `updateWeapon(character, weaponId, changes): Character` — shallow-merges `changes` into the matching weapon.
  - `removeWeapon(character, weaponId): Character`
  - `upsertCharacter(characters, character): Character[]` — replaces the entry with the same `id`, or appends.

- [ ] **Step 1: Write the failing test** — `test/model-character-ops.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter, createWeapon,
  addWeapon, updateWeapon, removeWeapon, upsertCharacter,
} from '../js/model.js';

test('addWeapon / updateWeapon / removeWeapon', () => {
  let c = createCharacter({ name: 'T' });
  const w = createWeapon({ id: 'w1', name: 'Pistol', magazineCapacity: 15 });
  c = addWeapon(c, w);
  assert.equal(c.weapons.length, 1);
  c = updateWeapon(c, 'w1', { magazineCapacity: 18, notes: 'smartlink' });
  assert.equal(c.weapons[0].magazineCapacity, 18);
  assert.equal(c.weapons[0].notes, 'smartlink');
  c = removeWeapon(c, 'w1');
  assert.equal(c.weapons.length, 0);
});

test('upsertCharacter replaces by id or appends', () => {
  const a = createCharacter({ id: 'a', name: 'A' });
  const b = createCharacter({ id: 'b', name: 'B' });
  let list = upsertCharacter([], a);
  list = upsertCharacter(list, b);
  assert.equal(list.length, 2);
  list = upsertCharacter(list, { ...a, name: 'A2' });
  assert.equal(list.length, 2);
  assert.equal(list.find((c) => c.id === 'a').name, 'A2');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/model-character-ops.test.js`
Expected: FAIL — `addWeapon` is not exported.

- [ ] **Step 3: Add character ops to `js/model.js`** (append)

```js
export function addWeapon(character, weapon) {
  return { ...character, weapons: [...character.weapons, { ...weapon }] };
}

export function updateWeapon(character, weaponId, changes) {
  return {
    ...character,
    weapons: character.weapons.map((w) => (w.id === weaponId ? { ...w, ...changes } : w)),
  };
}

export function removeWeapon(character, weaponId) {
  return { ...character, weapons: character.weapons.filter((w) => w.id !== weaponId) };
}

export function upsertCharacter(characters, character) {
  const idx = characters.findIndex((c) => c.id === character.id);
  if (idx === -1) return [...characters, character];
  return characters.map((c, i) => (i === idx ? character : c));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/model-character-ops.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add js/model.js test/model-character-ops.test.js
git commit -m "feat: add character collection operations"
```

---

### Task 8: XML import (`xml-import.js`)

**Files:**
- Create: `js/xml-import.js`
- Create: `test/fixtures/S4T0.xml` (copy of `~/Downloads/S4T0.xml`)
- Create: `test/fixtures/all-ammo.xml` (copy of `~/Downloads/Unnamed chummer.xml`)
- Create: `test/xml-import.test.js`

**Interfaces:**
- Consumes: `createCharacter`, `createWeapon`, `createReservePool` from `model.js`; `getWeaponDef` from `weapons-db.js`; `prettifyRef` from `util.js`
- Produces:
  - `parseSr6CharDoc(doc, db=WEAPONS_DB-backed getWeaponDef): Character` — pure; takes a DOM `Document`.
  - `importFromXmlString(xmlString): Character` — browser-only wrapper using `new DOMParser()`.

Behaviour (per spec):
- Firearms = items with `type="WEAPON_FIREARMS"` **or** `slot="VEHICLE_WEAPON"`, deduped by `uniqueid`.
- `mount`: `WEAPON_FIREARMS` → `"carried"`; vehicle weapons → the top-level container's `customName` (fallback `prettifyRef(ref)`), resolved by following `embedin`, hopping through `generatedUUIDs` (`token|uuid`) when an `embedin` target isn't itself an `<item>`.
- Each firearm's def comes from `getWeaponDef(ref)`; magazine starts full; `loaded.ammoType` is the first reserve type matching the weapon's category, else `"regular"`.
- Reserves = items with `type="AMMUNITION"`: `ammoCategory=ref`, `ammoType=choice||"regular"`, `count=parseInt(count)`.

- [ ] **Step 1: Copy the fixtures**

Run:
```bash
mkdir -p test/fixtures
cp ~/Downloads/S4T0.xml test/fixtures/S4T0.xml
cp "$HOME/Downloads/Unnamed chummer.xml" test/fixtures/all-ammo.xml
```
Expected: both files exist under `test/fixtures/`.

- [ ] **Step 2: Write the failing test** — `test/xml-import.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { parseSr6CharDoc } from '../js/xml-import.js';

const here = dirname(fileURLToPath(import.meta.url));
function load(name) {
  const xml = readFileSync(join(here, 'fixtures', name), 'utf8');
  return new DOMParser().parseFromString(xml, 'text/xml');
}

test('S4T0: character identity', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  assert.equal(c.name, 'S4T0');
  assert.equal(c.realName, 'Kenji "Ken" Sato');
});

test('S4T0: five deduped firearms with correct mounts', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  assert.equal(c.weapons.length, 5);
  const carried = c.weapons.filter((w) => w.mount === 'carried');
  assert.equal(carried.length, 2);
  const names = c.weapons.map((w) => w.name).sort();
  assert.deepEqual(names, ['Ares Predator VI', 'FN HAR', 'FN HAR', 'FN HAR', 'Remington Roomsweeper'].sort());
  const lynx = c.weapons.filter((w) => w.mount === 'R.E.X. (Steel Lync Combat Drone)');
  assert.equal(lynx.length, 2); // remington + one fn_har turret
  const gremlin = c.weapons.filter((w) => w.mount === 'Gremlin (MCT-Nissan Roto-Drohne)');
  assert.equal(gremlin.length, 1);
});

test('S4T0: weapon defs and full magazines applied', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  const har = c.weapons.find((w) => w.ref === 'fn_har');
  assert.equal(har.ammoCategory, 'ammo_rifles');
  assert.equal(har.magazineCapacity, 20);
  assert.equal(har.loaded.count, 20);
  assert.equal(har.loaded.ammoType, 'regular'); // matches ammo_rifles/regular reserve
  const ares = c.weapons.find((w) => w.ref === 'ares_predator_vi');
  assert.equal(ares.ammoCategory, 'ammo_heavy_smg');
});

test('S4T0: three reserve pools', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  assert.equal(c.reserves.length, 3);
  const rifle = c.reserves.find((r) => r.ammoCategory === 'ammo_rifles');
  assert.deepEqual(rifle, { ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 29 });
  const shot = c.reserves.find((r) => r.ammoCategory === 'ammo_shotgun');
  assert.deepEqual(shot, { ammoCategory: 'ammo_shotgun', ammoType: 'explosive', count: 6 });
});

test('all-ammo: every category imported; missing choice -> regular', () => {
  const c = parseSr6CharDoc(load('all-ammo.xml'));
  assert.equal(c.reserves.length, 11);
  const cats = c.reserves.map((r) => r.ammoCategory).sort();
  assert.ok(cats.includes('ammo_arrow'));
  const arrow = c.reserves.find((r) => r.ammoCategory === 'ammo_arrow');
  assert.equal(arrow.ammoType, 'regular'); // arrow item had no choice attribute
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/xml-import.test.js`
Expected: FAIL — cannot find module `../js/xml-import.js`.

- [ ] **Step 4: Implement `js/xml-import.js`**

```js
import { createCharacter, createWeapon, createReservePool } from './model.js';
import { getWeaponDef } from './weapons-db.js';
import { prettifyRef } from './util.js';

const MAX_MOUNT_DEPTH = 20;

function firstText(doc, tag) {
  const el = doc.getElementsByTagName(tag)[0];
  return el && el.textContent ? el.textContent.trim() : '';
}

function attr(el, name) {
  return el.getAttribute ? el.getAttribute(name) : null;
}

function directChildren(el, tag) {
  return Array.from(el.childNodes || []).filter((n) => n.nodeName === tag);
}

// Build: id -> item element; and generated-uuid -> owning item id.
function indexItems(items) {
  const byId = new Map();
  const generatedToOwner = new Map();
  for (const it of items) {
    const id = attr(it, 'uniqueid');
    if (id) byId.set(id, it);
    for (const gen of directChildren(it, 'generatedUUIDs')) {
      for (const uuid of Array.from(gen.getElementsByTagName('uuid'))) {
        const token = (uuid.textContent || '').trim();
        const gid = token.includes('|') ? token.split('|')[1] : token;
        if (gid && id) generatedToOwner.set(gid, id);
      }
    }
  }
  return { byId, generatedToOwner };
}

function resolveMount(item, idx) {
  if (attr(item, 'type') === 'WEAPON_FIREARMS') return 'carried';
  let cur = attr(item, 'embedin');
  const visited = new Set();
  for (let depth = 0; cur && depth < MAX_MOUNT_DEPTH; depth += 1) {
    if (visited.has(cur)) break;
    visited.add(cur);
    let owner = idx.byId.get(cur);
    if (!owner) {
      const viaGen = idx.generatedToOwner.get(cur);
      if (viaGen) { cur = viaGen; continue; }
      break;
    }
    const parentEmbed = attr(owner, 'embedin');
    if (!parentEmbed) {
      return attr(owner, 'customName') || prettifyRef(attr(owner, 'ref'));
    }
    cur = parentEmbed;
  }
  return 'Vehicle';
}

function parseReserves(items) {
  return items
    .filter((it) => attr(it, 'type') === 'AMMUNITION')
    .map((it) => createReservePool({
      ammoCategory: attr(it, 'ref'),
      ammoType: attr(it, 'choice') || 'regular',
      count: parseInt(attr(it, 'count') || '0', 10),
    }));
}

function defaultAmmoType(reserves, ammoCategory) {
  const m = reserves.find((r) => r.ammoCategory === ammoCategory);
  return m ? m.ammoType : 'regular';
}

export function parseSr6CharDoc(doc) {
  const items = Array.from(doc.getElementsByTagName('item'));
  const idx = indexItems(items);

  const reserves = parseReserves(items);

  const firearmItems = items.filter(
    (it) => attr(it, 'type') === 'WEAPON_FIREARMS' || attr(it, 'slot') === 'VEHICLE_WEAPON');
  const deduped = new Map();
  for (const it of firearmItems) {
    const id = attr(it, 'uniqueid');
    if (!deduped.has(id)) deduped.set(id, it);
  }

  const weapons = Array.from(deduped.values()).map((it, i) => {
    const ref = attr(it, 'ref');
    const def = getWeaponDef(ref);
    return createWeapon({
      name: def.name,
      ref,
      mount: resolveMount(it, i),
      magazineCapacity: def.magazineCapacity,
      ammoCategory: def.ammoCategory,
      firingModes: def.firingModes,
      loaded: { ammoType: defaultAmmoType(reserves, def.ammoCategory), count: def.magazineCapacity },
      notes: '',
    });
  });

  return createCharacter({
    name: firstText(doc, 'name'),
    realName: firstText(doc, 'realname'),
    weapons,
    reserves,
  });
}

export function importFromXmlString(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  return parseSr6CharDoc(doc);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test test/xml-import.test.js`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: all tests across all files PASS.

- [ ] **Step 7: Commit**

```bash
git add js/xml-import.js test/xml-import.test.js test/fixtures/
git commit -m "feat: import sr6char XML into a character"
```

---

### Task 9: Persistence and backup (`store.js`)

**Files:**
- Create: `js/store.js`
- Create: `test/store.test.js`

**Interfaces:**
- Consumes: `upsertCharacter` from `model.js`
- Produces:
  - `STORAGE_KEY = 'sr6-ammo-tracker'`
  - `emptyState(): State` → `{ version: 1, characters: [], activeId: null }`
  - `serialize(state): string`
  - `deserialize(text): State` — tolerant: returns `emptyState()` on any parse/shape error.
  - `mergeState(state, incomingState): State` — upsert incoming characters by id into `state`.
  - `loadState(): State` / `saveState(state): void` — `localStorage` wrappers (thin; not unit-tested in Node).

- [ ] **Step 1: Write the failing test** — `test/store.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, serialize, deserialize, mergeState } from '../js/store.js';

test('serialize/deserialize round-trips state', () => {
  const s = { version: 1, characters: [{ id: 'a', name: 'A', realName: '', weapons: [], reserves: [] }], activeId: 'a' };
  assert.deepEqual(deserialize(serialize(s)), s);
});

test('deserialize is tolerant of garbage', () => {
  assert.deepEqual(deserialize('not json'), emptyState());
  assert.deepEqual(deserialize('{"version":1}'), emptyState());
  assert.deepEqual(deserialize(null), emptyState());
});

test('mergeState upserts incoming characters by id', () => {
  const base = { version: 1, characters: [{ id: 'a', name: 'A', realName: '', weapons: [], reserves: [] }], activeId: 'a' };
  const incoming = { version: 1, characters: [
    { id: 'a', name: 'A-updated', realName: '', weapons: [], reserves: [] },
    { id: 'b', name: 'B', realName: '', weapons: [], reserves: [] },
  ], activeId: null };
  const merged = mergeState(base, incoming);
  assert.equal(merged.characters.length, 2);
  assert.equal(merged.characters.find((c) => c.id === 'a').name, 'A-updated');
  assert.equal(merged.activeId, 'a'); // existing activeId preserved
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/store.test.js`
Expected: FAIL — cannot find module `../js/store.js`.

- [ ] **Step 3: Implement `js/store.js`**

```js
import { upsertCharacter } from './model.js';

export const STORAGE_KEY = 'sr6-ammo-tracker';

export function emptyState() {
  return { version: 1, characters: [], activeId: null };
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(text) {
  if (!text) return emptyState();
  try {
    const obj = JSON.parse(text);
    if (!obj || !Array.isArray(obj.characters)) return emptyState();
    return {
      version: 1,
      characters: obj.characters,
      activeId: obj.activeId ?? null,
    };
  } catch {
    return emptyState();
  }
}

export function mergeState(state, incoming) {
  let characters = state.characters;
  for (const c of incoming.characters) characters = upsertCharacter(characters, c);
  return { ...state, characters };
}

export function loadState() {
  return deserialize(localStorage.getItem(STORAGE_KEY));
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, serialize(state));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/store.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add js/store.js test/store.test.js
git commit -m "feat: add localStorage persistence and JSON backup merge"
```

---

### Task 10: App shell — HTML, CSS, bootstrap

**Files:**
- Create: `index.html`
- Create: `css/styles.css`
- Create: `js/app.js`
- Create: `js/ui/dom.js`

**Interfaces:**
- Produces: `js/ui/dom.js` exports `el(tag, attrs, children): HTMLElement` and `clear(node): void`. `js/app.js` exports nothing; it owns `let state`, `render()`, and `mutate(fn)`.

Verification is manual (browser) — no Node test for DOM rendering.

- [ ] **Step 1: Create `js/ui/dom.js`**

```js
// Tiny DOM helper. attrs: { class, onclick, value, ... }. children: string | Node | array.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'value') node.value = v;
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
```

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0b0e14" />
  <link rel="manifest" href="manifest.webmanifest" />
  <link rel="stylesheet" href="css/styles.css" />
  <title>SR6 Ammo Tracker</title>
</head>
<body>
  <header id="app-header"></header>
  <main id="app-root"></main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `css/styles.css`**

```css
:root {
  --bg: #0b0e14; --panel: #151a23; --panel-2: #1d2430; --text: #e6e9ef;
  --muted: #8b95a7; --accent: #f0b429; --danger: #e5484d; --ok: #46a758;
  --radius: 12px;
}
* { box-sizing: border-box; }
body {
  margin: 0; font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg); color: var(--text);
  padding-bottom: env(safe-area-inset-bottom);
}
#app-header {
  position: sticky; top: 0; z-index: 5; background: var(--panel);
  padding: 12px 16px calc(12px); display: flex; gap: 8px; align-items: center;
  border-bottom: 1px solid #000;
}
#app-header h1 { font-size: 18px; margin: 0; flex: 1; }
#app-root { padding: 16px; max-width: 720px; margin: 0 auto; display: grid; gap: 16px; }
button {
  font: inherit; color: var(--text); background: var(--panel-2);
  border: 1px solid #2b3444; border-radius: var(--radius); padding: 10px 14px;
  min-height: 44px; cursor: pointer;
}
button:active { transform: translateY(1px); }
button.accent { background: var(--accent); color: #1a1300; border-color: var(--accent); font-weight: 600; }
button.danger { color: var(--danger); }
button.icon { min-width: 44px; padding: 10px; }
input, select {
  font: inherit; color: var(--text); background: var(--panel-2);
  border: 1px solid #2b3444; border-radius: 8px; padding: 10px; min-height: 44px; width: 100%;
}
.card { background: var(--panel); border: 1px solid #232c3a; border-radius: var(--radius); padding: 16px; display: grid; gap: 12px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.spread { justify-content: space-between; }
.muted { color: var(--muted); font-size: 13px; }
.badge { font-size: 12px; background: var(--panel-2); border: 1px solid #2b3444; border-radius: 999px; padding: 2px 10px; color: var(--muted); }
.count { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
.count .cap { color: var(--muted); font-size: 18px; font-weight: 400; }
.modes { display: flex; gap: 8px; flex-wrap: wrap; }
.list { display: grid; gap: 10px; }
.empty { text-align: center; color: var(--muted); padding: 32px 0; }
h2 { font-size: 16px; margin: 0; }
.section-title { display: flex; justify-content: space-between; align-items: center; }
```

- [ ] **Step 4: Create `js/app.js`** (bootstrap + render skeleton; views wired in later tasks)

```js
import { loadState, saveState } from './store.js';
import { el, clear } from './ui/dom.js';

let state = loadState();

export function getState() { return state; }

// Apply a pure update, persist, re-render.
export function mutate(fn) {
  state = fn(state);
  saveState(state);
  render();
}

function render() {
  const header = document.getElementById('app-header');
  const root = document.getElementById('app-root');
  clear(header);
  clear(root);
  header.append(el('h1', {}, 'SR6 Ammo Tracker'));
  root.append(el('p', { class: 'muted' }, 'Loading…')); // replaced in Task 11/12
}

render();
```

- [ ] **Step 5: Manual verification**

Run: `python3 -m http.server 8000`
Open http://localhost:8000 on desktop (and your phone via your machine's LAN IP).
Expected: dark page, sticky header reading "SR6 Ammo Tracker", body text "Loading…". No console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html css/styles.css js/app.js js/ui/dom.js
git commit -m "feat: add app shell, styles, and render bootstrap"
```

---

### Task 11: Character picker view

**Files:**
- Create: `js/ui/character-picker.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `getState`, `mutate` from `app.js`; `el` from `ui/dom.js`; `createCharacter`, `upsertCharacter` from `model.js`
- Produces: `renderPicker(container, { onOpen }): void` — renders the list of characters with select/add/rename/delete. `onOpen(characterId)` is called to switch to the sheet view.

- [ ] **Step 1: Implement `js/ui/character-picker.js`**

```js
import { el } from './dom.js';
import { getState, mutate } from '../app.js';
import { createCharacter, upsertCharacter } from '../model.js';

export function renderPicker(container, { onOpen }) {
  const { characters } = getState();

  const addBtn = el('button', {
    class: 'accent',
    onclick: () => {
      const name = prompt('Character name?');
      if (!name) return;
      const c = createCharacter({ name });
      mutate((s) => ({ ...s, characters: upsertCharacter(s.characters, c), activeId: c.id }));
      onOpen(c.id);
    },
  }, '+ New character');

  container.append(el('div', { class: 'section-title' }, [el('h2', {}, 'Characters'), addBtn]));

  if (characters.length === 0) {
    container.append(el('div', { class: 'empty' }, 'No characters yet. Add one or import from XML below.'));
  }

  const list = el('div', { class: 'list' });
  for (const c of characters) {
    const open = el('button', { onclick: () => onOpen(c.id) },
      `${c.name}${c.realName ? ` — ${c.realName}` : ''}`);
    open.style.flex = '1';
    open.style.textAlign = 'left';

    const rename = el('button', {
      class: 'icon', title: 'Rename',
      onclick: () => {
        const name = prompt('New name?', c.name);
        if (!name) return;
        mutate((s) => ({ ...s, characters: upsertCharacter(s.characters, { ...c, name }) }));
      },
    }, '✎');

    const del = el('button', {
      class: 'icon danger', title: 'Delete',
      onclick: () => {
        if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
        mutate((s) => ({
          ...s,
          characters: s.characters.filter((x) => x.id !== c.id),
          activeId: s.activeId === c.id ? null : s.activeId,
        }));
      },
    }, '🗑');

    list.append(el('div', { class: 'card row' }, [open, rename, del]));
  }
  container.append(list);
}
```

- [ ] **Step 2: Wire it into `js/app.js`**

Replace the `render()` body so it routes between picker and sheet (sheet added in Task 12). Update `js/app.js`:

```js
import { loadState, saveState } from './store.js';
import { el, clear } from './ui/dom.js';
import { renderPicker } from './ui/character-picker.js';

let state = loadState();
let view = { name: 'picker', characterId: null };

export function getState() { return state; }
export function mutate(fn) { state = fn(state); saveState(state); render(); }
export function goPicker() { view = { name: 'picker', characterId: null }; render(); }
export function goSheet(characterId) { view = { name: 'sheet', characterId }; render(); }

function render() {
  const header = document.getElementById('app-header');
  const root = document.getElementById('app-root');
  clear(header);
  clear(root);

  if (view.name === 'sheet') {
    header.append(el('button', { class: 'icon', onclick: goPicker, title: 'Back' }, '‹'));
    header.append(el('h1', {}, 'Character'));
    root.append(el('p', { class: 'muted' }, 'Sheet view — added in Task 12.'));
    return;
  }

  header.append(el('h1', {}, 'SR6 Ammo Tracker'));
  renderPicker(root, { onOpen: goSheet });
}

render();
```

- [ ] **Step 3: Manual verification**

Reload http://localhost:8000.
- Click "+ New character", enter a name → it appears, and the app navigates to the (placeholder) sheet; click "‹" to go back.
- Rename (✎) and Delete (🗑, with confirm) work.
- Reload the page → characters persist (localStorage).
Expected: all behaviors as described, no console errors.

- [ ] **Step 4: Commit**

```bash
git add js/ui/character-picker.js js/app.js
git commit -m "feat: add character picker view with add/rename/delete"
```

---

### Task 12: Character sheet — weapon cards and reserves

**Files:**
- Create: `js/ui/character-sheet.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `getState`, `mutate` from `app.js`; `el` from `ui/dom.js`; from `model.js`: `fire, spend, addRounds, setLoaded, reload, matchingReserves, updateWeapon, removeWeapon, addReserve, setReserveCount, removeReserve, createWeapon, createReservePool, upsertCharacter`; from `ammo-db.js`: `AMMO_CATEGORIES, AMMO_TYPES, categoryName`
- Produces: `renderSheet(container, characterId): void`

Helper to update one character inside state:

- [ ] **Step 1: Implement `js/ui/character-sheet.js`**

```js
import { el } from './dom.js';
import { getState, mutate } from '../app.js';
import {
  fire, spend, addRounds, setLoaded, reload, matchingReserves,
  updateWeapon, removeWeapon, addReserve, setReserveCount, removeReserve,
  createWeapon, createReservePool, upsertCharacter,
} from '../model.js';
import { AMMO_CATEGORIES, AMMO_TYPES, categoryName } from '../ammo-db.js';

// Apply a Character->Character transform to the active character.
function updateCharacter(characterId, fn) {
  mutate((s) => {
    const c = s.characters.find((x) => x.id === characterId);
    if (!c) return s;
    return { ...s, characters: upsertCharacter(s.characters, fn(c)) };
  });
}

function weaponCard(c, w) {
  const card = el('div', { class: 'card' });

  // Header: name + mount badge + edit/delete
  card.append(el('div', { class: 'row spread' }, [
    el('div', { class: 'row' }, [
      el('h2', {}, w.name),
      el('span', { class: 'badge' }, w.mount === 'carried' ? 'Carried' : w.mount),
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'icon', title: 'Edit', onclick: () => editWeapon(c, w) }, '✎'),
      el('button', {
        class: 'icon danger', title: 'Remove',
        onclick: () => { if (confirm(`Remove ${w.name}?`)) updateCharacter(c.id, (ch) => removeWeapon(ch, w.id)); },
      }, '🗑'),
    ]),
  ]));

  // Count + loaded ammo type
  card.append(el('div', { class: 'row spread' }, [
    el('div', { class: 'count' }, [String(w.loaded.count), el('span', { class: 'cap' }, ` / ${w.magazineCapacity}`)]),
    el('span', { class: 'badge' }, w.loaded.ammoType),
  ]));

  // Firing-mode buttons
  if (w.firingModes.length) {
    card.append(el('div', { class: 'modes' }, w.firingModes.map((m) =>
      el('button', { onclick: () => updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, fire(findW(ch, w.id), m.mode))) },
        `${m.mode} (-${m.rounds})`))));
  }

  // Manual controls
  card.append(el('div', { class: 'row' }, [
    el('button', { class: 'icon', onclick: () => updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, spend(findW(ch, w.id), 1))) }, '−'),
    el('button', { class: 'icon', onclick: () => updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, addRounds(findW(ch, w.id), 1))) }, '+'),
    el('button', {
      onclick: () => {
        const n = parseInt(prompt('Set loaded rounds:', String(w.loaded.count)) ?? '', 10);
        if (Number.isInteger(n)) updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, setLoaded(findW(ch, w.id), n)));
      },
    }, 'Set'),
    el('button', { class: 'accent', onclick: () => doReload(c, w) }, 'Reload'),
  ]));

  if (w.notes) card.append(el('div', { class: 'muted' }, w.notes));
  return card;
}

function findW(character, weaponId) {
  return character.weapons.find((x) => x.id === weaponId);
}

// updateWeapon expects a `changes` object; we pass a whole new weapon (a superset merge).
// fire/spend/etc return a full weapon, so updateWeapon(ch, id, fullWeapon) shallow-merges all fields — correct.

function doReload(c, w) {
  const pools = matchingReserves(c, w.id);
  if (pools.length === 0) {
    alert(`No reserve ammo for ${categoryName(w.ammoCategory)}. Add a pool in the Reserve section or use Set.`);
    return;
  }
  let type = pools[0].ammoType;
  if (pools.length > 1) {
    const choice = prompt(`Reload which type? ${pools.map((p) => `${p.ammoType} (${p.count})`).join(', ')}`, w.loaded.ammoType);
    if (!choice) return;
    type = choice.trim();
  }
  updateCharacter(c.id, (ch) => reload(ch, w.id, type));
}

function editWeapon(c, w) {
  const name = prompt('Weapon name:', w.name);
  if (name == null) return;
  const cap = parseInt(prompt('Magazine capacity:', String(w.magazineCapacity)) ?? '', 10);
  const cat = prompt(`Ammo category ref (e.g. ${Object.keys(AMMO_CATEGORIES).join(', ')}):`, w.ammoCategory || '');
  const mount = prompt('Mount (carried or a vehicle name):', w.mount);
  const notes = prompt('Notes:', w.notes);
  updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, {
    name,
    magazineCapacity: Number.isInteger(cap) ? cap : w.magazineCapacity,
    ammoCategory: cat || null,
    mount: mount || 'carried',
    notes: notes ?? '',
  }));
}

function reserveSection(c) {
  const wrap = el('div', { class: 'card' });
  wrap.append(el('div', { class: 'section-title' }, [
    el('h2', {}, 'Reserve ammo'),
    el('button', { onclick: () => addReservePrompt(c) }, '+ Pool'),
  ]));

  if (c.reserves.length === 0) {
    wrap.append(el('div', { class: 'muted' }, 'No spare ammo tracked.'));
    return wrap;
  }

  // Group by category.
  const byCat = {};
  for (const r of c.reserves) (byCat[r.ammoCategory] ||= []).push(r);
  for (const [cat, pools] of Object.entries(byCat)) {
    wrap.append(el('div', { class: 'muted' }, categoryName(cat)));
    for (const r of pools) {
      wrap.append(el('div', { class: 'row spread' }, [
        el('span', { class: 'badge' }, r.ammoType),
        el('div', { class: 'row' }, [
          el('button', { class: 'icon', onclick: () => updateCharacter(c.id, (ch) => setReserveCount(ch, cat, r.ammoType, r.count - 1)) }, '−'),
          el('span', { class: 'count' }, String(r.count)),
          el('button', { class: 'icon', onclick: () => updateCharacter(c.id, (ch) => setReserveCount(ch, cat, r.ammoType, r.count + 1)) }, '+'),
          el('button', { class: 'icon danger', onclick: () => updateCharacter(c.id, (ch) => removeReserve(ch, cat, r.ammoType)) }, '🗑'),
        ]),
      ]));
    }
  }
  return wrap;
}

function addReservePrompt(c) {
  const cat = prompt(`Category ref (${Object.keys(AMMO_CATEGORIES).join(', ')}):`, 'ammo_rifles');
  if (!cat) return;
  const type = prompt(`Ammo type (${AMMO_TYPES.join(', ')}):`, 'regular');
  if (!type) return;
  const count = parseInt(prompt('Count:', '0') ?? '', 10);
  updateCharacter(c.id, (ch) => addReserve(ch, createReservePool({ ammoCategory: cat, ammoType: type, count: Number.isInteger(count) ? count : 0 })));
}

export function renderSheet(container, characterId) {
  const c = getState().characters.find((x) => x.id === characterId);
  if (!c) { container.append(el('div', { class: 'empty' }, 'Character not found.')); return; }

  container.append(el('div', { class: 'section-title' }, [
    el('h2', {}, 'Weapons'),
    el('button', {
      onclick: () => updateCharacter(c.id, (ch) => ({ ...ch, weapons: [...ch.weapons, createWeapon({ name: 'New Weapon', magazineCapacity: 10 })] })),
    }, '+ Weapon'),
  ]));

  if (c.weapons.length === 0) container.append(el('div', { class: 'empty' }, 'No weapons. Add one or import from XML.'));
  const list = el('div', { class: 'list' });
  for (const w of c.weapons) list.append(weaponCard(c, w));
  container.append(list);

  container.append(reserveSection(c));
}
```

Note on `updateWeapon(ch, id, fire(...))`: `fire/spend/addRounds/setLoaded` return a complete weapon object; passing it as `changes` shallow-merges every field back over the same weapon, which is the intended replacement.

- [ ] **Step 2: Wire the sheet into `js/app.js`** — replace the sheet branch in `render()`:

```js
import { renderSheet } from './ui/character-sheet.js';
```
and replace the placeholder lines:
```js
  if (view.name === 'sheet') {
    const c = state.characters.find((x) => x.id === view.characterId);
    header.append(el('button', { class: 'icon', onclick: goPicker, title: 'Back' }, '‹'));
    header.append(el('h1', {}, c ? c.name : 'Character'));
    renderSheet(root, view.characterId);
    return;
  }
```

- [ ] **Step 3: Manual verification**

Reload http://localhost:8000, open a character.
- Add a weapon; it shows `0 / 10`. Use Edit (✎) to set name, capacity, ammo category `ammo_rifles`.
- Add a reserve pool `ammo_rifles` / `regular` / 30.
- Tap `+` to load rounds, `−` to spend, `Set` to set a value; firing-mode buttons appear only if the weapon has modes (a fresh weapon has none until edited — acceptable for v1; imported weapons have modes).
- Tap **Reload** → magazine tops to capacity, reserve drops. With a second type pool, it prompts for the type; switching returns leftovers.
- Reload the page → all values persist.
Expected: behaviors match; no console errors.

- [ ] **Step 4: Commit**

```bash
git add js/ui/character-sheet.js js/app.js
git commit -m "feat: add character sheet with weapon cards and reserves"
```

---

### Task 13: XML import + JSON backup wiring

**Files:**
- Create: `js/ui/io.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `getState`, `mutate`, `goSheet` from `app.js`; `el` from `ui/dom.js`; `importFromXmlString` from `xml-import.js`; `serialize, mergeState, deserialize` from `store.js`; `upsertCharacter` from `model.js`
- Produces: `renderIoBar(container, { onImported }): void` — the picker's Import-XML / Export-JSON / Import-JSON controls.

- [ ] **Step 1: Implement `js/ui/io.js`**

```js
import { el } from './dom.js';
import { getState, mutate } from '../app.js';
import { importFromXmlString } from '../xml-import.js';
import { serialize, deserialize, mergeState } from '../store.js';
import { upsertCharacter } from '../model.js';

function readFile(accept, cb) {
  const input = el('input', { type: 'file', accept });
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result));
    reader.readAsText(file);
  });
  document.body.append(input);
  input.click();
  input.remove();
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function renderIoBar(container, { onImported }) {
  const importXml = el('button', {
    onclick: () => readFile('.xml,text/xml', (text) => {
      try {
        const character = importFromXmlString(text);
        mutate((s) => ({ ...s, characters: upsertCharacter(s.characters, character), activeId: character.id }));
        onImported(character.id);
      } catch (e) {
        alert(`Import failed: ${e.message}`);
      }
    }),
  }, 'Import XML');

  const exportJson = el('button', {
    onclick: () => download('sr6-ammo-backup.json', serialize(getState())),
  }, 'Export JSON');

  const importJson = el('button', {
    onclick: () => readFile('.json,application/json', (text) => {
      const incoming = deserialize(text);
      mutate((s) => mergeState(s, incoming));
      alert('Backup imported.');
    }),
  }, 'Import JSON');

  container.append(el('div', { class: 'card row' }, [importXml, exportJson, importJson]));
}
```

- [ ] **Step 2: Wire `renderIoBar` into the picker branch of `js/app.js`** — in `render()`, after `renderPicker(...)`:

```js
import { renderIoBar } from './ui/io.js';
```
```js
  renderPicker(root, { onOpen: goSheet });
  renderIoBar(root, { onImported: goSheet });
```

- [ ] **Step 3: Manual verification**

Reload http://localhost:8000 (picker view).
- Click **Import XML**, choose `~/Downloads/S4T0.xml` → a character "S4T0" is created and the sheet opens showing 5 weapons (2 Carried, others with drone-name badges) and 3 reserve pools.
- Click **Export JSON** → a `sr6-ammo-backup.json` downloads.
- Delete the character, then **Import JSON** that file → the character returns.
Expected: behaviors match; no console errors.

- [ ] **Step 4: Commit**

```bash
git add js/ui/io.js js/app.js
git commit -m "feat: wire XML import and JSON backup export/import"
```

---

### Task 14: PWA — manifest, service worker, install

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Modify: `js/app.js` (register the service worker)

**Interfaces:**
- Produces: a cached app shell so the app loads offline and is installable.

- [ ] **Step 1: Create `manifest.webmanifest`**

```json
{
  "name": "SR6 Ammo Tracker",
  "short_name": "SR6 Ammo",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#0b0e14",
  "theme_color": "#0b0e14",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Generate placeholder icons**

Run (requires ImageMagick; if unavailable, create any 192px and 512px PNG named as below):
```bash
mkdir -p icons
magick -size 192x192 xc:'#0b0e14' -fill '#f0b429' -gravity center -pointsize 80 -annotate 0 'SR6' icons/icon-192.png
magick -size 512x512 xc:'#0b0e14' -fill '#f0b429' -gravity center -pointsize 220 -annotate 0 'SR6' icons/icon-512.png
```
Expected: two PNGs exist in `icons/`.

- [ ] **Step 3: Create `sw.js`** (cache-first app shell, bump `CACHE` on releases)

```js
const CACHE = 'sr6-ammo-v1';
const ASSETS = [
  '.', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/app.js', 'js/store.js', 'js/model.js', 'js/util.js',
  'js/ammo-db.js', 'js/weapons-db.js', 'js/xml-import.js',
  'js/ui/dom.js', 'js/ui/character-picker.js', 'js/ui/character-sheet.js', 'js/ui/io.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('index.html'))));
});
```

- [ ] **Step 4: Register the service worker in `js/app.js`** (append at end of file)

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
```

- [ ] **Step 5: Manual verification**

Serve over `http://localhost:8000` (service workers allow `localhost`).
- DevTools → Application → Service Workers shows `sw.js` activated; Manifest shows name + icons with no errors.
- Load once, then go offline (DevTools → Network → Offline) and reload → app still loads and works.
Expected: offline load works; installable (Chrome shows install prompt / iOS Safari "Add to Home Screen").

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest sw.js icons/ js/app.js
git commit -m "feat: add PWA manifest, service worker, and icons"
```

---

### Task 15: Deploy to GitHub Pages + final checklist

**Files:**
- Modify: `README.md`

**Interfaces:** none (operational).

- [ ] **Step 1: Run the whole test suite once more**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Push to GitHub**

```bash
git push -u origin main
```

- [ ] **Step 3: Enable Pages**

In the GitHub repo: Settings → Pages → Source = "Deploy from a branch", Branch = `main`, folder = `/ (root)`, Save.
Expected: after ~1 min, the app is live at `https://sasnaw.github.io/SR6-chummer-sheet/`.

- [ ] **Step 4: Verify on your phone**

Open the Pages URL on your phone over HTTPS.
- Import `S4T0.xml` (transfer it to the phone or use a blank character), adjust counts, reload, fire modes.
- Add to Home Screen; open from the icon; turn on airplane mode → app still works and data persists.
Expected: full loop works on-device, offline.

- [ ] **Step 5: Finalize `README.md`** — append a "Live app" line with the Pages URL and a one-paragraph usage summary (characters, weapon cards, firing modes, reserves, XML import, JSON backup).

- [ ] **Step 6: Commit and push**

```bash
git add README.md
git commit -m "docs: add live URL and usage to README"
git push
```

---

## Self-Review

**Spec coverage:**
- Multiple characters → Tasks 7, 11. ✓
- Magazine + reload → Tasks 5, 6, 12. ✓
- Reserve pool, multiple ammo types → Tasks 2, 6, 12. ✓
- Firing-mode buttons + manual +/- + set-value → Tasks 5, 12. ✓
- Notes field → Tasks 4, 12 (edit). ✓
- Ammo categories (11) + extensible types → Task 2; used in 8, 12. ✓
- XML import (carried + vehicle, dedupe, mount resolution, lookup, reserves) → Task 8. ✓
- JSON export/import (merge by id) → Tasks 9, 13. ✓
- localStorage persistence on every mutation → Tasks 9, 10 (`mutate`). ✓
- PWA / offline / GitHub Pages → Tasks 14, 15. ✓
- Pure modules tested with `node --test`; `S4T0.xml` fixture → Tasks 1–9. ✓

**Placeholder scan:** No "TBD"/"implement later". UI tasks carry full code; their verification is explicitly manual because the chosen stack has no DOM test tooling — that is a deliberate, stated decision, not a gap.

**Type consistency:** `loaded` is always `{ ammoType, count }`; reserves always `{ ammoCategory, ammoType, count }`; `reload(character, weaponId, chosenType)`, `setReserveCount(character, ammoCategory, ammoType, count)`, `updateWeapon(character, weaponId, changes)`, `upsertCharacter(characters, character)` signatures are consistent across model, UI, and tests. `getWeaponDef` returns `{ name, magazineCapacity, ammoCategory, firingModes }` everywhere it's consumed.
