import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeapon, fire, spend, addRounds, setLoaded } from '../js/model.js';

function har() {
  return createWeapon({
    name: 'FN HAR', magazineCapacity: 20,
    firingModes: [{ mode: 'SA', rounds: 2 }, { mode: 'BF', rounds: 4 }, { mode: 'FA', rounds: 10 }],
    loaded: { ammoType: 'regular', count: 20 },
  });
}

test('fire subtracts the canonical mode round cost', () => {
  assert.equal(fire(har(), 'BF').loaded.count, 16); // 20 - 4
  assert.equal(fire(har(), 'FA').loaded.count, 10); // 20 - 10
});

test('fire floors at zero, never negative', () => {
  const low = createWeapon({ magazineCapacity: 20, firingModes: [{ mode: 'FA', rounds: 10 }], loaded: { ammoType: 'regular', count: 2 } });
  assert.equal(fire(low, 'FA').loaded.count, 0);
});

test('fire throws on an unsupported mode', () => {
  assert.throws(() => fire(har(), 'BF2'), /mode/i);
});

test('fire does not mutate the input weapon', () => {
  const w = har();
  fire(w, 'BF');
  assert.equal(w.loaded.count, 20);
});

test('spend and addRounds clamp to [0, capacity]', () => {
  assert.equal(spend(har(), 5).loaded.count, 15);
  assert.equal(spend(har(), 999).loaded.count, 0);
  const empty = setLoaded(har(), 0);
  assert.equal(addRounds(empty, 3).loaded.count, 3);
  assert.equal(addRounds(har(), 5).loaded.count, 20);
});

test('setLoaded clamps to capacity', () => {
  assert.equal(setLoaded(har(), 7).loaded.count, 7);
  assert.equal(setLoaded(har(), 99).loaded.count, 20);
  assert.equal(setLoaded(har(), -4).loaded.count, 0);
});
