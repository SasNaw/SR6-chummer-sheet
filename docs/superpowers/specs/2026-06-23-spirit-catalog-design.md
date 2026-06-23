# Spirit Catalog — Design

**Date:** 2026-06-23
**Status:** Approved (pending spec review)

## Goal

Add an on-device **spirit catalog**, analogous to the weapon catalog: a locally
imported reference of SR6 spirit types with their Force-based attributes, innate
powers, optional powers, skills, and weaknesses — in English and German. The
catalog file is licensed content and must never enter the repo; it is loaded on
the device, mirroring the weapon-catalog handling.

This task delivers the **data + generator + loader + on-device Load/Clear UI +
tests**. Rendering spirits inside the Magic section is explicitly out of scope
(a later task), exactly as the weapon catalog shipped as load-only first.

## Scope

- **Spirit coverage:** the **6 core spirits** documented in the user's local
  `geister/` HTML files: Air, Beasts, Earth, Fire, Kin/Man, Water. The Street
  Wyrd spirits (plants, guardian, guidance, task) listed by Genesis are *not*
  included now; they can be added later by extending the local source file.
- **Languages:** English + German, like the weapon catalog.
- **No Magic-section UI**, no XML-import changes, no model changes.

## Data sourcing (no licensed content in the repo)

Two licensed sources, both local to the user's machine:

1. **`geister/` HTML** (default `~/Downloads/geister`, override via env): the
   per-spirit German stat blocks — attribute offsets, condition monitor,
   initiative, actions, movement, skills (*Fertigkeiten*), innate powers
   (*Kräfte*), optional powers (*zusätzliche Kräfte*), weaknesses (*Schwächen*).
2. **Genesis jar** (already used by the weapon generator): canonical localized
   spirit **type names** via the `spirit.<id>=` i18n keys (EN/DE), so catalog
   ids/names match what an imported character would reference.

Because the spreadsheet-exported HTML is brittle to parse and the data set is
small and fixed, the chosen approach is **authored local source + thin
generator** (not an HTML parser in committed code):

- I read the HTML and author a clean, gitignored **`data-local/spirit-source.json`**
  carrying both German and English values (English from the standard SR6 core
  terms). This file holds all rulebook-derived content.
- A committed, **pure-logic** generator validates that source, merges the
  Genesis type-names, and writes the catalog. The committed generator contains
  **no rulebook data and no term glossary** — only structure/validation logic
  and the Genesis name lookup.

Both `data-local/spirit-source.json` and `data-local/spirits-catalog.json` are
already gitignored (the whole `/data-local/` directory plus the `*-catalog.json`
glob in `.gitignore`).

## Catalog shape

`data-local/spirits-catalog.json`:

```json
{
  "source": "geister/ HTML (GRW) + Genesis names — licensed, local use only",
  "counts": { "spirits": 6 },
  "spirits": {
    "spirit_of_air": {
      "id": "spirit_of_air",
      "name": { "en": "Spirits of Air", "de": "Luftgeister" },
      "attributes": {
        "body": -2, "agility": 3, "reaction": 4, "strength": -3,
        "willpower": 0, "logic": 0, "intuition": 0, "charisma": 0,
        "magic": 0, "essence": 0
      },
      "conditionMonitor": 8,
      "initiative": "(F*2)+2 +2D6",
      "astralInitiative": "(F*2)+3D6",
      "actions": "1 Major, 3 Minor",
      "movement": "5/10 +5",
      "skills": [ { "en": "Astral", "de": "Astral" }, "..." ],
      "powers": [ { "en": "Astral Form", "de": "astr. Gestalt" }, "..." ],
      "optionalPowers": [ { "en": "Elemental Attack", "de": "elem. Angriff" }, "..." ],
      "weaknesses": [ { "en": "Allergy (inhaled toxins, severe)", "de": "Allergie (Toxine mit Inhalationsvektor, schwer)" } ]
    }
  }
}
```

