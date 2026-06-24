import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRING_MODE_ROUNDS, STANDARD_FIRING_MODES, expandFiringModes, modeLabel,
} from '../js/firing-modes.js';

test('canonical round costs', () => {
  assert.deepEqual(FIRING_MODE_ROUNDS, { SS: 1, SA: 2, BF: 4, FA: 10 });
  assert.deepEqual(STANDARD_FIRING_MODES, [
    { mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 2 },
    { mode: 'BF', rounds: 4 }, { mode: 'FA', rounds: 10 },
  ]);
});

test('expandFiringModes adds SS whenever SA is present, ordered with canonical rounds', () => {
  assert.deepEqual(expandFiringModes([{ mode: 'SA' }, { mode: 'BF' }]),
    [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 2 }, { mode: 'BF', rounds: 4 }]);
  // accepts plain code strings too
  assert.deepEqual(expandFiringModes(['FA', 'SA']),
    [{ mode: 'SS', rounds: 1 }, { mode: 'SA', rounds: 2 }, { mode: 'FA', rounds: 10 }]);
});

test('expandFiringModes does not add SS without SA, dedupes, and tolerates empty', () => {
  assert.deepEqual(expandFiringModes([{ mode: 'FA' }]), [{ mode: 'FA', rounds: 10 }]);
  assert.deepEqual(expandFiringModes([{ mode: 'SS' }]), [{ mode: 'SS', rounds: 1 }]);
  assert.deepEqual(expandFiringModes(['BF', 'BF']), [{ mode: 'BF', rounds: 4 }]);
  assert.deepEqual(expandFiringModes([]), []);
  assert.deepEqual(expandFiringModes(undefined), []);
});

test('modeLabel localizes German (EM/HM/SM/AM), English keeps the codes', () => {
  assert.equal(modeLabel('SS', 'de'), 'EM');
  assert.equal(modeLabel('SA', 'de'), 'HM');
  assert.equal(modeLabel('BF', 'de'), 'SM');
  assert.equal(modeLabel('FA', 'de'), 'AM');
  assert.equal(modeLabel('BF', 'en'), 'BF');
  assert.equal(modeLabel('SS', 'xx'), 'SS'); // unknown lang -> English
});
