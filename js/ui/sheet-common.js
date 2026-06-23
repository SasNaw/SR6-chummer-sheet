// Shared helpers for the character-sheet UI modules (weapon-card, modals,
// character-sheet): state mutation, localized names, and grouping.
import { getState, mutate } from '../app.js';
import { upsertCharacter } from '../model.js';
import { categoryName, typeName } from '../ammo-db.js';
import { getCatalog, catalogCategoryName, catalogTypeName } from '../catalog.js';

// Standard SR6 firing modes offered when creating a weapon (round cost per mode;
// editable later via the weapon's edit dialog).
export const STANDARD_FIRING_MODES = [
  { mode: 'SS', rounds: 1 },
  { mode: 'SA', rounds: 1 },
  { mode: 'BF', rounds: 3 },
  { mode: 'FA', rounds: 6 },
];

export function uiLang() { return getState().lang || 'en'; }

// Localized display names: English uses the built-in tables; German prefers the
// loaded catalog's translations, falling back to English.
export function catName(ref) {
  return uiLang() === 'de' ? (catalogCategoryName(getCatalog(), ref, 'de') || categoryName(ref)) : categoryName(ref);
}
export function typeNameL(code) {
  return uiLang() === 'de' ? (catalogTypeName(getCatalog(), code, 'de') || typeName(code)) : typeName(code);
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
