import { prettifyRef } from './util.js';

// Canonical SR6 ammunition categories (which weapon families share which ammo).
export const AMMO_CATEGORIES = {
  ammo_holdout_light_machine: 'Holdout / Light / Machine Pistol',
  ammo_heavy_smg: 'Heavy Pistol / SMG',
  ammo_rifles: 'Rifle',
  ammo_shotgun: 'Shotgun',
  ammo_machine_gun: 'Machine Gun',
  ammo_cannon: 'Cannon / Assault Cannon',
  ammo_taser: 'Taser Dart',
  ammo_darts: 'Dart',
  ammo_dmso: 'DMSO Rounds',
  ammo_arrow: 'Arrow',
  ammo_injection_arrow: 'Injection Arrow',
};

// Default, user-extensible list of ammo types within a category.
export const AMMO_TYPES = [
  'regular', 'APDS', 'explosive', 'ex-explosive', 'gel', 'flechette',
  'stick-n-shock', 'tracer', 'hollow-point', 'subsonic', 'frangible', 'capsule',
];

export function categoryName(ref) {
  return AMMO_CATEGORIES[ref] || prettifyRef(ref);
}
