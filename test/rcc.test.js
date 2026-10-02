import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter, createDrone, addDrone, removeDrone,
  createRcc, initRccState, startRccProgram, stopRccProgram, toggleRccSlave,
  droneSoftware, normalizeCharacterDrones,
} from '../js/model.js';

const sw = (ref, kind = 'autosoft', id = ref) => ({ id, ref, kind, name: { en: ref, de: null }, rating: 7, target: null });

function rigger({ slots = 2, software = [sw('a'), sw('b'), sw('c')] } = {}) {
  return createCharacter({
    name: 'R',
    drones: [createDrone({ id: 'd1', name: 'One' }), createDrone({ id: 'd2', name: 'Two' })],
    rcc: createRcc({ ref: 'proteus_poseidon', name: { en: 'Proteus Poseidon', de: null },
      stats: slots == null ? null : { deviceRating: 5, dataProcessing: 5, firewall: 6, programSlots: slots }, software }),
  });
}

test('createRcc copies its parts, gives software ids, and starts idle', () => {
  const r = createRcc({ ref: 'x', software: [{ ref: 'evasion', kind: 'autosoft', name: { en: 'Evasion', de: null } }] });
  assert.equal(typeof r.software[0].id, 'string');
  assert.deepEqual(r.running, []);
  assert.deepEqual(r.slaved, []);
  assert.equal(r.stats, null);
  assert.equal(createCharacter({ name: 'T' }).rcc, null);
});

test('initRccState slaves every drone and runs programs in order until the slots are full', () => {
  const c = initRccState(rigger({ slots: 2 }));
  assert.deepEqual(c.rcc.slaved, ['d1', 'd2']);
  assert.deepEqual(c.rcc.running, ['a', 'b']);
  // Unknown slot count (no stats): everything runs.
  assert.deepEqual(initRccState(rigger({ slots: null })).rcc.running, ['a', 'b', 'c']);
  // No RCC: unchanged.
  const plain = createCharacter({ name: 'P' });
  assert.equal(initRccState(plain), plain);
});

test('startRccProgram runs a program, but not past the program slots', () => {
  let c = rigger({ slots: 2 });
  c = startRccProgram(c, 'c');
  c = startRccProgram(c, 'a');
  assert.deepEqual(c.rcc.running, ['c', 'a']);
  assert.equal(startRccProgram(c, 'b'), c); // full
  assert.equal(startRccProgram(c, 'a'), c); // already running
  assert.equal(startRccProgram(c, 'nope'), c);
  // No slot count known: no cap.
  let open = rigger({ slots: null });
  for (const id of ['a', 'b', 'c']) open = startRccProgram(open, id);
  assert.deepEqual(open.rcc.running, ['a', 'b', 'c']);
});

test('stopRccProgram stops a running program', () => {
  const c = initRccState(rigger({ slots: 2 }));
  assert.deepEqual(stopRccProgram(c, 'a').rcc.running, ['b']);
  assert.equal(stopRccProgram(c, 'c'), c); // not running
});

test('toggleRccSlave slaves and unslaves a drone', () => {
  let c = rigger();
  c = toggleRccSlave(c, 'd2');
  assert.deepEqual(c.rcc.slaved, ['d2']);
  c = toggleRccSlave(c, 'd2');
  assert.deepEqual(c.rcc.slaved, []);
  assert.equal(toggleRccSlave(c, 'nope'), c);
  const plain = createCharacter({ name: 'P' });
  assert.equal(toggleRccSlave(plain, 'd1'), plain);
});

test('a new drone is slaved to the RCC; a deleted one is unslaved', () => {
  let c = initRccState(rigger());
  c = addDrone(c, createDrone({ id: 'd3', name: 'Three' }));
  assert.deepEqual(c.rcc.slaved, ['d1', 'd2', 'd3']);
  c = removeDrone(c, 'One');
  assert.deepEqual(c.rcc.slaved, ['d2', 'd3']);
  // Without an RCC nothing changes shape.
  assert.equal(addDrone(createCharacter({ name: 'P' }), 'X').rcc, null);
});

test('droneSoftware: RCC software only on slaved drones, and only while running', () => {
  let c = initRccState(rigger({ slots: 2, software: [sw('scrub', 'program'), sw('evasion'), sw('stealth')] }));
  const own = { ...c.drones[0], software: [sw('targeting')] };
  const r = droneSoftware(c, own);
  assert.deepEqual(r.autosofts.map((s) => [s.ref, s.viaRcc]), [['targeting', false], ['evasion', true]]);
  assert.deepEqual(r.programs.map((s) => s.ref), ['scrub']); // stealth is installed but not running
  c = toggleRccSlave(c, 'd1');
  assert.deepEqual(droneSoftware(c, own).autosofts.map((s) => s.ref), ['targeting']);
});

test('migration: the earlier rccSoftware list becomes an RCC with defaults', () => {
  const old = {
    id: 'a', name: 'A', weapons: [], reserves: [],
    drones: [{ id: 'd1', name: 'One', stats: null }],
    rccSoftware: [{ ref: 'evasion', kind: 'autosoft', name: { en: 'Evasion', de: null }, rating: 7, target: null }],
  };
  const c = normalizeCharacterDrones(old);
  assert.ok(!('rccSoftware' in c));
  assert.equal(c.rcc.software[0].ref, 'evasion');
  assert.deepEqual(c.rcc.running, [c.rcc.software[0].id]);
  assert.deepEqual(c.rcc.slaved, ['d1']);
  assert.equal(c.rcc.stats, null);
});
