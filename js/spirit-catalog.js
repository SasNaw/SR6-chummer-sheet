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
