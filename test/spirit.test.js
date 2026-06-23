import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpirit, addSpirit, updateSpirit, removeSpirit,
  spiritAttributeValues, spiritConditionMonitor, optionalPowerCap, createCharacter,
} from '../js/model.js';

const fireProps = {
  name: 'Ifrit', type: 'spirit_of_fire', typeName: { en: 'Spirits of Fire', de: 'Feuergeister' },
  force: 6,
  attributes: { body: 1, agility: 2, reaction: 3, strength: -2, willpower: 0, logic: -1, intuition: 1, charisma: 0, magic: 0, essence: 0 },
  conditionMonitor: '(Force ÷ 2) + 8',
  powers: [{ en: 'Astral Form', de: 'astr. Gestalt' }],
  optionalPowers: [{ en: 'Guard', de: 'Schutz' }],
  skills: [{ en: 'Astral', de: 'Astral' }],
  weaknesses: [{ en: 'Allergy (cold, severe)', de: 'Allergie (Kälte, schwer)' }],
};

test('createSpirit assigns an id and sane defaults', () => {
  const s = createSpirit({ type: 'spirit_of_air' });
  assert.match(s.id, /^[0-9a-f-]{36}$/);
  assert.equal(s.name, '');
  assert.equal(s.services, 0);
  assert.equal(s.force, 0);
  assert.deepEqual(s.skills, []);
  assert.deepEqual(s.optionalPowers, []);
});

test('createSpirit honours an explicit id and copies its pair lists', () => {
  const s = createSpirit({ id: 'fixed', ...fireProps });
  assert.equal(s.id, 'fixed');
  assert.equal(s.services, 0);
  // arrays/objects are copied, not shared
  assert.notEqual(s.powers, fireProps.powers);
  assert.notEqual(s.attributes, fireProps.attributes);
  assert.deepEqual(s.powers, fireProps.powers);
});

test('addSpirit / removeSpirit / updateSpirit operate by id', () => {
  const c0 = createCharacter({ name: 'Panda', magic: true });
  const s = createSpirit({ id: 's1', ...fireProps });
  const c1 = addSpirit(c0, s);
  assert.equal(c1.spirits.length, 1);
  assert.notEqual(c1.spirits[0], s); // stored copy, not the same ref

  const c2 = updateSpirit(c1, 's1', { services: 3 });
  assert.equal(c2.spirits[0].services, 3);
  assert.equal(c1.spirits[0].services, 0); // original untouched

  const c3 = updateSpirit(c2, 'missing', { services: 9 });
  assert.deepEqual(c3.spirits, c2.spirits); // no-op on unknown id

  const c4 = removeSpirit(c2, 's1');
  assert.deepEqual(c4.spirits, []);
  assert.deepEqual(removeSpirit(c2, 'missing').spirits, c2.spirits); // no-op
});

test('spiritAttributeValues = Force + offset, floored at 1', () => {
  const fire6 = createSpirit({ ...fireProps, force: 6 });
  const v = spiritAttributeValues(fire6);
  assert.equal(v.body, 7);      // 6 + 1
  assert.equal(v.strength, 4);  // 6 - 2
  assert.equal(v.magic, 6);     // 6 + 0
  // air strength offset -3 at Force 2 floors at 1
  const air2 = createSpirit({ type: 'spirit_of_air', force: 2, attributes: { strength: -3 } });
  assert.equal(spiritAttributeValues(air2).strength, 1);
});

test('spiritConditionMonitor = 8 + ceil(Force / 2)', () => {
  assert.equal(spiritConditionMonitor(createSpirit({ force: 6 })), 11);
  assert.equal(spiritConditionMonitor(createSpirit({ force: 1 })), 9);
  assert.equal(spiritConditionMonitor(createSpirit({ force: 4 })), 10);
});

test('optionalPowerCap = floor(Force / 3)', () => {
  assert.equal(optionalPowerCap(2), 0);
  assert.equal(optionalPowerCap(3), 1);
  assert.equal(optionalPowerCap(6), 2);
  assert.equal(optionalPowerCap(9), 3);
});

test('createCharacter starts with an empty spirits list', () => {
  assert.deepEqual(createCharacter({ name: 'X' }).spirits, []);
});
