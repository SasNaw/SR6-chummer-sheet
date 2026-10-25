import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter, addSpirit, createSpirit, damageAfterBoxClick, setSpiritDamage, editSpirit,
  spiritConditionMonitor,
} from '../js/model.js';

// Boxes are numbered 1..n from the left; damage d means boxes 1..d are filled.

test('damageAfterBoxClick: an empty box fills it and everything to its left', () => {
  assert.equal(damageAfterBoxClick(0, 1), 1);
  assert.equal(damageAfterBoxClick(0, 5), 5);
  assert.equal(damageAfterBoxClick(2, 7), 7);
});

test('damageAfterBoxClick: a filled box empties it and everything to its right', () => {
  assert.equal(damageAfterBoxClick(5, 5), 4); // rightmost filled box -> one less
  assert.equal(damageAfterBoxClick(5, 2), 1);
  assert.equal(damageAfterBoxClick(5, 1), 0);
});

test('createSpirit defaults damage to 0 and keeps a given value', () => {
  assert.equal(createSpirit({ force: 3 }).damage, 0);
  assert.equal(createSpirit({ force: 3, damage: 4 }).damage, 4);
});

function withSpirit(force, damage) {
  return addSpirit(createCharacter({ name: 'T' }), createSpirit({ id: 's', type: 'x', force, damage }));
}

test('setSpiritDamage stores the value, clamped to 0..condition monitor', () => {
  const cm = spiritConditionMonitor({ force: 6 }); // 11
  assert.equal(setSpiritDamage(withSpirit(6, 0), 's', 4).spirits[0].damage, 4);
  assert.equal(setSpiritDamage(withSpirit(6, 0), 's', 99).spirits[0].damage, cm);
  assert.equal(setSpiritDamage(withSpirit(6, 3), 's', -1).spirits[0].damage, 0);
  const c = withSpirit(6, 0);
  assert.equal(setSpiritDamage(c, 'nope', 3), c);
});

test('editSpirit caps damage when a lower Force shrinks the condition monitor', () => {
  const c = editSpirit(withSpirit(6, 11), 's', { name: '', force: 1, services: 0, optionalPowers: [] }); // CM 9
  assert.equal(c.spirits[0].damage, 9);
  const kept = editSpirit(withSpirit(6, 5), 's', { name: '', force: 2, services: 0, optionalPowers: [] });
  assert.equal(kept.spirits[0].damage, 5);
});

test('a spirit saved without damage reads as undamaged', () => {
  const legacy = addSpirit(createCharacter({ name: 'T' }), { id: 's', type: 'x', force: 4 });
  assert.equal(setSpiritDamage(legacy, 's', 2).spirits[0].damage, 2);
});
