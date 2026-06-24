// Shared helpers for the character-sheet UI modules (weapon-card, modals,
// character-sheet): state mutation, localized names, and grouping.
import { getState, mutate } from '../app.js';
import { upsertCharacter } from '../model.js';
import { categoryName, typeName } from '../ammo-db.js';
import { getCatalog, catalogCategoryName, catalogTypeName } from '../catalog.js';
import { STANDARD_FIRING_MODES, modeLabel as firingModeLabel } from '../firing-modes.js';

// Standard SR6 firing modes offered when creating a weapon (re-exported from the
// firing-mode rules module).
export { STANDARD_FIRING_MODES };

export function uiLang() { return getState().lang || 'en'; }

// Localized firing-mode label (e.g. 'BF' in English, 'SM' in German).
export function modeLabel(code) { return firingModeLabel(code, uiLang()); }

// Localized display names: prefer the loaded catalog's name (in the current
// language), falling back to the built-in tables when no catalog is loaded or
// the id is unknown to it.
export function catName(ref) {
  return catalogCategoryName(getCatalog(), ref, uiLang()) || categoryName(ref);
}
export function typeNameL(code) {
  return catalogTypeName(getCatalog(), code, uiLang()) || typeName(code);
}

// Option ids for the ammo category / type dropdowns come solely from the loaded
// catalog — empty when no catalog is loaded (the catalog is the source of truth
// for ammo). The built-in tables remain only as a display-name fallback.
export function ammoCategoryIds() {
  const cat = getCatalog();
  return cat ? Object.keys(cat.ammoCategories || {}) : [];
}
export function ammoTypeIds() {
  const cat = getCatalog();
  return cat ? Object.keys(cat.ammoTypes || {}) : [];
}

// Apply a Character->Character transform to the active character.
export function updateCharacter(characterId, fn) {
  mutate((s) => {
    const c = s.characters.find((x) => x.id === characterId);
    if (!c) return s;
    return { ...s, characters: upsertCharacter(s.characters, fn(c)) };
  });
}

export function findW(character, weaponId) {
  return character.weapons.find((x) => x.id === weaponId);
}

// All drone names for a character: the explicit drones list unioned with any
// drone referenced by a weapon's mount (preserves explicit order, new ones last).
export function droneNames(c) {
  return [...new Set([
    ...(c.drones ?? []),
    ...c.weapons.filter((w) => w.mount !== 'carried').map((w) => w.mount),
  ])];
}
