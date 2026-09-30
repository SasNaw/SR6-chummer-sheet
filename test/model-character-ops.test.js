import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter, createWeapon,
  addWeapon, updateWeapon, removeWeapon, upsertCharacter,
  addDrone, removeDrone, createDrone, normalizeDrone,
} from '../js/model.js';

test('addWeapon / updateWeapon / removeWeapon', () => {
  let c = createCharacter({ name: 'T' });
  const w = createWeapon({ id: 'w1', name: 'Pistol', magazineCapacity: 15 });
  c = addWeapon(c, w);
  assert.equal(c.weapons.length, 1);
  c = updateWeapon(c, 'w1', { magazineCapacity: 18, notes: 'smartlink' });
  assert.equal(c.weapons[0].magazineCapacity, 18);
  assert.equal(c.weapons[0].notes, 'smartlink');
  c = removeWeapon(c, 'w1');
  assert.equal(c.weapons.length, 0);
});

test('updateWeapon and removeWeapon no-op on a non-existent id', () => {
  let c = createCharacter({ name: 'T' });
  c = addWeapon(c, createWeapon({ id: 'w1', name: 'Pistol', magazineCapacity: 15 }));
  const afterUpdate = updateWeapon(c, 'no-such-id', { magazineCapacity: 99 });
  assert.deepEqual(afterUpdate.weapons, c.weapons);
  const afterRemove = removeWeapon(c, 'no-such-id');
  assert.equal(afterRemove.weapons.length, c.weapons.length);
});

test('addDrone appends a drone by name and dedupes', () => {
  let c = createCharacter({ name: 'T' });
  c = addDrone(c, 'R.E.X.');
  c = addDrone(c, 'Gremlin');
  c = addDrone(c, 'R.E.X.'); // duplicate ignored
  assert.deepEqual(c.drones.map((d) => d.name), ['R.E.X.', 'Gremlin']);
  assert.equal(c.drones[0].stats, null); // hand-added drones carry no stats
  assert.equal(c.drones[0].count, 1);
  assert.equal(addDrone(c, ''), c); // empty name is a no-op (same reference)
});

test('addDrone accepts a full drone object', () => {
  const d = createDrone({ name: 'Gremlin', ref: 'x', stats: { body: 5 } });
  const c = addDrone(createCharacter({ name: 'T' }), d);
  assert.equal(c.drones[0].id, d.id);
  assert.deepEqual(c.drones[0].stats, { body: 5 });
  assert.equal(addDrone(c, createDrone({ name: 'Gremlin' })), c); // same name -> no-op
});

test('createDrone copies stats and defaults the rest', () => {
  const stats = { handling: '3/5', body: 12 };
  const d = createDrone({ id: 'd1', name: 'R.E.X.', ref: 'steel_lynx_combat_drone', count: 2, stats });
  assert.deepEqual(d, {
    id: 'd1', name: 'R.E.X.', ref: 'steel_lynx_combat_drone', typeName: null,
    size: null, subtype: null, count: 2, stats: { handling: '3/5', body: 12 },
  });
  assert.notEqual(d.stats, stats); // copied, not shared
});

test('normalizeDrone turns a legacy name string into a drone object', () => {
  const d = normalizeDrone('R.E.X.');
  assert.equal(d.name, 'R.E.X.');
  assert.equal(d.stats, null);
  assert.equal(typeof d.id, 'string');
  const obj = createDrone({ name: 'X' });
  assert.equal(normalizeDrone(obj), obj); // objects pass through
});

test('createCharacter migrates legacy string drones', () => {
  const c = createCharacter({ name: 'T', drones: ['R.E.X.'] });
  assert.equal(c.drones[0].name, 'R.E.X.');
});

test('removeDrone removes the drone and its mounted weapons', () => {
  let c = createCharacter({ name: 'T', drones: ['R.E.X.'] });
  c = addWeapon(c, createWeapon({ id: 'd1', name: 'Roomsweeper', mount: 'R.E.X.' }));
  c = addWeapon(c, createWeapon({ id: 'c1', name: 'Predator', mount: 'carried' }));
  c = removeDrone(c, 'R.E.X.');
  assert.deepEqual(c.drones, []);
  assert.equal(c.weapons.length, 1);
  assert.equal(c.weapons[0].id, 'c1'); // carried weapon untouched
});

test('upsertCharacter replaces by id or appends', () => {
  const a = createCharacter({ id: 'a', name: 'A' });
  const b = createCharacter({ id: 'b', name: 'B' });
  let list = upsertCharacter([], a);
  list = upsertCharacter(list, b);
  assert.equal(list.length, 2);
  list = upsertCharacter(list, { ...a, name: 'A2' });
  assert.equal(list.length, 2);
  assert.equal(list.find((c) => c.id === 'a').name, 'A2');
});
