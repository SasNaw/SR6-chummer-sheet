import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prettifyRef, clamp, newId } from '../js/util.js';

test('prettifyRef turns refs into human-readable names', () => {
  assert.equal(prettifyRef('ares_predator_vi'), 'Ares Predator Vi');
  assert.equal(prettifyRef('mct-nissan_roto_drone'), 'Mct Nissan Roto Drone');
  assert.equal(prettifyRef(''), '');
});

test('clamp constrains a number to a range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

test('newId returns unique uuid-shaped strings', () => {
  const a = newId();
  const b = newId();
  assert.match(a, /^[0-9a-f-]{36}$/);
  assert.notEqual(a, b);
});
