import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeaponCatalog, pickName, localizedName,
  catalogCategoryName, catalogTypeName, catalogWeaponList,
} from '../js/catalog.js';

const CAT = {
  weapons: {
    fn_har: { id: 'fn_har', name: 'FN HAR', nameDe: 'FN HAR', ammoCategory: 'ammo_rifles', magazineCapacity: 35, firingModes: ['SA', 'BF', 'FA'] },
    ares_predator_vi: { id: 'ares_predator_vi', name: 'Ares Predator VI', nameDe: 'Ares Predator VI', ammoCategory: 'ammo_heavy_smg', magazineCapacity: 15, firingModes: ['SA', 'BF'] },
  },
  ammoCategories: { ammo_rifles: { en: 'Rifles', de: 'Gewehr' } },
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
