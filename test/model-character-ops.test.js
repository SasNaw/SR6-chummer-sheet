import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter, createWeapon,
  addWeapon, updateWeapon, removeWeapon, upsertCharacter,
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
