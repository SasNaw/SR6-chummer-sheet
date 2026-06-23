import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, STRINGS } from '../js/i18n.js';

test('translate resolves per language', () => {
  assert.equal(translate('en', 'weapons'), 'Weapons');
  assert.equal(translate('de', 'weapons'), 'Waffen');
  assert.equal(translate('en', 'reserveAmmo'), 'Reserve ammo');
  assert.equal(translate('de', 'reserveAmmo'), 'Reservemunition');
});

test('translate handles parameterised strings', () => {
  assert.equal(translate('en', 'removeWeaponConfirm', 'Pistol'), 'Remove Pistol?');
  assert.equal(translate('de', 'deleteDroneConfirm', 'R.E.X.', 2), 'Drohne "R.E.X." und ihre 2 Waffe(n) löschen?');
  assert.equal(translate('de', 'deleteDroneConfirm', 'R.E.X.', 0), 'Drohne "R.E.X." löschen?');
});

test('translate falls back to English then to the key', () => {
  // Every German key should exist; if one were missing it must fall back to EN.
  assert.equal(translate('de', 'totally_unknown_key'), 'totally_unknown_key');
  assert.equal(translate('xx', 'weapons'), 'Weapons'); // unknown language -> English table
});

test('German table covers every English key', () => {
  const missing = Object.keys(STRINGS.en).filter((k) => !(k in STRINGS.de));
  assert.deepEqual(missing, [], `German is missing keys: ${missing.join(', ')}`);
});
