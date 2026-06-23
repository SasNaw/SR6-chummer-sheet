// Optional, on-device weapon catalog (generated locally from a licensed Genesis
// install — see tools/build-weapon-catalog.mjs). Stored in its own localStorage
// key, never in character data or backups. Pure helpers below are unit-tested;
// the localStorage-backed wrappers are browser-only.

const KEY = 'sr6-weapon-catalog';
let cache; // undefined = not read yet, null = none loaded, object = loaded catalog

// --- Pure helpers -----------------------------------------------------------

export function isWeaponCatalog(obj) {
  return Boolean(obj && typeof obj === 'object' && obj.weapons && typeof obj.weapons === 'object');
}

// A weapon entry's display name in the chosen language (falls back to English).
export function pickName(entry, lang) {
  if (!entry) return null;
  return (lang === 'de' && entry.nameDe) ? entry.nameDe : (entry.name || null);
}

// Genesis appends a pack size like " (10x)" to ammo names; drop it for display.
function stripPack(s) {
  return typeof s === 'string' ? s.replace(/\s*\(\d+\s*x\)\s*$/i, '') : s;
}

// Localized name from an {id: {en, de}} map (ammoCategories / ammoTypes).
export function localizedName(map, id, lang) {
  const e = map && map[id];
  if (!e) return null;
  const name = (lang === 'de' && e.de) ? e.de : (e.en || null);
  return name ? stripPack(name) : null;
}

export function catalogCategoryName(catalog, id, lang) {
  return catalog ? localizedName(catalog.ammoCategories, id, lang) : null;
}

export function catalogTypeName(catalog, code, lang) {
  return catalog ? localizedName(catalog.ammoTypes, code, lang) : null;
}

// Weapons as a list with a localized `label`, sorted by that label.
export function catalogWeaponList(catalog, lang) {
  if (!catalog || !catalog.weapons) return [];
  return Object.values(catalog.weapons)
    .map((w) => ({ ...w, label: pickName(w, lang) }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

// --- localStorage-backed (browser only) ------------------------------------

export function getCatalog() {
  if (cache === undefined) {
    try { cache = JSON.parse(localStorage.getItem(KEY)) || null; } catch { cache = null; }
  }
  return cache;
}

export function setCatalog(obj) {
  if (!isWeaponCatalog(obj)) throw new Error('not a weapon catalog');
  localStorage.setItem(KEY, JSON.stringify(obj));
  cache = obj;
}

export function clearCatalog() {
  localStorage.removeItem(KEY);
  cache = null;
}

export function catalogCount() {
  const c = getCatalog();
  return c ? Object.keys(c.weapons).length : 0;
}
