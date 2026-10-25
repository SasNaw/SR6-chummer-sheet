import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter, createDrone, createWeapon, addDrone,
  droneConditionMonitor, setDroneDamage, renameDrone, droneInitiative, droneSoftware, droneBaseName, droneSkills, droneTargeting, droneCombatValues,
  MOUNT_ROUNDS, mountSize, dronesArmedFirst,
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

test('createDrone copies its software list', () => {
  const sw = [{ ref: 'evasion', kind: 'autosoft', name: { en: 'Evasion', de: null }, rating: 7, target: null }];
  const d = createDrone({ name: 'x', software: sw });
  assert.deepEqual(d.software, sw);
  assert.notEqual(d.software, sw);
  assert.notEqual(d.software[0], sw[0]);
  assert.deepEqual(createDrone({ name: 'x' }).software, []);
});

test('droneSoftware: own software first, then running RCC software marked, split by kind', () => {
  const sw = (ref, kind) => ({ id: ref, ref, kind, name: { en: ref, de: null }, rating: null, target: null });
  const drone = { id: 'd', software: [sw('targeting', 'autosoft')] };
  const c = { rcc: { software: [sw('scrubber', 'program'), sw('evasion', 'autosoft')], running: ['scrubber', 'evasion'], slaved: ['d'] } };
  const { autosofts, programs } = droneSoftware(c, drone);
  assert.deepEqual(autosofts.map((s) => [s.ref, s.viaRcc]), [['targeting', false], ['evasion', true]]);
  assert.deepEqual(programs.map((s) => [s.ref, s.viaRcc]), [['scrubber', true]]);
  // Older stored data without software lists or an RCC.
  assert.deepEqual(droneSoftware({}, {}), { autosofts: [], programs: [] });
});

test('droneSkills: attribute + autosoft rating, in Evasion/Perception/Piloting/Stealth order', () => {
  const sw = (ref, rating) => ({ id: ref, ref, kind: 'autosoft', name: { en: ref, de: null }, rating, target: null });
  const drone = {
    id: 'd', stats: { pilot: 3, sensor: 2 },
    software: [sw('evasion', 4), sw('clearsight', 5), sw('maneuvering', 2), sw('stealth_auto', 6)],
  };
  assert.deepEqual(droneSkills({}, drone), [
    { key: 'evasion', value: 7 },
    { key: 'perception', value: 7 },
    { key: 'piloting', value: 5 },
    { key: 'stealth', value: 9 },
  ]);
});

test('droneSkills: a missing autosoft counts as 0; the highest rating wins, RCC included', () => {
  const sw = (ref, rating) => ({ id: ref, ref, kind: 'autosoft', name: { en: ref, de: null }, rating, target: null });
  const drone = { id: 'd', stats: { pilot: 3, sensor: 2 }, software: [sw('evasion', 2)] };
  const c = { rcc: { software: [sw('evasion', 5), sw('stealth', 4)], running: ['evasion', 'stealth'], slaved: ['d'] } };
  assert.deepEqual(droneSkills(c, drone).map((s) => s.value), [8, 2, 3, 7]);
  // RCC software only counts while the drone is slaved to the console.
  assert.deepEqual(droneSkills({ rcc: { ...c.rcc, slaved: [] } }, drone).map((s) => s.value), [5, 2, 3, 3]);
});

test('droneTargeting: Sensor + the highest Targeting rating bound to that weapon (by name); null when unrated', () => {
  const sw = (ref, rating, target = null) => ({ id: `${ref}-${target}`, ref, kind: 'autosoft', name: { en: ref, de: null }, rating, target });
  const drone = {
    id: 'd', stats: { pilot: 3, sensor: 2 },
    software: [sw('targeting', 4, 'Roomsweeper'), sw('targeting', 0, 'Ares Alpha')],
  };
  const c = { rcc: { software: [sw('targeting', 6, 'Roomsweeper'), sw('targeting', 3, 'Ingram')], running: ['targeting-Roomsweeper', 'targeting-Ingram'], slaved: ['d'] } };
  assert.equal(droneTargeting(c, drone, { name: 'Roomsweeper', alias: 'Boom' }), 8);
  assert.equal(droneTargeting(c, drone, { name: 'Ingram' }), 5);
  assert.equal(droneTargeting(c, drone, { name: 'Ares Alpha' }), null);
  assert.equal(droneTargeting(c, drone, { name: 'FN HAR' }), null);
  assert.equal(droneTargeting(c, { ...drone, stats: null }, { name: 'Roomsweeper' }), null);
  // Targeting is not one of the drone-level skills.
  assert.equal(droneSkills(c, drone).length, 4);
});

test('droneCombatValues: AR = Maneuvering + Sensor, DR = Maneuvering + Armor, damage resistance = Body', () => {
  const sw = (ref, rating) => ({ id: ref, ref, kind: 'autosoft', name: { en: ref, de: null }, rating, target: null });
  const drone = { id: 'd', ref: 'mct_fly_spy', stats: { sensor: 2, armor: 4, body: 3 }, software: [sw('maneuvering', 5)] };
  assert.deepEqual(droneCombatValues({}, drone), { attackRating: 7, defenseRating: 9, damageResistance: 3 });
  // Without a Maneuvering autosoft it counts as 0.
  assert.deepEqual(droneCombatValues({}, { ...drone, software: [] }), { attackRating: 2, defenseRating: 4, damageResistance: 3 });
});

test('droneCombatValues: a Steel Lynx resists damage with Body + 3 (its ceramic armor)', () => {
  const drone = { id: 'd', ref: 'steel_lynx_combat_drone', stats: { sensor: 2, armor: 4, body: 8 }, software: [] };
  assert.equal(droneCombatValues({}, drone).damageResistance, 11);
});

test('droneCombatValues: null without stats; a missing attribute leaves that value null', () => {
  assert.equal(droneCombatValues({}, { id: 'd', stats: null }), null);
  assert.deepEqual(droneCombatValues({}, { id: 'd', stats: { body: 3 } }),
    { attackRating: null, defenseRating: null, damageResistance: 3 });
});

test('droneSkills: null without stats; a missing attribute leaves that skill null', () => {
  assert.equal(droneSkills({}, { id: 'd', stats: null }), null);
  assert.deepEqual(droneSkills({}, { id: 'd', stats: { pilot: 2 } }).map((s) => s.value), [2, null, 2, 2]);
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

test('dronesArmedFirst: armed drones first, each group keeping its stored order', () => {
  let c = createCharacter({ name: 'T' });
  for (const name of ['A', 'B', 'C', 'D']) c = addDrone(c, createDrone({ name }));
  c = { ...c, weapons: [createWeapon({ name: 'gun1', mount: 'D' }), createWeapon({ name: 'gun2', mount: 'B' })] };
  assert.deepEqual(dronesArmedFirst(c).map((d) => d.name), ['B', 'D', 'A', 'C']);
  assert.deepEqual(c.drones.map((d) => d.name), ['A', 'B', 'C', 'D']);
  assert.deepEqual(dronesArmedFirst(createCharacter({ name: 'T' })), []);
});
