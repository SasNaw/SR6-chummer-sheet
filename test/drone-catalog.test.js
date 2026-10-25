import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDroneCatalog, droneEntry } from '../js/drone-catalog.js';

const CAT = { drones: { gnat: { id: 'gnat', name: { en: 'Gnat', de: null }, stats: { body: 0 } } } };

test('isDroneCatalog validates shape', () => {
  assert.equal(isDroneCatalog(CAT), true);
  assert.equal(isDroneCatalog({ drones: {} }), false); // empty is not usable
  assert.equal(isDroneCatalog({ weapons: {} }), false);
  assert.equal(isDroneCatalog(null), false);
});

test('droneEntry looks up by ref', () => {
  assert.equal(droneEntry(CAT, 'gnat').name.en, 'Gnat');
  assert.equal(droneEntry(CAT, 'nope'), null);
  assert.equal(droneEntry(null, 'gnat'), null);
  assert.equal(droneEntry(CAT, null), null);
});
