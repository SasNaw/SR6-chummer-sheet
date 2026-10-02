import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter, createDrone, createWeapon, addDrone,
  droneConditionMonitor, setDroneDamage, renameDrone, droneInitiative, droneSoftware, droneBaseName,
  MOUNT_ROUNDS, mountSize,
} from '../js/model.js';

function withDrone(props = {}) {
  return addDrone(createCharacter({ name: 'T' }), createDrone({ id: 'd', name: 'Rex', ...props }));
}

test('createDrone defaults damage to 0 and keeps a given value', () => {
  assert.equal(createDrone({ name: 'x' }).damage, 0);
  assert.equal(createDrone({ name: 'x', damage: 3 }).damage, 3);
});

test('droneConditionMonitor: 8 + (Body / 2, rounded up); null without a Body stat', () => {
  assert.equal(droneConditionMonitor({ stats: { body: 4 } }), 10);
  assert.equal(droneConditionMonitor({ stats: { body: 5 } }), 11);
  assert.equal(droneConditionMonitor({ stats: { body: 0 } }), 8);
  assert.equal(droneConditionMonitor({ stats: null }), null);
  assert.equal(droneConditionMonitor({ stats: {} }), null);
});

test('setDroneDamage stores the value, clamped to 0..condition monitor', () => {
  const c = withDrone({ stats: { body: 4 } }); // CM 10
  assert.equal(setDroneDamage(c, 'd', 4).drones[0].damage, 4);
  assert.equal(setDroneDamage(c, 'd', 99).drones[0].damage, 10);
  assert.equal(setDroneDamage(c, 'd', -1).drones[0].damage, 0);
  assert.equal(setDroneDamage(c, 'nope', 3), c);
});

test('setDroneDamage is a no-op for a drone without a condition monitor', () => {
  const c = withDrone();
  assert.equal(setDroneDamage(c, 'd', 3), c);
});

test('renameDrone renames the drone and moves its mounted weapons', () => {
  let c = withDrone();
  c = { ...c, weapons: [createWeapon({ name: 'MG', mount: 'Rex' }), createWeapon({ name: 'P', mount: 'carried' })] };
  const next = renameDrone(c, 'd', '  Fido ');
  assert.equal(next.drones[0].name, 'Fido');
  assert.deepEqual(next.weapons.map((w) => w.mount), ['Fido', 'carried']);
  assert.equal(c.drones[0].name, 'Rex'); // input not mutated
});

test('renameDrone is a no-op for an empty, unchanged or taken name, or an unknown id', () => {
  let c = withDrone();
  c = addDrone(c, createDrone({ id: 'e', name: 'Fido' }));
  assert.equal(renameDrone(c, 'd', '  '), c);
  assert.equal(renameDrone(c, 'd', 'Rex'), c);
  assert.equal(renameDrone(c, 'd', 'Fido'), c);
  assert.equal(renameDrone(c, 'nope', 'Max'), c);
});

test('droneInitiative: Pilot × 2 + 3D6; null without a Pilot stat', () => {
  assert.equal(droneInitiative({ stats: { pilot: 3 } }), '6 + 3D6');
  assert.equal(droneInitiative({ stats: { pilot: 0 } }), '0 + 3D6');
  assert.equal(droneInitiative({ stats: null }), null);
  assert.equal(droneInitiative({ stats: {} }), null);
});

test('createDrone and createCharacter copy software lists', () => {
  const sw = [{ ref: 'evasion', kind: 'autosoft', name: { en: 'Evasion', de: null }, rating: 7, target: null }];
  const d = createDrone({ name: 'x', software: sw });
  assert.deepEqual(d.software, sw);
  assert.notEqual(d.software, sw);
  assert.notEqual(d.software[0], sw[0]);
  assert.deepEqual(createDrone({ name: 'x' }).software, []);
  const c = createCharacter({ name: 'T', rccSoftware: sw });
  assert.deepEqual(c.rccSoftware, sw);
  assert.notEqual(c.rccSoftware, sw);
  assert.deepEqual(createCharacter({ name: 'T' }).rccSoftware, []);
});

test('droneSoftware: own software first, then RCC software marked, split by kind', () => {
  const sw = (ref, kind) => ({ ref, kind, name: { en: ref, de: null }, rating: null, target: null });
  const drone = { software: [sw('targeting', 'autosoft')] };
  const c = { rccSoftware: [sw('scrubber', 'program'), sw('evasion', 'autosoft')] };
  const { autosofts, programs } = droneSoftware(c, drone);
  assert.deepEqual(autosofts.map((s) => [s.ref, s.viaRcc]), [['targeting', false], ['evasion', true]]);
  assert.deepEqual(programs.map((s) => [s.ref, s.viaRcc]), [['scrubber', true]]);
  // Older stored data without software lists.
  assert.deepEqual(droneSoftware({}, {}), { autosofts: [], programs: [] });
});

test('droneBaseName drops a trailing "(…)" from the name', () => {
  assert.equal(droneBaseName('R.E.X. (Steel Lync Combat Drone)'), 'R.E.X.');
  assert.equal(droneBaseName('Gremlin (MCT-Nissan Roto-Drohne)'), 'Gremlin');
  assert.equal(droneBaseName('Mct Gnat 1'), 'Mct Gnat 1');
  assert.equal(droneBaseName('(Only parens)'), '(Only parens)'); // nothing left -> unchanged
  assert.equal(droneBaseName('A (b) c'), 'A (b) c'); // not trailing -> unchanged
});

test('weapon mounts: standard holds 250 rounds, heavy 500', () => {
  assert.deepEqual(MOUNT_ROUNDS, { standard: 250, heavy: 500 });
});

test('mountSize reads the mount back from a weapon\'s capacity', () => {
  assert.equal(mountSize({ magazineCapacity: 500 }), 'heavy');
  assert.equal(mountSize({ magazineCapacity: 250 }), 'standard');
  assert.equal(mountSize({ magazineCapacity: 30 }), 'standard'); // older manual weapons
});