Notes:
- Attribute values are **Force offsets** (the actual value is Force + offset),
  matching how the HTML expresses them. `essence`/`magic` are included for
  completeness even when 0.
- `initiative`/`astralInitiative`/`actions`/`movement` are stored as display
  strings (faithful to the source); no arithmetic is performed.
- Each skill/power/optional-power/weakness is a localized `{en,de}` pair so the
  UI can show either language with the same fallback rule as weapons (DE if
  present, else EN).

## Authored source shape

`data-local/spirit-source.json` is the same per-spirit data minus the
`name` block (the generator fills `name` from Genesis, falling back to the
source's own `nameEn`/`nameDe` if Genesis lacks the id). Keeping authored data
separate from the merge step means re-running the generator re-pulls fresh
Genesis names without re-authoring.

## Components

### `js/spirit-catalog.js` (new — committed, pure logic, mirrors `catalog.js`)
- `isSpiritCatalog(obj)` → boolean; validates `obj.spirits` is a non-empty object.
- `localizedName(entry, lang)` → DE if present else EN (shared helper for
  name/skill/power pairs).
- `spiritList(catalog, lang)` → array of `{ id, label, spirit }` sorted by label
  (label = localized `name`); `[]` for null/invalid input.
- `getSpiritCatalog()` / `setSpiritCatalog(obj)` / `clearSpiritCatalog()` —
  `localStorage` key **`sr6-spirit-catalog`**; `setSpiritCatalog` validates with
  `isSpiritCatalog` and returns boolean success.
- `spiritCatalogCount()` → number of spirits (0 when none).

These are the only `localStorage` touchpoints for the spirit catalog. The module
has no DOM dependency and is unit-testable under `node --test`.

### `tools/build-spirit-catalog.mjs` (new — committed, no rulebook data)
- Reads `data-local/spirit-source.json`.
- Extracts EN/DE `spirit.<id>=` names from the Genesis jar (same jar path/env as
  `build-weapon-catalog.mjs`); for each source spirit, sets `name` from Genesis,
  falling back to the source's `nameEn`/`nameDe`.
- Validates each spirit has the required fields; throws with a clear message on
  missing/malformed data.
- Writes `data-local/spirits-catalog.json` and logs the counts.

### `js/ui/io.js` (modify)
- Add **Load spirit catalog** (file input → parse JSON → `setSpiritCatalog`) and
  **Clear spirit catalog** controls with a status line
  (`spiritCatalogStatus(n)` / `noSpiritCatalog`), placed next to the existing
  weapon-catalog controls. On invalid file, show `spiritCatalogInvalid`.

### `js/i18n.js` (modify)
- Add EN+DE keys: `loadSpiritCatalog`, `clearSpiritCatalog` (reuse style of the
  weapon keys), `spiritCatalogStatus(n)`, `noSpiritCatalog`,
  `spiritCatalogLoaded(n)`, `spiritCatalogInvalid`, `clearSpiritCatalogConfirm`.

### `sw.js` (modify)
- Add `js/spirit-catalog.js` to the `ASSETS` precache list and bump `CACHE`.

## Testing

`test/spirit-catalog.test.js` (new), against a small inline fixture (2 spirits) —
never the real licensed data. Following the existing `catalog.test.js`, only the
**pure helpers** are unit-tested (the `localStorage`-backed get/set/clear are not
Node-testable and are verified in the browser):
- `isSpiritCatalog` accepts a valid shape, rejects `{}`/`null`/missing `spirits`.
- `localizedName` returns DE when present, falls back to EN when DE is null/absent.
- `spiritList` yields labelled, sorted entries; returns `[]` for null/invalid.

UI (`io.js`), the `localStorage` get/set/clear functions, and the generator are
verified manually (browser + a local run of the generator), consistent with the
project's testing split. `node --check` covers UI/generator syntax.

## Out of scope (future)
- Rendering spirits in the Magic section.
- Importing summoned/bound spirits from character XML.
- Street Wyrd and other non-core spirits.
- Computing concrete attribute values for a chosen Force (UI concern).
