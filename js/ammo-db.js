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
  ammo_bolt: 'Bolt',
  ammo_injection_bolt: 'Injection Bolt',
};

// An ammo type's identity is the raw sr6char "choice" code (e.g. "apds",
// "stick_n_shock"); these are the human-readable labels for display. Reload
// matching keys on the raw code, so the code — not the label — is the identity.
export const AMMO_TYPE_NAMES = {
  regular: 'Regular',
  apds: 'APDS',
  apds_caseless: 'APDS (Caseless)',
  explosive: 'Explosive',
  ex_explosive: 'EX-Explosive',
  flechette: 'Flechette',
  gel: 'Gel',
  stick_n_shock: 'Stick-n-Shock',
  tracer: 'Tracer',
  hollow_point: 'Hollow Point',
  subsonic: 'Subsonic',
  frangible: 'Frangible',
  capsule: 'Capsule',
  injection: 'Injection',
};

// Default, user-extensible list of ammo type codes offered when adding a pool.
export const AMMO_TYPES = Object.keys(AMMO_TYPE_NAMES);

export function categoryName(ref) {
  return AMMO_CATEGORIES[ref] || prettifyRef(ref);
}

export function typeName(code) {
  return AMMO_TYPE_NAMES[code] || prettifyRef(code);
}
