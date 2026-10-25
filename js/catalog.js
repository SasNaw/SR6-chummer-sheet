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

// Attack rating: Genesis stores it as `attack="10,9,8,,"` — five comma-separated
// range bands (Close/Near/Medium/Far/Extreme). Pinned to the behaviour of
// org.prelle.shadowrun6.persist.AttackRatingConverter, which allocates int[5],
// reads an empty band as 0, and uses a "STRx2" sentinel we map to 0 as well
// (it only occurs on unarmed attacks, which never reach this catalog).
export const ATTACK_RATING_BANDS = 5;

export function parseAttackRating(str) {
  const out = new Array(ATTACK_RATING_BANDS).fill(0);
  if (typeof str !== 'string') return out;
  const parts = str.split(',');
  for (let i = 0; i < Math.min(parts.length, ATTACK_RATING_BANDS); i += 1) {
    const n = parseInt(parts[i].trim(), 10); // '' and 'STRx2' -> NaN -> 0
    if (Number.isInteger(n) && n > 0) out[i] = n;
  }
  return out;
}

// An attack-rating change from a mod's <itemattrmod attr="ATTACK_RATING">: a
// flat `val="2"` applies to every band; `objVal="-2,,+1,+2,+1"` is per band,
// signed, blank = 0. null when neither is set.
export function parseAttackRatingMod({ val, objVal } = {}) {
  if (typeof objVal === 'string') {
    const parts = objVal.split(',');
    return Array.from({ length: ATTACK_RATING_BANDS }, (_, i) => parseInt((parts[i] || '').trim(), 10) || 0);
  }
  const n = parseInt(val, 10);
  return Number.isInteger(n) ? new Array(ATTACK_RATING_BANDS).fill(n) : null;
}

// A weapon's attack rating with its installed mods applied, as Genesis computes
// it. `modKeys` are the mods on the weapon, keyed like sr6char condition ids
// (`item.<accessory>` / `itemmod.<enhancement>`); `activeConditions` are the
// weapon's <conditions> ids (`<key>.cond.<n>`); `mods` is the catalog's
// key -> [{ ar, cond }] table. An effect with a `cond` applies only when that
// condition is active. Each mod counts once; a band the weapon has no rating in
// stays empty, and a rated band never drops below 1.
//
// Laser sights and smartguns are aiming aids that don't stack: per band they
// add at most the largest bonus any one installed aid can give (laser +1 and a
// smartgun's +2 make +2, not +3).
const AIMING_AID = /laser_sight|smartgun/;

export function moddedAttackRating(base, modKeys, activeConditions, mods) {
  if (!mods) return [...base];
  const active = new Set(activeConditions);
  const other = new Array(ATTACK_RATING_BANDS).fill(0);
  const aiming = new Array(ATTACK_RATING_BANDS).fill(0);
  const aimingCap = new Array(ATTACK_RATING_BANDS).fill(0);
  for (const key of new Set(modKeys)) {
    const isAim = AIMING_AID.test(key);
    for (const { ar, cond } of mods[key] || []) {
      for (let i = 0; i < ATTACK_RATING_BANDS; i += 1) {
        if (isAim) aimingCap[i] = Math.max(aimingCap[i], ar[i] || 0);
      }
      if (cond != null && !active.has(`${key}.cond.${cond}`)) continue;
      for (let i = 0; i < ATTACK_RATING_BANDS; i += 1) {
        if (isAim) aiming[i] += ar[i] || 0;
        else other[i] += ar[i] || 0;
      }
    }
  }
  return base.map((n, i) => (n > 0
    ? Math.max(1, n + other[i] + Math.min(aiming[i], aimingCap[i]))
    : n));
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
