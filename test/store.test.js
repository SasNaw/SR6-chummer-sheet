import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, serialize, deserialize, mergeState } from '../js/store.js';

test('serialize/deserialize round-trips state', () => {
  const s = { version: 1, characters: [{ id: 'a', name: 'A', realName: '', weapons: [], reserves: [] }], activeId: 'a', lang: 'de' };
  assert.deepEqual(deserialize(serialize(s)), s);
});

test('deserialize defaults lang to en and only accepts de/en', () => {
  assert.equal(deserialize('{"characters":[]}').lang, 'en');
  assert.equal(deserialize('{"characters":[],"lang":"de"}').lang, 'de');
  assert.equal(deserialize('{"characters":[],"lang":"xx"}').lang, 'en');
});

test('deserialize is tolerant of garbage', () => {
  assert.deepEqual(deserialize('not json'), emptyState());
  assert.deepEqual(deserialize('{"version":1}'), emptyState());
  assert.deepEqual(deserialize(null), emptyState());
  assert.deepEqual(deserialize(''), emptyState());
  assert.deepEqual(deserialize('{"characters":[null, 42, "x"]}'), emptyState());
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

test('deserialize migrates legacy string drones to objects', () => {
  const s = deserialize(JSON.stringify({ characters: [{ id: 'a', name: 'A', weapons: [], reserves: [], drones: ['R.E.X.'] }] }));
  assert.equal(s.characters[0].drones.length, 1);
  assert.equal(s.characters[0].drones[0].name, 'R.E.X.');
  assert.equal(s.characters[0].drones[0].stats, null);
});

test('deserialize splits a grouped drone (count > 1) into numbered drones', () => {
  const s = deserialize(JSON.stringify({ characters: [{
    id: 'a', name: 'A', reserves: [],
    drones: [{ id: 'g', name: 'MCT Gnat', ref: 'mct_gnat', count: 2, stats: { body: 0 } }, { id: 'r', name: 'R.E.X.', count: 1 }],
    weapons: [{ id: 'w', name: 'Gun', mount: 'MCT Gnat' }],
  }] }));
  const c = s.characters[0];
  assert.deepEqual(c.drones.map((d) => d.name), ['MCT Gnat 1', 'MCT Gnat 2', 'R.E.X.']);
  assert.equal(c.drones[0].id, 'g'); // the first keeps its id
  assert.notEqual(c.drones[1].id, 'g');
  assert.deepEqual(c.drones[1].stats, { body: 0 });
  assert.ok(c.drones.every((d) => !('count' in d)));
  assert.equal(c.weapons[0].mount, 'MCT Gnat 1'); // mounted weapons follow the first
});

test('deserialize gives weapon mounts without a drone their own drone', () => {
  const s = deserialize(JSON.stringify({ characters: [
    {
      id: 'a', name: 'A', reserves: [], drones: [{ id: 'r', name: 'R.E.X.' }],
      weapons: [{ id: 'w1', mount: 'R.E.X.' }, { id: 'w2', mount: 'Vehicle' }, { id: 'w3', mount: 'Vehicle' }, { id: 'w4', mount: 'carried' }],
    },
    { id: 'b', name: 'B', reserves: [], weapons: [{ id: 'w5', mount: 'Gremlin' }] }, // legacy: no drones array
  ] }));
  assert.deepEqual(s.characters[0].drones.map((d) => d.name), ['R.E.X.', 'Vehicle']);
  assert.equal(s.characters[0].drones[1].stats, null);
  assert.deepEqual(s.characters[1].drones.map((d) => d.name), ['Gremlin']);
});
