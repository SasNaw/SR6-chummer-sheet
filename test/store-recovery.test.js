import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPersisted, serialize } from '../js/store.js';

const CHAR = { id: 'c1', name: 'Wraith', weapons: [], reserves: [], drones: [], spirits: [] };
const good = (name = 'Wraith') => serialize({
  version: 1, activeId: 'c1', lang: 'de', characters: [{ ...CHAR, name }],
});

// readPersisted decides what to trust: the main blob, the backup written before
// the previous save, or nothing. `writable` is the safety interlock — it is false
// whenever readable data may still be sitting in storage, so a later save cannot
// overwrite bytes we failed to parse.

test('readPersisted uses the main blob when it parses', () => {
  const r = readPersisted(good(), null);
  assert.equal(r.source, 'main');
  assert.equal(r.state.characters[0].name, 'Wraith');
  assert.equal(r.writable, true);
});

test('readPersisted treats absent storage as a normal empty start', () => {
  const r = readPersisted(null, null);
  assert.equal(r.source, 'empty');
  assert.deepEqual(r.state.characters, []);
  assert.equal(r.writable, true); // a first run must be able to save
});

test('readPersisted falls back to the backup when the main blob is unreadable', () => {
  const r = readPersisted('{"characters":[{"id":"c1",', good('Ghost'));
  assert.equal(r.source, 'backup');
  assert.equal(r.state.characters[0].name, 'Ghost');
  assert.equal(r.recovered, true);
  assert.equal(r.writable, true); // we have real data again, so saving is safe
});

test('readPersisted refuses to authorize saving when nothing could be parsed', () => {
  const r = readPersisted('{"characters":[{"id":', 'also broken');
  assert.equal(r.source, 'none');
  assert.deepEqual(r.state.characters, []);
  assert.equal(r.writable, false); // the whole point: do not overwrite the wreckage
  assert.equal(r.corrupt, true);
});

test('readPersisted reports the unreadable text so it can be quarantined', () => {
  const wreck = '{"characters":[{"id":';
  assert.equal(readPersisted(wreck, null).corruptText, wreck);
});

test('readPersisted does not quarantine or block on a merely empty main blob', () => {
  const r = readPersisted('', null);
  assert.equal(r.corrupt, false);
  assert.equal(r.corruptText, null);
  assert.equal(r.writable, true);
});

test('readPersisted keeps the main blob when it parses even if a backup exists', () => {
  const r = readPersisted(good('Current'), good('Stale'));
  assert.equal(r.state.characters[0].name, 'Current');
  assert.equal(r.recovered, false);
});

// A blob that is valid JSON but not a state object is the same hazard as broken
// JSON: deserialize yields an empty state, which must not be written back.
test('readPersisted blocks saving for valid JSON that is not a state object', () => {
  const r = readPersisted('{"unexpected":true}', null);
  assert.equal(r.source, 'none');
  assert.equal(r.writable, false);
  assert.equal(r.corrupt, true);
});

test('readPersisted allows an intentionally empty saved state', () => {
  // A user who deleted their last character has characters: [] on purpose.
  const r = readPersisted(serialize({ version: 1, characters: [], activeId: null, lang: 'en' }), null);
  assert.equal(r.source, 'main');
  assert.equal(r.writable, true);
  assert.equal(r.corrupt, false);
});
