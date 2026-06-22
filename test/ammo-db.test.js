import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMMO_CATEGORIES, AMMO_TYPES, categoryName } from '../js/ammo-db.js';

test('AMMO_CATEGORIES covers the canonical SR6 pools', () => {
  const refs = Object.keys(AMMO_CATEGORIES);
  for (const r of [
    'ammo_holdout_light_machine', 'ammo_heavy_smg', 'ammo_rifles', 'ammo_shotgun',
    'ammo_machine_gun', 'ammo_cannon', 'ammo_taser', 'ammo_darts', 'ammo_dmso',
    'ammo_arrow', 'ammo_injection_arrow',
  ]) {
    assert.ok(refs.includes(r), `missing category ${r}`);
  }
});

test('AMMO_TYPES includes regular and the common special rounds', () => {
  assert.ok(AMMO_TYPES.includes('regular'));
  assert.ok(AMMO_TYPES.includes('APDS'));
  assert.ok(AMMO_TYPES.includes('explosive'));
});

test('categoryName returns the display name, or prettifies unknown refs', () => {
  assert.equal(categoryName('ammo_heavy_smg'), 'Heavy Pistol / SMG');
  assert.equal(categoryName('ammo_grenade'), 'Ammo Grenade');
});
