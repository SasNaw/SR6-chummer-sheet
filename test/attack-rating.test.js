import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAttackRating } from '../js/catalog.js';
import { createWeapon, setAttackRating, backfillAttackRatings, createCharacter } from '../js/model.js';

// --- parseAttackRating: the Genesis `attack="10,9,8,,"` source format ---------
// Pinned against org.prelle.shadowrun6.persist.AttackRatingConverter, which
// allocates int[5], stores 0 for an empty band and -2 for the STRx2 sentinel.

test('parseAttackRating reads five numeric bands', () => {
  assert.deepEqual(parseAttackRating('5,11,7,5,1'), [5, 11, 7, 5, 1]);
});

test('parseAttackRating reads an empty band as 0', () => {
  assert.deepEqual(parseAttackRating('10,9,8,,'), [10, 9, 8, 0, 0]);
});

test('parseAttackRating pads a trailing-comma entry to five bands', () => {
  // Genesis: String.split drops trailing empties, leaving int[] defaults of 0.
  assert.deepEqual(parseAttackRating('8,10,6,'), [8, 10, 6, 0, 0]);
});

test('parseAttackRating maps the STRx2 sentinel to 0 rather than leaking -2', () => {
  assert.deepEqual(parseAttackRating('STRx2,,,,'), [0, 0, 0, 0, 0]);
});

test('parseAttackRating returns five zeros for missing or junk input', () => {
  assert.deepEqual(parseAttackRating(''), [0, 0, 0, 0, 0]);
  assert.deepEqual(parseAttackRating(null), [0, 0, 0, 0, 0]);
  assert.deepEqual(parseAttackRating(undefined), [0, 0, 0, 0, 0]);
});

test('parseAttackRating ignores extra bands beyond five', () => {
  assert.deepEqual(parseAttackRating('1,2,3,4,5,6,7'), [1, 2, 3, 4, 5]);
});

// --- createWeapon default -----------------------------------------------------

test('createWeapon defaults attackRating to five zeros', () => {
  assert.deepEqual(createWeapon({ name: 'Gun' }).attackRating, [0, 0, 0, 0, 0]);
});

test('createWeapon keeps a supplied attackRating', () => {
  assert.deepEqual(createWeapon({ name: 'Gun', attackRating: [9, 8, 7, 0, 0] }).attackRating, [9, 8, 7, 0, 0]);
});

test('createWeapon copies attackRating rather than aliasing the caller array', () => {
  const ar = [1, 2, 3, 4, 5];
  const w = createWeapon({ name: 'Gun', attackRating: ar });
  ar[0] = 99;
  assert.equal(w.attackRating[0], 1);
});

// --- setAttackRating ----------------------------------------------------------

test('setAttackRating returns a whole weapon with the new rating', () => {
  const w = createWeapon({ name: 'Gun', magazineCapacity: 10 });
  const next = setAttackRating(w, [10, 9, 8, 0, 0]);
  assert.deepEqual(next.attackRating, [10, 9, 8, 0, 0]);
  assert.equal(next.name, 'Gun');           // whole weapon, per updateWeapon's merge
  assert.equal(next.magazineCapacity, 10);
});

test('setAttackRating does not mutate the input weapon', () => {
  const w = createWeapon({ name: 'Gun' });
  setAttackRating(w, [1, 2, 3, 4, 5]);
  assert.deepEqual(w.attackRating, [0, 0, 0, 0, 0]);
});

test('setAttackRating normalizes blanks and junk to 0', () => {
  assert.deepEqual(setAttackRating(createWeapon({}), ['10', '', null, 'abc', undefined]).attackRating,
    [10, 0, 0, 0, 0]);
});

test('setAttackRating pads short and truncates long input to five bands', () => {
  assert.deepEqual(setAttackRating(createWeapon({}), [7, 6]).attackRating, [7, 6, 0, 0, 0]);
  assert.deepEqual(setAttackRating(createWeapon({}), [1, 2, 3, 4, 5, 6]).attackRating, [1, 2, 3, 4, 5]);
});

test('setAttackRating floors negatives to 0', () => {
  assert.deepEqual(setAttackRating(createWeapon({}), [-3, 5, 0, 0, 0]).attackRating, [0, 5, 0, 0, 0]);
});

// --- backfillAttackRatings ----------------------------------------------------

const CAT = {
  weapons: {
    fn_har: { id: 'fn_har', name: 'FN HAR', nameDe: 'FN HAR-Gewehr', attackRating: [5, 11, 7, 5, 1] },
    ares_predator_vi: { id: 'ares_predator_vi', name: 'Ares Predator VI', nameDe: null, attackRating: [10, 9, 8, 0, 0] },
  },
  ammoCategories: {},
  ammoTypes: {},
};

const charWith = (...weapons) => ({ ...createCharacter({ name: 'T' }), weapons });

test('backfillAttackRatings fills an unrated weapon from the catalog by ref', () => {
  const c = charWith(createWeapon({ name: 'Whatever', ref: 'fn_har' }));
  assert.deepEqual(backfillAttackRatings(c, CAT).weapons[0].attackRating, [5, 11, 7, 5, 1]);
});

test('backfillAttackRatings falls back to an exact name match when there is no ref', () => {
  const c = charWith(createWeapon({ name: 'Ares Predator VI' }));
  assert.deepEqual(backfillAttackRatings(c, CAT).weapons[0].attackRating, [10, 9, 8, 0, 0]);
});

test('backfillAttackRatings matches a localized catalog name too', () => {
  const c = charWith(createWeapon({ name: 'FN HAR-Gewehr' }));
  assert.deepEqual(backfillAttackRatings(c, CAT).weapons[0].attackRating, [5, 11, 7, 5, 1]);
});

test('backfillAttackRatings never clobbers a rating someone already set', () => {
  const c = charWith(createWeapon({ name: 'FN HAR', ref: 'fn_har', attackRating: [1, 1, 1, 1, 1] }));
  assert.deepEqual(backfillAttackRatings(c, CAT).weapons[0].attackRating, [1, 1, 1, 1, 1]);
});

test('backfillAttackRatings leaves a weapon the catalog does not know at zeros', () => {
  const c = charWith(createWeapon({ name: 'Homebrew Cannon' }));
  assert.deepEqual(backfillAttackRatings(c, CAT).weapons[0].attackRating, [0, 0, 0, 0, 0]);
});

test('backfillAttackRatings is a no-op without a catalog', () => {
  const c = charWith(createWeapon({ name: 'FN HAR', ref: 'fn_har' }));
  assert.deepEqual(backfillAttackRatings(c, null).weapons[0].attackRating, [0, 0, 0, 0, 0]);
});

test('backfillAttackRatings does not mutate the input character', () => {
  const w = createWeapon({ name: 'FN HAR', ref: 'fn_har' });
  const c = charWith(w);
  backfillAttackRatings(c, CAT);
  assert.deepEqual(w.attackRating, [0, 0, 0, 0, 0]);
});

test('backfillAttackRatings tolerates a weapon saved before the field existed', () => {
  const legacy = { ...createWeapon({ name: 'FN HAR', ref: 'fn_har' }) };
  delete legacy.attackRating;
  assert.deepEqual(backfillAttackRatings(charWith(legacy), CAT).weapons[0].attackRating, [5, 11, 7, 5, 1]);
});
