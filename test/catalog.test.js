import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeaponCatalog, pickName, localizedName,
  catalogCategoryName, catalogTypeName, catalogWeaponList,
  parseAttackRatingMod, moddedAttackRating,
} from '../js/catalog.js';

const CAT = {
  weapons: {
    fn_har: { id: 'fn_har', name: 'FN HAR', nameDe: 'FN HAR', ammoCategory: 'ammo_rifles', magazineCapacity: 35, firingModes: ['SA', 'BF', 'FA'] },
    ares_predator_vi: { id: 'ares_predator_vi', name: 'Ares Predator VI', nameDe: 'Ares Predator VI', ammoCategory: 'ammo_heavy_smg', magazineCapacity: 15, firingModes: ['SA', 'BF'] },
  },
  ammoCategories: { ammo_rifles: { en: 'Rifles (10x)', de: 'Gewehr (10x)' } },
  ammoTypes: { apds: { en: 'APDS', de: 'APDS-Munition' }, regular: { en: 'Regular', de: null } },
};

test('isWeaponCatalog validates shape', () => {
  assert.equal(isWeaponCatalog(CAT), true);
  assert.equal(isWeaponCatalog({}), false);
  assert.equal(isWeaponCatalog(null), false);
});

test('pickName returns localized weapon name with English fallback', () => {
  assert.equal(pickName({ name: 'Gun', nameDe: 'Knarre' }, 'de'), 'Knarre');
  assert.equal(pickName({ name: 'Gun', nameDe: null }, 'de'), 'Gun'); // no DE -> EN
  assert.equal(pickName({ name: 'Gun', nameDe: 'Knarre' }, 'en'), 'Gun');
});

test('localized category/type names fall back to English when DE missing', () => {
  assert.equal(catalogCategoryName(CAT, 'ammo_rifles', 'de'), 'Gewehr');
  assert.equal(catalogCategoryName(CAT, 'ammo_rifles', 'en'), 'Rifles');
  assert.equal(catalogTypeName(CAT, 'regular', 'de'), 'Regular'); // de is null -> en
  assert.equal(catalogTypeName(CAT, 'unknown', 'de'), null);
  assert.equal(localizedName(CAT.ammoTypes, 'apds', 'de'), 'APDS-Munition');
});

test('catalogWeaponList yields labelled, sorted entries', () => {
  const list = catalogWeaponList(CAT, 'en');
  assert.deepEqual(list.map((w) => w.label), ['Ares Predator VI', 'FN HAR']);
  assert.equal(list[0].magazineCapacity, 15);
  assert.deepEqual(catalogWeaponList(null, 'en'), []);
});

test('parseAttackRatingMod: a flat val applies to every band; objVal is per band, signed, blank = 0', () => {
  assert.deepEqual(parseAttackRatingMod({ val: '2' }), [2, 2, 2, 2, 2]);
  assert.deepEqual(parseAttackRatingMod({ objVal: '-2,,+1,+2,+1' }), [-2, 0, 1, 2, 1]);
  assert.deepEqual(parseAttackRatingMod({ objVal: '1,1,,,' }), [1, 1, 0, 0, 0]);
  assert.equal(parseAttackRatingMod({}), null);
});

// Made-up effects, keyed like the sr6char condition ids (item.* / itemmod.*).
const MODS = {
  'item.laser_sight': [{ ar: [1, 1, 1, 1, 1], cond: null }],
  'itemmod.smartgun_system_internal': [{ ar: [2, 2, 2, 2, 2], cond: 1 }, { ar: [1, 1, 1, 1, 1], cond: 2 }],
  'item.choke': [{ ar: [-2, 0, 1, 2, 1], cond: null }],
  'item.laser_sight_standard': [{ ar: [1, 1, 1, 0, 0], cond: null }],
};

test('moddedAttackRating: unconditional effects always apply; conditional ones only when active', () => {
  const base = [10, 10, 8, 0, 0];
  assert.deepEqual(moddedAttackRating(base, ['item.laser_sight'], [], MODS), [11, 11, 9, 0, 0]);
  assert.deepEqual(moddedAttackRating(base, ['itemmod.smartgun_system_internal'], [], MODS), base);
  assert.deepEqual(
    moddedAttackRating(base, ['itemmod.smartgun_system_internal'], ['itemmod.smartgun_system_internal.cond.1'], MODS),
    [12, 12, 10, 0, 0]);
});

test('moddedAttackRating: empty bands stay empty, a band never drops below 1, unknown and repeated mods are ignored', () => {
  assert.deepEqual(moddedAttackRating([1, 5, 0, 0, 0], ['item.choke'], [], MODS), [1, 5, 0, 0, 0]);
  assert.deepEqual(moddedAttackRating([5, 5, 5, 0, 0], ['item.laser_sight', 'item.laser_sight', 'item.unknown'], [], MODS), [6, 6, 6, 0, 0]);
  assert.deepEqual(moddedAttackRating([5, 5, 5, 0, 0], ['item.laser_sight'], [], undefined), [5, 5, 5, 0, 0]);
});

test('moddedAttackRating: laser sights and smartguns do not stack beyond the largest single aiming bonus', () => {
  const base = [3, 11, 10, 6, 1];
  const smart = 'itemmod.smartgun_system_internal';
  // Laser +1 and smartgun "without laser" +2: the smartgun's 2, not 3.
  assert.deepEqual(moddedAttackRating(base, ['item.laser_sight', smart], [`${smart}.cond.1`], MODS), [5, 13, 12, 8, 3]);
  // Laser +1 and smartgun "with laser" +1: together 2, the cap.
  assert.deepEqual(moddedAttackRating(base, ['item.laser_sight', smart], [`${smart}.cond.2`], MODS), [5, 13, 12, 8, 3]);
  // Laser alone, or a smartgun with no condition ticked: just the laser.
  assert.deepEqual(moddedAttackRating(base, ['item.laser_sight', smart], [], MODS), [4, 12, 11, 7, 2]);
  // Two lasers: still +1; a shorter-ranged one on its own only covers its bands.
  assert.deepEqual(moddedAttackRating(base, ['item.laser_sight', 'item.laser_sight_standard'], [], MODS), [4, 12, 11, 7, 2]);
  assert.deepEqual(moddedAttackRating(base, ['item.laser_sight_standard'], [], MODS), [4, 12, 11, 6, 1]);
  // Other mods still add on top.
  assert.deepEqual(moddedAttackRating(base, ['item.laser_sight', smart, 'item.choke'], [`${smart}.cond.1`], MODS), [3, 13, 13, 10, 4]);
});
