import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReservePool, createWeapon, createCharacter, weaponDisplayName } from '../js/model.js';

test('createReservePool fills defaults', () => {
  assert.deepEqual(createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 5 }),
    { ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 5 });
  assert.deepEqual(createReservePool({ ammoCategory: 'ammo_rifles' }),
    { ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 0 });
});

test('createWeapon assigns an id and a default empty magazine', () => {
  const w = createWeapon({ name: 'Test', magazineCapacity: 10 });
  assert.match(w.id, /^[0-9a-f-]{36}$/);
  assert.equal(w.mount, 'carried');
  assert.deepEqual(w.loaded, { ammoType: 'regular', count: 0 });
  assert.deepEqual(w.firingModes, []);
});

test('createWeapon honours an explicit id and loaded value', () => {
  const w = createWeapon({ id: 'fixed', name: 'X', magazineCapacity: 5, loaded: { ammoType: 'APDS', count: 5 } });
  assert.equal(w.id, 'fixed');
  assert.deepEqual(w.loaded, { ammoType: 'APDS', count: 5 });
});

test('createWeapon defaults stashed to false and honours an explicit value', () => {
  assert.equal(createWeapon({ name: 'X' }).stashed, false);
  assert.equal(createWeapon({ name: 'X', stashed: true }).stashed, true);
});

test('createWeapon defaults alias to empty and honours an explicit value', () => {
  assert.equal(createWeapon({ name: 'X' }).alias, '');
  assert.equal(createWeapon({ name: 'X', alias: 'Lucky' }).alias, 'Lucky');
});

test('weaponDisplayName shows the base name, or "Alias (Name)" when aliased', () => {
  assert.equal(weaponDisplayName({ name: 'Ares Predator VI', alias: '' }), 'Ares Predator VI');
  assert.equal(weaponDisplayName({ name: 'Ares Predator VI' }), 'Ares Predator VI'); // alias absent (legacy)
  assert.equal(weaponDisplayName({ name: 'Ares Predator VI', alias: '  ' }), 'Ares Predator VI'); // blank ignored
  assert.equal(weaponDisplayName({ name: 'Ares Predator VI', alias: 'Old Faithful' }), 'Old Faithful (Ares Predator VI)');
});

test('createCharacter builds an empty character', () => {
  const c = createCharacter({ name: 'S4T0' });
  assert.equal(c.name, 'S4T0');
  assert.equal(c.realName, '');
  assert.deepEqual(c.weapons, []);
  assert.deepEqual(c.reserves, []);
  assert.deepEqual(c.drones, []);
});

test('createCharacter defaults magic to false and honours an explicit value', () => {
  assert.equal(createCharacter({ name: 'S4T0' }).magic, false);
  assert.equal(createCharacter({ name: 'Panda', magic: true }).magic, true);
});
