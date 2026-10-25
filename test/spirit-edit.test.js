import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, addSpirit, spiritFromCatalog, editSpirit } from '../js/model.js';

// Made-up catalog entries (shape of data-local/spirits-catalog.json).
const FIRE = {
  id: 'spirit_of_fire', name: { en: 'Spirit of Fire', de: 'Feuergeist' },
  attributes: { body: 1, agility: 2 }, conditionMonitor: 9,
  initiative: '+2D6', astralInitiative: '+3D6', actions: '1 Major, 3 Minor', movement: '5 / 10, +5/hit',
  skills: [{ en: 'Astral', de: 'Astral' }], powers: [{ en: 'Astral Form', de: 'astr. Gestalt' }],
  optionalPowers: [{ en: 'Guard', de: 'Schutz' }, { en: 'Fear', de: 'Furcht' }],
  weaknesses: [{ en: 'Allergy (water)', de: 'Allergie (Wasser)' }],
};
const EARTH = {
  ...FIRE, id: 'spirit_of_earth', name: { en: 'Spirit of Earth', de: 'Erdgeist' },
  attributes: { body: 4, agility: -2 }, optionalPowers: [{ en: 'Engulf', de: 'Verschlingen' }],
};

test('spiritFromCatalog snapshots the entry plus the chosen name, Force, services and powers', () => {
  const s = spiritFromCatalog(FIRE, { id: 's1', name: 'Ifrit', force: 6, services: 3, optionalPowers: [FIRE.optionalPowers[1]] });
  assert.equal(s.id, 's1');
  assert.equal(s.type, 'spirit_of_fire');
  assert.deepEqual(s.typeName, FIRE.name);
  assert.equal(s.force, 6);
  assert.equal(s.services, 3);
  assert.deepEqual(s.attributes, { body: 1, agility: 2 });
  assert.equal(s.movement, '5 / 10, +5/hit');
  assert.deepEqual(s.optionalPowers, [{ en: 'Fear', de: 'Furcht' }]);
  assert.deepEqual(s.weaknesses, FIRE.weaknesses);
  assert.notEqual(s.attributes, FIRE.attributes); // copied
});

test('spiritFromCatalog clamps Force to at least 1 and services to at least 0', () => {
  const s = spiritFromCatalog(FIRE, { force: 0, services: -2 });
  assert.equal(s.force, 1);
  assert.equal(s.services, 0);
  assert.equal(s.name, '');
  assert.deepEqual(s.optionalPowers, []);
});

function withSpirit() {
  const s = spiritFromCatalog(FIRE, { id: 's1', name: 'Ifrit', force: 6, services: 3, optionalPowers: [FIRE.optionalPowers[0]] });
  return addSpirit(createCharacter({ name: 'T' }), s);
}

test('editSpirit, same type: updates name, Force, services and powers, keeps the snapshot', () => {
  const before = withSpirit();
  before.spirits[0].attributes.body = 99; // a snapshot that no longer matches the catalog
  const c = editSpirit(before, 's1', {
    name: 'Blaze', force: 4, services: 1, optionalPowers: [FIRE.optionalPowers[1]], entry: FIRE,
  });
  const s = c.spirits[0];
  assert.equal(s.id, 's1');
  assert.equal(s.name, 'Blaze');
  assert.equal(s.force, 4);
  assert.equal(s.services, 1);
  assert.deepEqual(s.optionalPowers, [{ en: 'Fear', de: 'Furcht' }]);
  assert.equal(s.attributes.body, 99); // untouched
});

test('editSpirit, same type without a catalog entry works too', () => {
  const c = editSpirit(withSpirit(), 's1', { name: 'Blaze', force: 5, services: 2, optionalPowers: [] });
  assert.equal(c.spirits[0].force, 5);
  assert.equal(c.spirits[0].type, 'spirit_of_fire');
});

test('editSpirit, new type: re-snapshots from the new entry and keeps the id', () => {
  const c = editSpirit(withSpirit(), 's1', {
    name: 'Rocky', force: 5, services: 2, optionalPowers: [EARTH.optionalPowers[0]], entry: EARTH,
  });
  const s = c.spirits[0];
  assert.equal(s.id, 's1');
  assert.equal(s.type, 'spirit_of_earth');
  assert.deepEqual(s.typeName, EARTH.name);
  assert.deepEqual(s.attributes, EARTH.attributes);
  assert.deepEqual(s.optionalPowers, [{ en: 'Engulf', de: 'Verschlingen' }]);
  assert.equal(s.name, 'Rocky');
});

test('editSpirit is a no-op for an unknown id and does not mutate its input', () => {
  const before = withSpirit();
  const snap = JSON.stringify(before);
  assert.equal(editSpirit(before, 'nope', { name: 'x', force: 1, services: 0, optionalPowers: [] }), before);
  editSpirit(before, 's1', { name: 'x', force: 2, services: 0, optionalPowers: [], entry: EARTH });
  assert.equal(JSON.stringify(before), snap);
});
