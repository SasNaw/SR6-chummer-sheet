import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS_DB, getWeaponDef } from '../js/weapons-db.js';

test('known weapons resolve to full definitions', () => {
  const har = getWeaponDef('fn_har');
  assert.equal(har.name, 'FN HAR');
  assert.equal(har.ammoCategory, 'ammo_rifles');
  assert.ok(har.magazineCapacity > 0);
  assert.ok(har.firingModes.some((m) => m.mode === 'FA'));
});

test('heavy pistols share SMG ammo', () => {
  assert.equal(getWeaponDef('ares_predator_vi').ammoCategory, 'ammo_heavy_smg');
});

test('unknown refs fall back to a prettified, editable default', () => {
  const def = getWeaponDef('some_unknown_gun');
  assert.equal(def.name, 'Some Unknown Gun');
  assert.equal(def.magazineCapacity, 10);
  assert.equal(def.ammoCategory, null);
  assert.deepEqual(def.firingModes, [
    { mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 1 },
  ]);
});

test('WEAPONS_DB entries are distinct objects (no shared mutation)', () => {
  assert.notEqual(getWeaponDef('fn_har').firingModes, getWeaponDef('fn_har').firingModes);
});
