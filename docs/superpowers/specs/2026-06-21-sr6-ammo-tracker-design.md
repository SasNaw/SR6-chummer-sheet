# SR6 Ammo Tracker — Design

**Date:** 2026-06-21
**Status:** Approved (design phase)
**Repo:** https://github.com/SasNaw/SR6-chummer-sheet

## Purpose

A mobile-friendly tool for managing numbers on a Shadowrun 6 character, with the
primary focus on **counting weapon ammunition** at the table. It must run on any
phone with no app store involved, persist data between sessions, and support
multiple characters.

## Scope (v1)

In scope:

- Multiple characters, each with their own weapons and ammo.
- Per-weapon ammunition tracking: magazine, reload, reserve pool, multiple ammo
  types, free-text notes.
- Firing-mode buttons (tap a mode to subtract its round cost) **plus** manual
  `+`/`-` and set-value as fallback and for corrections.
- Import a character from a Shadowrun 6 `sr6char` XML export.
- JSON export/import for backup and device migration.

Explicitly out of scope for v1 (may come later): condition monitors, Edge,
generic reusable resource counters, firing-mode automation, cloud sync.

## Tech Stack

Approach: **vanilla HTML/CSS/JS, no build step.**

- Plain HTML/CSS/JS using native ES modules. No bundler, no framework, no
  `node_modules` required to run the app.
- Persistence in the browser via `localStorage` (data is small — a handful of
  characters as JSON).
- Progressive Web App: a `manifest.webmanifest` plus a service worker (`sw.js`)
  so the app installs to the phone home screen and works fully offline.
- Hosting: GitHub Pages, served from the repo. Deploy = push.
- Core logic lives in pure ES modules and is unit-tested with Node's built-in
  test runner (`node --test`). Node is a dev/test dependency only; the shipped
  app needs no toolchain.

Rationale: matches the "just HTML/CSS/JS" constraint, has zero toolchain to rot,
gives a trivial GitHub Pages deploy, and is durable for a tool relied on at the
table over years. The data volume does not justify a backend or a build step.

## Data Model

### Character

- `id` — stable unique id.
- `name` — character handle (e.g. "S4T0").
- `realName` — optional real name (e.g. `Kenji "Ken" Sato`).
- `weapons` — array of Weapon.
- `reserves` — array of ReservePool.

### Weapon

- `id` — stable unique id.
- `name` — display name (e.g. "Ares Predator VI").
- `ref` — original code from the XML (e.g. `ares_predator_vi`), kept for
  potential future re-import matching.
- `mount` — `"carried"` or a drone/vehicle name (shown as a badge).
- `magazineCapacity` — integer; from the weapons lookup table, editable.
- `loaded` — `{ ammoType, count }`: rounds currently in the magazine and their
  ammo type.
- `ammoCategory` — which reserve category this weapon draws from
  (e.g. `ammo_rifles`).
- `firingModes` — array of `{ mode, rounds }` the weapon supports, where `mode`
  is a label (e.g. `SS`, `SA`, `BF`, `FA`) and `rounds` is the number of rounds
  that mode spends per attack. Seeded from the weapons lookup table, editable per
  weapon (rules and house rules vary).
- `notes` — free text.

### ReservePool entry

- `{ ammoCategory, ammoType, count }` — e.g. `ammo_rifles` / `regular` / 29.

## Core Operations (model.js, pure functions)

- **Fire (mode)** — subtract the selected firing mode's `rounds` from
  `loaded.count`, floored at 0. (If the magazine has fewer rounds than the mode
  would spend, it empties to 0 rather than going negative.)
- **Spend** — subtract 1 (or N) from `loaded.count`, floored at 0.
- **Add** — add 1 (or N) back to `loaded.count`, capped at `magazineCapacity`.
- **Set value** — set `loaded.count` directly (manual correction).
- **Reload** — choose an `ammoType` available in the weapon's matching reserve
  pool, refill the magazine toward `magazineCapacity`, and decrement that reserve
  by the number of rounds actually loaded (can be partial if reserve is low).
- **Edit reserves** — adjust reserve counts and add/remove pools.
- **Edit weapon** — name, magazine capacity, ammo category, mount, notes.

All operations are pure (state in → new state out). Every mutation is persisted
to `localStorage` immediately by the store layer.

## Views

1. **Character picker**
   - List of characters; select the active one.
   - Add a blank character.
   - Import a character from `sr6char` XML.
   - Export / import a JSON backup (all characters).
   - Rename, delete.

2. **Character sheet**
   - One card per weapon: name + mount badge, `loaded / capacity`, a row of
     firing-mode buttons (only the modes that weapon supports, each labeled with
     its round cost), `-` / `+` / set-value / `Reload` controls, currently-loaded
     ammo type, notes.
   - A **Reserve ammo** section listing each pool by category and type with edit
     controls.

## XML Import (xml-import.js, pure function)

Parses the `sr6char` XML format into a new Character.

- **Weapons:** include both personally-carried firearms
  (`type="WEAPON_FIREARMS"`) and vehicle/drone-mounted weapons
  (`type="ACCESSORY"`, `slot="VEHICLE_WEAPON"`, embedded in a mount). Dedupe by
  `uniqueid`. Tag each weapon's `mount` from its source (carried vs. the
  containing drone/vehicle name where derivable).
- **Lookup:** resolve each `ref` against `weapons-db.js`
  (`ref → { name, magazineCapacity, ammoCategory, firingModes }`). Unknown refs
  fall back to a prettified name (underscores → spaces, title case), a placeholder
  magazine capacity, and a default firing-mode set the user edits.
- **Ammo reserves:** map `type="AMMUNITION"` items into reserve pools, where
  `ref` is the category, `choice` is the ammo type, and `count` is the quantity.
- **Non-destructive:** import always creates a *new* character. It never
  overwrites live counts on an existing character.

## Weapons Lookup Table (weapons-db.js)

A static map of
`ref → { name, magazineCapacity, ammoCategory, firingModes }`. Seeded with the
weapons in the sample export (`ares_predator_vi`, `fn_har`,
`remington_roomsweeper`) plus common SR6 firearms, including each weapon's
default supported firing modes and per-mode round costs. All values are editable
by the user after import, so coverage gaps degrade gracefully (unknown weapons
get a sensible default mode set the user can adjust).

## File Layout

```
index.html
manifest.webmanifest
sw.js
icons/
css/styles.css
js/app.js          (entry point, view switching, event wiring)
js/store.js        (localStorage load/save, JSON export/import)
js/model.js        (character/weapon operations — pure, unit-tested)
js/xml-import.js   (sr6char XML -> character — pure, unit-tested)
js/weapons-db.js   (ref lookup table)
js/ui/*.js         (render functions per view/component)
test/*.test.js     (node --test)
```

## Persistence & Backup

- All state is serialized to a single `localStorage` key as JSON, written on
  every mutation.
- **Export:** download a JSON file of all characters.
- **Import (JSON):** restore from a previously exported file. Merges by
  character `id` (upsert): characters present in the file are added or overwrite
  the matching existing character; characters not in the file are left untouched.
  This avoids accidentally wiping characters that weren't in the backup.
- **Import (XML):** create a new character from an `sr6char` export.

## Testing

- Pure modules (`model.js`, `xml-import.js`, `weapons-db.js`, serialization in
  `store.js`) are covered by `node --test`.
- The sample `S4T0.xml` is used as an import fixture to assert the parser
  produces the expected weapons, mounts, and reserve pools.

## Deployment

- GitHub Pages serving the repo root.
- No build step; pushing to the default branch publishes.
