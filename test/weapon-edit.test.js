import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter, createWeapon, createReservePool, editWeapon,
  sanitizeArInput, parseArInput, formatArInput,
} from '../js/model.js';

// --- Attack-rating input rules -------------------------------------------------

test('sanitizeArInput keeps digits, and turns 0 / a dash into a dash', () => {
  assert.equal(sanitizeArInput('12'), '12');
  assert.equal(sanitizeArInput('1a2'), '12');
  assert.equal(sanitizeArInput('0'), '-');
  assert.equal(sanitizeArInput('00'), '-');
  assert.equal(sanitizeArInput('-'), '-');
  assert.equal(sanitizeArInput('–'), '-'); // en dash
  assert.equal(sanitizeArInput('—'), '-'); // em dash
  assert.equal(sanitizeArInput('-5'), '5'); // typing a digit over the dash replaces it
  assert.equal(sanitizeArInput('5-'), '-'); // typing a dash after digits clears to dash
  assert.equal(sanitizeArInput('07'), '7');
  assert.equal(sanitizeArInput(''), '');
});

test('parseArInput reads a dash, 0, blank or junk as 0 and digits as a number', () => {
  assert.equal(parseArInput('-'), 0);
  assert.equal(parseArInput('0'), 0);
  assert.equal(parseArInput(''), 0);
  assert.equal(parseArInput('x'), 0);
  assert.equal(parseArInput('9'), 9);
});

test('formatArInput shows 0 as a dash', () => {
  assert.equal(formatArInput(0), '-');
  assert.equal(formatArInput(undefined), '-');
  assert.equal(formatArInput(11), '11');
});

// --- editWeapon -----------------------------------------------------------------

function charWith(weapon, reserves = []) {
  return createCharacter({ name: 'T', weapons: [weapon], reserves });
}
const rifle = (over = {}) => createWeapon({
  id: 'w', name: 'FN HAR', ammoCategory: 'ammo_rifles', magazineCapacity: 20,
  loaded: { ammoType: 'apds', count: 15 }, firingModes: [{ mode: 'SA', rounds: 2 }], ...over,
});

test('editWeapon applies name, alias, attack rating and firing modes', () => {
  const c = editWeapon(charWith(rifle()), 'w', {
    name: 'FN HAR Custom', alias: 'Harry', attackRating: [5, '9', 0, -1, 'x'],
    firingModes: [{ mode: 'BF', rounds: 4 }, { mode: 'FA', rounds: 10 }],
  });
  const w = c.weapons[0];
  assert.equal(w.name, 'FN HAR Custom');
  assert.equal(w.alias, 'Harry');
  assert.deepEqual(w.attackRating, [5, 9, 0, 0, 0]);
  assert.deepEqual(w.firingModes.map((m) => m.mode), ['BF', 'FA']);
  assert.deepEqual(w.loaded, { ammoType: 'apds', count: 15 }); // ammo untouched
});

test('editWeapon: lowering capacity below the loaded count returns the excess to its pool', () => {
  const pool = createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'apds', count: 30 });
  const c = editWeapon(charWith(rifle(), [pool]), 'w', { magazineCapacity: 10 });
  assert.equal(c.weapons[0].magazineCapacity, 10);
  assert.equal(c.weapons[0].loaded.count, 10);
  assert.equal(c.reserves[0].count, 35);
});

test('editWeapon: excess rounds create their pool when none exists', () => {
  const c = editWeapon(charWith(rifle()), 'w', { magazineCapacity: 12 });
  assert.deepEqual(c.reserves, [{ ammoCategory: 'ammo_rifles', ammoType: 'apds', count: 3 }]);
});

test('editWeapon: raising capacity leaves the loaded rounds alone', () => {
  const c = editWeapon(charWith(rifle()), 'w', { magazineCapacity: 30 });
  assert.equal(c.weapons[0].loaded.count, 15);
  assert.deepEqual(c.reserves, []);
});

test('editWeapon: changing the weapon type unloads into the old pool and picks a new-type ammo', () => {
  const pools = [
    createReservePool({ ammoCategory: 'ammo_rifles', ammoType: 'apds', count: 5 }),
    createReservePool({ ammoCategory: 'ammo_pistols_heavy', ammoType: 'explosive', count: 8 }),
  ];
  const c = editWeapon(charWith(rifle(), pools), 'w', { ammoCategory: 'ammo_pistols_heavy', magazineCapacity: 10 });
  assert.equal(c.weapons[0].ammoCategory, 'ammo_pistols_heavy');
  assert.deepEqual(c.weapons[0].loaded, { ammoType: 'explosive', count: 0 });
  assert.equal(c.reserves[0].count, 20); // 5 + 15 returned
  assert.equal(c.reserves[1].count, 8);  // new pool untouched (magazine left empty)
});

test('editWeapon: changing the type with no matching reserve defaults to regular', () => {
  const c = editWeapon(charWith(rifle({ loaded: { ammoType: 'apds', count: 0 } })), 'w', { ammoCategory: 'ammo_shotguns' });
  assert.deepEqual(c.weapons[0].loaded, { ammoType: 'regular', count: 0 });
  assert.deepEqual(c.reserves, []); // nothing was loaded, so no pool is created
});

test('editWeapon is a no-op for an unknown id and never mutates its input', () => {
  const before = charWith(rifle());
  const snapshot = JSON.stringify(before);
  assert.equal(editWeapon(before, 'nope', { name: 'X' }), before);
  editWeapon(before, 'w', { magazineCapacity: 1, ammoCategory: 'ammo_shotguns' });
  assert.equal(JSON.stringify(before), snapshot);
});
