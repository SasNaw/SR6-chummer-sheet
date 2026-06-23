import { newId, clamp } from './util.js';

export function createReservePool(props = {}) {
  const { ammoCategory, ammoType = 'regular', count = 0 } = props;
  return { ammoCategory, ammoType, count };
}

export function createWeapon(props = {}) {
  const {
    name = '', alias = '', ref = '', mount = 'carried', magazineCapacity = 0,
    ammoCategory = null, firingModes = [], loaded, notes = '', stashed = false, id,
  } = props;
  return {
    id: id !== undefined ? id : newId(),
    name, alias, ref, mount, magazineCapacity, ammoCategory,
    firingModes: firingModes.map((m) => ({ ...m })),
    loaded: loaded ? { ...loaded } : { ammoType: 'regular', count: 0 },
    notes,
    stashed,
  };
}

// The label shown for a weapon: the base name on its own, or, when the user has
// set an alias, "Alias (Base Name)". `name` is the real/catalog weapon name;
// `alias` is an optional user-chosen display name.
export function weaponDisplayName(weapon) {
  const alias = (weapon.alias || '').trim();
  return alias ? `${alias} (${weapon.name})` : weapon.name;
}

export function createCharacter(props = {}) {
  const { name = '', realName = '', weapons = [], reserves = [], drones = [], magic = false, id } = props;
  return {
    id: id !== undefined ? id : newId(),
    name, realName, magic,
    weapons: weapons.map((w) => ({ ...w })),
    reserves: reserves.map((r) => ({ ...r })),
    drones: [...drones],
  };
}

function withCount(weapon, count) {
  return { ...weapon, loaded: { ...weapon.loaded, count } };
}

export function fire(weapon, mode) {
  const fm = weapon.firingModes.find((m) => m.mode === mode);
  if (!fm) throw new Error(`Unknown firing mode "${mode}"`);
  return withCount(weapon, Math.max(0, weapon.loaded.count - fm.rounds));
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

export function upsertCharacter(characters, character) {
  const idx = characters.findIndex((c) => c.id === character.id);
  if (idx === -1) return [...characters, character];
  return characters.map((c, i) => (i === idx ? character : c));
}
