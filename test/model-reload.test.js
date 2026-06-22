import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter, createWeapon, createReservePool,
  matchingReserves, reload, addReserve, setReserveCount, removeReserve,
} from '../js/model.js';

function setup(reserves, loaded = { ammoType: 'regular', count: 7 }) {
  const weapon = createWeapon({ id: 'w1', name: 'FN HAR', magazineCapacity: 20, ammoCategory: 'ammo_rifles', loaded });
  return createCharacter({ name: 'T', weapons: [weapon], reserves });
}

test('matchingReserves filters by ammoCategory', () => {
  const c = setup([
    createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 29 }),
    createReservePool({ ammoCategory: 'ammo_shotgun', ammoType: 'regular', count: 6 }),
  ]);
  assert.equal(matchingReserves(c, 'w1').length, 1);
  assert.equal(matchingReserves(c, 'w1')[0].ammoCategory, 'ammo_rifles');
});

test('reload tops off the magazine from the matching pool', () => {
  const c = reload(setup([createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 29 })]), 'w1', 'regular');
  assert.equal(c.weapons[0].loaded.count, 20);
  assert.equal(c.reserves[0].count, 16); // 29 - (20-7)
});

test('reload is partial when the reserve is low', () => {
  const c = reload(setup([createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 5 })]), 'w1', 'regular');
  assert.equal(c.weapons[0].loaded.count, 12); // 7 + 5
  assert.equal(c.reserves[0].count, 0);
});

test('switching ammo type returns leftover rounds to reserve', () => {
  const c = reload(setup([
    createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 0 }),
    createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'APDS', count: 30 }),
  ]), 'w1', 'APDS');
  assert.equal(c.weapons[0].loaded.ammoType, 'APDS');
  assert.equal(c.weapons[0].loaded.count, 20);
  const regular = c.reserves.find((r) => r.ammoType === 'regular');
  const apds = c.reserves.find((r) => r.ammoType === 'APDS');
  assert.equal(regular.count, 7);  // 7 leftover returned
  assert.equal(apds.count, 10);    // 30 - 20
});

test('switching type creates a return pool when none exists', () => {
  const c = reload(setup([createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'APDS', count: 30 })]), 'w1', 'APDS');
  assert.ok(c.reserves.find((r) => r.ammoType === 'regular' && r.count === 7));
});

test('reload with no matching pool is a no-op', () => {
  const c0 = setup([createReservePool({ ammoCategory: 'ammo_shotgun', ammoType: 'regular', count: 6 })]);
  assert.deepEqual(reload(c0, 'w1', 'regular'), c0);
});

test('addReserve sums counts for an existing (category,type)', () => {
  let c = setup([]);
  c = addReserve(c, createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 10 }));
  c = addReserve(c, createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 5 }));
  assert.equal(c.reserves.length, 1);
  assert.equal(c.reserves[0].count, 15);
});

test('setReserveCount and removeReserve manage pools', () => {
  let c = setup([createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 10 })]);
  c = setReserveCount(c, 'ammo_rifles', 'regular', 3);
  assert.equal(c.reserves[0].count, 3);
  c = removeReserve(c, 'ammo_rifles', 'regular');
  assert.equal(c.reserves.length, 0);
});
