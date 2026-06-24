import { prettifyRef } from './util.js';

// ref -> { name, magazineCapacity, ammoCategory, firingModes }
// Firing-mode round costs are the canonical SR6 values (see js/firing-modes.js);
// SS is added automatically wherever SA is present at display time.
export const WEAPONS_DB = {
  ares_predator_vi: {
    name: 'Ares Predator VI', magazineCapacity: 15, ammoCategory: 'ammo_heavy_smg',
    firingModes: [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 2 }],
  },
  fn_har: {
    name: 'FN HAR', magazineCapacity: 20, ammoCategory: 'ammo_rifles',
    firingModes: [{ mode: 'SA', rounds: 2 }, { mode: 'BF', rounds: 4 }, { mode: 'FA', rounds: 10 }],
  },
  remington_roomsweeper: {
    name: 'Remington Roomsweeper', magazineCapacity: 8, ammoCategory: 'ammo_shotgun',
    firingModes: [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 2 }],
  },
};

function cloneDef(def) {
  return { ...def, firingModes: def.firingModes.map((m) => ({ ...m })) };
}

export function getWeaponDef(ref) {
  if (Object.prototype.hasOwnProperty.call(WEAPONS_DB, ref)) return cloneDef(WEAPONS_DB[ref]);
  return {
    name: prettifyRef(ref),
    magazineCapacity: 10,
    ammoCategory: null,
    firingModes: [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 2 }],
  };
}
