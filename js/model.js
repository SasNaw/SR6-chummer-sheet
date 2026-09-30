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

// Attack-rating text fields in the weapon dialog. A band without a rating is
// written "-"; 0 means the same thing and is always shown as "-".
//
// Live-cleans what the user typed: digits only, leading zeros dropped, and any
// dash (or an all-zero value) collapses to "-". A digit typed over the dash
// replaces it ("-5" -> "5"); a dash typed after digits clears to "-".
export function sanitizeArInput(raw) {
  const s = String(raw ?? '');
  const digits = s.replace(/[^0-9]/g, '');
  const dashAt = s.search(/[-\u2013\u2014]/);
  if (dashAt !== -1 && !(dashAt === 0 && digits)) return '-';
  if (!digits) return '';
  const trimmed = digits.replace(/^0+/, '');
  return trimmed || '-';
}

// The stored value of an attack-rating field: its number, or 0 for "-"/blank.
export function parseArInput(text) {
  const n = parseInt(text, 10);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// The field text for a stored band value.
export function formatArInput(value) {
  return value > 0 ? String(value) : '-';
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
    drones: drones.map((d) => ({ ...normalizeDrone(d) })),
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

// Adds `count` rounds back to the (category, type) pool in `reserves` (a copy
// owned by the caller), creating the pool when it does not exist.
function returnToPool(reserves, ammoCategory, ammoType, count) {
  if (count <= 0) return;
  const idx = reserveIndex(reserves, ammoCategory, ammoType);
  if (idx === -1) reserves.push({ ammoCategory, ammoType, count });
  else reserves[idx] = { ...reserves[idx], count: reserves[idx].count + count };
}

export function reload(character, weaponId, chosenType) {
  const wIdx = character.weapons.findIndex((x) => x.id === weaponId);
  if (wIdx === -1) return character;
  const weapon = character.weapons[wIdx];
  const reserves = character.reserves.map((r) => ({ ...r }));

  if (reserveIndex(reserves, weapon.ammoCategory, chosenType) === -1) return character;

  let loaded = { ...weapon.loaded };
  if (loaded.count > 0 && loaded.ammoType !== chosenType) {
    returnToPool(reserves, weapon.ammoCategory, loaded.ammoType, loaded.count);
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

// Applies the weapon dialog's edits (name, alias, ammoCategory, magazineCapacity,
// attackRating, firingModes) and keeps the loaded ammo consistent:
// - a new weapon type unloads every round back into its old pool and switches the
//   loaded type to one this weapon type has a reserve for (else 'regular');
// - a capacity below the loaded count returns the excess rounds to their pool.
// Returned rounds create their pool when none exists (as reload does).
export function editWeapon(character, weaponId, changes) {
  const w = character.weapons.find((x) => x.id === weaponId);
  if (!w) return character;
  const reserves = character.reserves.map((r) => ({ ...r }));
  const next = {
    ...w, ...changes,
    attackRating: normalizeAttackRating(changes.attackRating ?? w.attackRating),
    firingModes: (changes.firingModes ?? w.firingModes).map((m) => ({ ...m })),
  };
  let loaded = { ...w.loaded };

  if (next.ammoCategory !== w.ammoCategory) {
    returnToPool(reserves, w.ammoCategory, loaded.ammoType, loaded.count);
    const pool = reserves.find((r) => r.ammoCategory === next.ammoCategory);
    loaded = { ammoType: pool ? pool.ammoType : 'regular', count: 0 };
  } else if (loaded.count > next.magazineCapacity) {
    returnToPool(reserves, w.ammoCategory, loaded.ammoType, loaded.count - next.magazineCapacity);
    loaded = { ...loaded, count: next.magazineCapacity };
  }

  next.loaded = loaded;
  return {
    ...character,
    reserves,
    weapons: character.weapons.map((x) => (x.id === weaponId ? next : x)),
  };
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

// A drone. Weapons mount on it by `name` (weapon.mount === drone.name). `ref` is
// the Genesis item id; `typeName` ({en,de}), `size`, `subtype` and `stats` are a
// snapshot of its drone-catalog entry (null when added by hand or no catalog was
// loaded), so cards stay renderable after the catalog is cleared. `stats` holds
// handling (string, e.g. "3/5" on-/off-road), acceleration, speedInterval,
// topSpeed, body, armor, pilot, sensor.
export function createDrone(props = {}) {
  const {
    name = '', ref = null, typeName = null, size = null, subtype = null, count = 1, stats = null, id,
  } = props;
  return {
    id: id !== undefined ? id : newId(),
    name, ref, typeName: typeName ? { ...typeName } : null, size, subtype, count,
    stats: stats ? { ...stats } : null,
  };
}

// Drones used to be stored as plain name strings; upgrade those to objects.
export function normalizeDrone(d) {
  return typeof d === 'string' ? createDrone({ name: d }) : d;
}

// Appends a drone (a name or a drone object); no-op for an empty or taken name.
export function addDrone(character, droneOrName) {
  const drone = normalizeDrone(droneOrName);
  const drones = character.drones ?? [];
  if (!drone.name || drones.some((d) => d.name === drone.name)) return character;
  return { ...character, drones: [...drones, { ...drone }] };
}

// Removes the drone and every weapon mounted on it (mount === name).
export function removeDrone(character, name) {
  return {
    ...character,
    drones: (character.drones ?? []).filter((d) => d.name !== name),
    weapons: character.weapons.filter((w) => w.mount !== name),
  };
}

// A summoned spirit. Self-contained snapshot of its catalog entry (attributes are
// Force offsets, powers/skills/weaknesses are {en,de} pairs) plus the chosen Force,
// the selected optional powers, and an owed-services counter. Snapshotting (like
// weapons) keeps cards renderable after the catalog is cleared or moved devices.
export function createSpirit(props = {}) {
  const {
    name = '', type = '', typeName = { en: '', de: null }, force = 0, services = 0, damage = 0,
    attributes = {}, conditionMonitor = '',
    initiative = '', astralInitiative = '', actions = '', movement = '',
    skills = [], powers = [], optionalPowers = [], weaknesses = [], id,
  } = props;
  const copyPairs = (list) => list.map((p) => ({ ...p }));
  return {
    id: id !== undefined ? id : newId(),
    name, type, typeName: { ...typeName }, force, services, damage,
    attributes: { ...attributes }, conditionMonitor,
    initiative, astralInitiative, actions, movement,
    skills: copyPairs(skills), powers: copyPairs(powers),
    optionalPowers: copyPairs(optionalPowers), weaknesses: copyPairs(weaknesses),
  };
}

// A spirit built from a spirit-catalog entry plus the dialog's choices (name,
// Force, services, selected optional powers). Shared by summoning and by
// changing an existing spirit's type.
export function spiritFromCatalog(entry, { id, name = '', force = 1, services = 0, optionalPowers = [] } = {}) {
  return createSpirit({
    id, name, type: entry.id, typeName: entry.name,
    force: Math.max(1, force), services: Math.max(0, services),
    attributes: entry.attributes, conditionMonitor: entry.conditionMonitor,
    initiative: entry.initiative, astralInitiative: entry.astralInitiative,
    actions: entry.actions, movement: entry.movement,
    skills: entry.skills || [], powers: entry.powers || [],
    optionalPowers, weaknesses: entry.weaknesses || [],
  });
}

// Applies the spirit dialog's edits. `entry` is the catalog entry of the chosen
// type (optional). The same type keeps the stored snapshot and only changes
// name / Force / services / optional powers; a different type re-snapshots the
// spirit from `entry`, keeping its id.
export function editSpirit(character, spiritId, { name = '', force = 1, services = 0, optionalPowers = [], entry = null }) {
  const spirits = character.spirits ?? [];
  const old = spirits.find((s) => s.id === spiritId);
  if (!old) return character;
  const choices = { id: old.id, name, force, services, optionalPowers };
  const next = entry && entry.id !== old.type
    ? spiritFromCatalog(entry, choices)
    : {
      ...old, name, force: Math.max(1, force), services: Math.max(0, services),
      optionalPowers: optionalPowers.map((p) => ({ ...p })),
    };
  // Damage carries over, capped when a lower Force shrinks the condition monitor.
  next.damage = clamp(old.damage ?? 0, 0, spiritConditionMonitor(next));
  return { ...character, spirits: spirits.map((s) => (s.id === spiritId ? next : s)) };
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

// Condition-monitor boxes are numbered 1..n from the left; `damage` d means boxes
// 1..d are filled. Clicking an empty box fills it and every box to its left;
// clicking a filled box empties it and every box to its right.
export function damageAfterBoxClick(damage, box) {
  return box > damage ? box : box - 1;
}

// Sets a spirit's damage, clamped to 0..its condition monitor.
export function setSpiritDamage(character, spiritId, damage) {
  const spirits = character.spirits ?? [];
  if (!spirits.some((s) => s.id === spiritId)) return character;
  return {
    ...character,
    spirits: spirits.map((s) => (s.id === spiritId
      ? { ...s, damage: clamp(damage, 0, spiritConditionMonitor(s)) } : s)),
  };
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
