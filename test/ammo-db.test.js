import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMMO_CATEGORIES, AMMO_TYPES, categoryName, typeName } from '../js/ammo-db.js';

test('AMMO_CATEGORIES covers the canonical SR6 pools', () => {
  const refs = Object.keys(AMMO_CATEGORIES);
  for (const r of [
    'ammo_holdout_light_machine', 'ammo_heavy_smg', 'ammo_rifles', 'ammo_shotgun',
    'ammo_machine_gun', 'ammo_cannon', 'ammo_taser', 'ammo_darts', 'ammo_dmso',
    'ammo_arrow', 'ammo_injection_arrow', 'ammo_bolt', 'ammo_injection_bolt',
  ]) {
    assert.ok(refs.includes(r), `missing category ${r}`);
  }
});

test('AMMO_TYPES holds raw sr6char choice codes (the stored identity)', () => {
  assert.ok(AMMO_TYPES.includes('regular'));
  assert.ok(AMMO_TYPES.includes('apds'));
  assert.ok(AMMO_TYPES.includes('explosive'));
  assert.ok(AMMO_TYPES.includes('stick_n_shock'));
});

test('categoryName returns the display name, or prettifies unknown refs', () => {
  assert.equal(categoryName('ammo_heavy_smg'), 'Heavy Pistol / SMG');
  assert.equal(categoryName('ammo_bolt'), 'Bolt');
  assert.equal(categoryName('ammo_grenade'), 'Ammo Grenade');
});

test('typeName turns choice codes into display labels, prettifying unknowns', () => {
  assert.equal(typeName('apds'), 'APDS');
  assert.equal(typeName('apds_caseless'), 'APDS (Caseless)');
  assert.equal(typeName('stick_n_shock'), 'Stick-n-Shock');
  assert.equal(typeName('regular'), 'Regular');
  assert.equal(typeName('homebrew_round'), 'Homebrew Round'); // fallback to prettifyRef
});
