import { newId, clamp } from './util.js';
import { FIRING_MODE_ROUNDS } from './firing-modes.js';
import { ATTACK_RATING_BANDS } from './catalog.js';

// Re-exported so the UI can import firing-mode display logic from the model.
export { expandFiringModes } from './firing-modes.js';

export function createReservePool(props = {}) {
  const { ammoCategory, ammoType = 'regular', count = 0 } = props;
  return { ammoCategory, ammoType, count };
}

// Coerce anything into exactly ATTACK_RATING_BANDS non-negative integers. 0 means
// "no rating at that range" (Genesis's own representation) and renders as an
// em dash; blanks, junk and negatives all collapse to it.
function normalizeAttackRating(values) {
  const src = Array.isArray(values) ? values : [];
  const out = new Array(ATTACK_RATING_BANDS).fill(0);
  for (let i = 0; i < ATTACK_RATING_BANDS; i += 1) {
    const n = parseInt(src[i], 10);
    if (Number.isInteger(n) && n > 0) out[i] = n;
  }
  return out;
}

export function createWeapon(props = {}) {
  const {
    name = '', alias = '', ref = '', mount = 'carried', magazineCapacity = 0,
    ammoCategory = null, firingModes = [], loaded, notes = '', stashed = false,
    attackRating = [], id,
  } = props;
  return {
    id: id !== undefined ? id : newId(),
    name, alias, ref, mount, magazineCapacity, ammoCategory,
    firingModes: firingModes.map((m) => ({ ...m })),
    loaded: loaded ? { ...loaded } : { ammoType: 'regular', count: 0 },
    attackRating: normalizeAttackRating(attackRating),
    notes,
    stashed,
  };
}

// Returns a whole weapon (like the round ops) so the UI can hand it straight to
// updateWeapon as `changes`.
export function setAttackRating(weapon, values) {
  return { ...weapon, attackRating: normalizeAttackRating(values) };
}

// Fill in attack ratings for weapons that have none, from the loaded catalog:
// by catalog `ref` first, then by an exact match on either localized catalog
// name. A weapon with any non-zero band is left alone, so a value someone edited
// for weapon mods is never overwritten.
export function backfillAttackRatings(character, catalog) {
  const entries = catalog && catalog.weapons;
  if (!entries) return character;

  const byName = new Map();
  for (const e of Object.values(entries)) {
    if (e.name) byName.set(e.name, e);
    if (e.nameDe) byName.set(e.nameDe, e);
  }

  let changed = false;
  const weapons = character.weapons.map((w) => {
    const current = Array.isArray(w.attackRating) ? w.attackRating : [];
    if (current.some((n) => n > 0)) return w;
    const hit = (w.ref && entries[w.ref]) || byName.get(w.name);
    if (!hit || !hit.attackRating) return w;
    changed = true;
    return { ...w, attackRating: normalizeAttackRating(hit.attackRating) };
  });
  return changed ? { ...character, weapons } : character;
}

// The label shown for a weapon: the base name on its own, or, when the user has
// set an alias, "Alias (Base Name)". `name` is the real/catalog weapon name;
// `alias` is an optional user-chosen display name.
export function weaponDisplayName(weapon) {
  const alias = (weapon.alias || '').trim();
  return alias ? `${alias} (${weapon.name})` : weapon.name;
}

export function createCharacter(props = {}) {
  const { name = '', realName = '', weapons = [], reserves = [], drones = [], spirits = [], magic = false, id } = props;
  return {
    id: id !== undefined ? id : newId(),
    name, realName, magic,
    weapons: weapons.map((w) => ({ ...w })),
    reserves: reserves.map((r) => ({ ...r })),
    drones: [...drones],
    spirits: spirits.map((s) => ({ ...s })),
  };
}

function withCount(weapon, count) {
  return { ...weapon, loaded: { ...weapon.loaded, count } };
}

export function fire(weapon, mode) {
  const rounds = FIRING_MODE_ROUNDS[mode];
  if (rounds == null) throw new Error(`Unknown firing mode "${mode}"`);
  return withCount(weapon, Math.max(0, weapon.loaded.count - rounds));
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
  if (!character.reserves.some((r) => r.ammoCategory === ammoCategory && r.ammoType === ammoType)) {
    return character;
  }
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

export function addDrone(character, name) {
  const drones = character.drones ?? [];
  if (!name || drones.includes(name)) return character;
  return { ...character, drones: [...drones, name] };
}

// Removes the drone and every weapon mounted on it (mount === name).
export function removeDrone(character, name) {
  return {
    ...character,
    drones: (character.drones ?? []).filter((d) => d !== name),
    weapons: character.weapons.filter((w) => w.mount !== name),
  };
}

// A summoned spirit. Self-contained snapshot of its catalog entry (attributes are
// Force offsets, powers/skills/weaknesses are {en,de} pairs) plus the chosen Force,
// the selected optional powers, and an owed-services counter. Snapshotting (like
// weapons) keeps cards renderable after the catalog is cleared or moved devices.
export function createSpirit(props = {}) {
  const {
    name = '', type = '', typeName = { en: '', de: null }, force = 0, services = 0,
    attributes = {}, conditionMonitor = '',
    initiative = '', astralInitiative = '', actions = '', movement = '',
    skills = [], powers = [], optionalPowers = [], weaknesses = [], id,
  } = props;
  const copyPairs = (list) => list.map((p) => ({ ...p }));
  return {
    id: id !== undefined ? id : newId(),
    name, type, typeName: { ...typeName }, force, services,
    attributes: { ...attributes }, conditionMonitor,
    initiative, astralInitiative, actions, movement,
    skills: copyPairs(skills), powers: copyPairs(powers),
    optionalPowers: copyPairs(optionalPowers), weaknesses: copyPairs(weaknesses),
  };
}

export function addSpirit(character, spirit) {
  return { ...character, spirits: [...(character.spirits ?? []), { ...spirit }] };
}

export function updateSpirit(character, spiritId, changes) {
  return {
    ...character,
    spirits: (character.spirits ?? []).map((s) => (s.id === spiritId ? { ...s, ...changes } : s)),
  };
}

export function removeSpirit(character, spiritId) {
  return { ...character, spirits: (character.spirits ?? []).filter((s) => s.id !== spiritId) };
}

// Actual attribute values at the spirit's Force: Force + offset, floored at the
// SR6 minimum of 1.
export function spiritAttributeValues(spirit) {
  const out = {};
  for (const [key, offset] of Object.entries(spirit.attributes || {})) {
    out[key] = Math.max(1, spirit.force + offset);
  }
  return out;
}

// SR6 spirit physical condition monitor: 8 + (Force / 2, rounded up).
export function spiritConditionMonitor(spirit) {
  return 8 + Math.ceil(spirit.force / 2);
}

// How many optional powers a spirit of the given Force may take: Force / 3, floored.
export function optionalPowerCap(force) {
  return Math.floor(force / 3);
}

export function upsertCharacter(characters, character) {
  const idx = characters.findIndex((c) => c.id === character.id);
  if (idx === -1) return [...characters, character];
  return characters.map((c, i) => (i === idx ? character : c));
}
