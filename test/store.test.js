import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, serialize, deserialize, mergeState } from '../js/store.js';

test('serialize/deserialize round-trips state', () => {
  const s = { version: 1, characters: [{ id: 'a', name: 'A', realName: '', weapons: [], reserves: [] }], activeId: 'a' };
  assert.deepEqual(deserialize(serialize(s)), s);
});

test('deserialize is tolerant of garbage', () => {
  assert.deepEqual(deserialize('not json'), emptyState());
  assert.deepEqual(deserialize('{"version":1}'), emptyState());
  assert.deepEqual(deserialize(null), emptyState());
});

test('mergeState upserts incoming characters by id', () => {
  const base = { version: 1, characters: [{ id: 'a', name: 'A', realName: '', weapons: [], reserves: [] }], activeId: 'a' };
  const incoming = { version: 1, characters: [
    { id: 'a', name: 'A-updated', realName: '', weapons: [], reserves: [] },
    { id: 'b', name: 'B', realName: '', weapons: [], reserves: [] },
  ], activeId: null };
  const merged = mergeState(base, incoming);
  assert.equal(merged.characters.length, 2);
  assert.equal(merged.characters.find((c) => c.id === 'a').name, 'A-updated');
  assert.equal(merged.activeId, 'a'); // existing activeId preserved
});
