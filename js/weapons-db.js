import { prettifyRef } from './util.js';

// ref -> { name, magazineCapacity, ammoCategory, firingModes }
// Magazine sizes and firing-mode round costs are sensible defaults the user edits.
export const WEAPONS_DB = {
  ares_predator_vi: {
    name: 'Ares Predator VI', magazineCapacity: 15, ammoCategory: 'ammo_heavy_smg',
    firingModes: [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 1 }],
  },
  fn_har: {
    name: 'FN HAR', magazineCapacity: 20, ammoCategory: 'ammo_rifles',
    firingModes: [{ mode: 'SA', rounds: 1 }, { mode: 'BF', rounds: 3 }, { mode: 'FA', rounds: 6 }],
  },
  remington_roomsweeper: {
    name: 'Remington Roomsweeper', magazineCapacity: 8, ammoCategory: 'ammo_shotgun',
    firingModes: [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 1 }],
  },
};

function cloneDef(def) {
  return { ...def, firingModes: def.firingModes.map((m) => ({ ...m })) };
}

export function getWeaponDef(ref) {
  if (WEAPONS_DB[ref]) return cloneDef(WEAPONS_DB[ref]);
  return {
    name: prettifyRef(ref),
    magazineCapacity: 10,
    ammoCategory: null,
    firingModes: [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 1 }],
  };
}
