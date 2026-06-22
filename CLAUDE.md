# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mobile-first PWA for tracking Shadowrun 6 weapon ammunition across multiple
characters. **Vanilla HTML/CSS/JS with no build step** — the shipped app loads
static files directly and has zero runtime dependencies. Node and the single
devDependency (`@xmldom/xmldom`) exist only for tests.

## Commands

```bash
npm install                              # install @xmldom/xmldom (tests only)
npm test                                 # run the whole suite (node --test, all test/*.test.js)
node --test test/model-reload.test.js    # run one test file
node --test --test-name-pattern="reload tops off"   # run tests matching a name
node --check js/ui/character-sheet.js    # syntax-check a UI file (see "Testing" for why)

python3 -m http.server 8000              # dev server; open http://localhost:8000
```

ES modules require HTTP — opening `index.html` via `file://` will not work. Use the
dev server locally; production is served over HTTPS by GitHub Pages.

**Deploy:** GitHub Pages serves the repo root of `main`. Pushing to `main` publishes
(`https://sasnaw.github.io/SR6-chummer-sheet/`). There is no CI/build.

## Architecture

The codebase is split into a **pure logic core** and a **browser-only shell**. This
split is the most important thing to understand and to preserve.

### Pure core (unit-tested with `node --test`)
- `js/model.js` — all character/weapon/reserve operations as **pure functions**
  (state in → new state out, never mutates inputs, never touches `localStorage`/DOM).
  Entity factories (`createCharacter/createWeapon/createReservePool`), round ops
  (`fire/spend/addRounds/setLoaded`), the reload algorithm, reserve and character
  collection ops.
- `js/store.js` — serialize/deserialize and `mergeState` (merge-by-id backup).
  `deserialize` is deliberately tolerant: it never throws, returning `emptyState()`
  on any bad input. `loadState`/`saveState` are the only `localStorage` touchpoints.
- `js/xml-import.js` — `parseSr6CharDoc(doc)` is pure (takes a DOM `Document`);
  `importFromXmlString(str)` is the browser wrapper that builds the doc via global
  `DOMParser`. Tests exercise `parseSr6CharDoc` using `@xmldom/xmldom`.
- `js/ammo-db.js`, `js/weapons-db.js`, `js/util.js` — reference data and helpers.

The deliberate **impure seams** are `util.newId()` (uses `globalThis.crypto`) and
`xml-import.importFromXmlString` (uses `DOMParser`). Keep new logic pure; if it needs
a browser global, it belongs in the shell, not the core.

### Browser shell (verified manually, no Node test)
- `js/app.js` — owns the single in-memory `state`, exports `getState()` and
  **`mutate(fn)`**, and does view routing (`goPicker`/`goSheet`). Also registers
  the service worker.
- `js/ui/*.js` — render functions (`character-picker`, `character-sheet`, `io`) built
  on the tiny `el()`/`clear()` helpers in `js/ui/dom.js`.

### State flow (critical)
There is **one** state object and **one** way to change it:

```
mutate(fn):  state = fn(state)  →  saveState(state)  →  render()
```

`fn` is a pure `state → state` transform (usually composed from `model.js`). This means:
- **Every state change must go through `mutate()`** (or a UI helper like
  `character-sheet.js`'s `updateCharacter`, which wraps it). Calling a model function
  without `mutate` will neither persist nor update the UI.
- Rendering is **full re-render** on every mutation (no virtual DOM / diffing) — fine
  at this data scale; don't add diffing without reason.
- State shape persisted under the `localStorage` key `sr6-ammo-tracker`:
  `{ version: 1, characters: [...], activeId: string|null }`.

### Conventions and gotchas that span files
- **Round ops return a whole weapon.** `fire/spend/addRounds/setLoaded` return a full
  weapon object, which the UI passes as the `changes` arg to `updateWeapon(ch, id,
  changes)` — `updateWeapon` shallow-merges, so a full object replaces all fields. This
  is intentional; see the comment in `character-sheet.js`.
- **Reload matching.** A weapon reloads only from reserve pools whose `ammoCategory`
  equals the weapon's. Reserve pools are uniquely keyed by `(ammoCategory, ammoType)`.
  Switching ammo type with rounds still loaded returns the leftovers to their pool
  before loading the new type. The full algorithm lives in `model.reload`; its branches
  are pinned by `test/model-reload.test.js`.
- **sr6char ammo counts are in units of 10 rounds.** `xml-import` multiplies imported
  reserve counts by `ROUNDS_PER_AMMO_UNIT` (10). Weapon magazine sizes are already real
  rounds and are NOT scaled.
- **Weapon lookup is intentionally sparse.** `weapons-db.js` seeds only a few weapons
  with real magazine/firing-mode data; unknown XML refs fall back to a prettified name +
  placeholder magazine + default `SS/SA` modes, all editable in the UI.
- **Service worker asset list must stay in sync.** `sw.js` precaches an explicit
  `ASSETS` array; `cache.addAll` fails atomically if any listed path 404s. When you add,
  rename, or remove a JS/CSS/asset file, update `ASSETS` and bump the `CACHE` version
  (e.g. `sr6-ammo-v1` → `v2`) or offline mode breaks / serves stale code.

## Testing

`node --test` runs the pure-core modules only. The UI/PWA modules import browser globals
(`document`, `localStorage`, `DOMParser`) that don't exist in Node, so they are **not**
node-testable — for those, `node --check <file>` catches syntax errors and the change is
verified by running the app in a browser. New behavior should be pushed into the pure
core (where it can be tested) rather than into render functions where possible.

## Persistence model

All character data is auto-saved to browser `localStorage` (one JSON blob, key
`sr6-ammo-tracker`) on every mutation — scoped per-origin and per-device, no server, no
cross-device sync. `localhost` and the GitHub Pages origin have separate stores. The
only portable/durable path is the JSON **Export/Import** in `js/ui/io.js` (Import merges
by character `id`). See README.md for the user-facing details.
