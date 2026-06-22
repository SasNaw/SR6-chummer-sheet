import { newId, clamp } from './util.js';

export function createReservePool(props = {}) {
  const { ammoCategory, ammoType = 'regular', count = 0 } = props;
  return { ammoCategory, ammoType, count };
}

export function createWeapon(props = {}) {
  const {
    name = '', ref = '', mount = 'carried', magazineCapacity = 0,
    ammoCategory = null, firingModes = [], loaded, notes = '', id,
  } = props;
  return {
    id: id !== undefined ? id : newId(),
    name, ref, mount, magazineCapacity, ammoCategory,
    firingModes: firingModes.map((m) => ({ ...m })),
    loaded: loaded ? { ...loaded } : { ammoType: 'regular', count: 0 },
    notes,
  };
}

export function createCharacter(props = {}) {
  const { name = '', realName = '', weapons = [], reserves = [], id } = props;
  return {
    id: id !== undefined ? id : newId(),
    name, realName,
    weapons: weapons.map((w) => ({ ...w })),
    reserves: reserves.map((r) => ({ ...r })),
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
