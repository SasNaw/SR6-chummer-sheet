import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { parseSr6CharDoc } from '../js/xml-import.js';

const here = dirname(fileURLToPath(import.meta.url));
function load(name) {
  const xml = readFileSync(join(here, 'fixtures', name), 'utf8');
  return new DOMParser().parseFromString(xml, 'text/xml');
}

test('S4T0: character identity', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  assert.equal(c.name, 'S4T0');
  assert.equal(c.realName, 'Kenji "Ken" Sato');
});

function parse(xml) {
  return parseSr6CharDoc(new DOMParser().parseFromString(xml, 'text/xml'));
}

test('detects magic from the root sr6char magic attribute', () => {
  // S4T0 is mundane (magic="mundane" in the root element).
  assert.equal(parseSr6CharDoc(load('S4T0.xml')).magic, false);
  // A magician/adept/etc. is magical.
  assert.equal(parse('<sr6char magic="magician"><name>Panda</name></sr6char>').magic, true);
  assert.equal(parse('<sr6char magic="adept"><name>A</name></sr6char>').magic, true);
  assert.equal(parse('<sr6char magic="mundane"><name>M</name></sr6char>').magic, false);
});

test('falls back to the MAGIC attribute value when the root has no magic attr', () => {
  assert.equal(parse('<sr6char><name>X</name><attributes><attribute id="MAGIC" value="6"/></attributes></sr6char>').magic, true);
  assert.equal(parse('<sr6char><name>X</name><attributes><attribute id="MAGIC" value="0"/></attributes></sr6char>').magic, false);
  assert.equal(parse('<sr6char><name>X</name></sr6char>').magic, false);
});

test('S4T0: a catalog overrides the built-in weapon defs on import', () => {
  const catalog = {
    weapons: {
      fn_har: { name: 'FN HAR', nameDe: 'FN Sturmgewehr', magazineCapacity: 35, ammoCategory: 'ammo_rifles', firingModes: ['SA', 'BF', 'FA'] },
    },
  };
  const c = parseSr6CharDoc(load('S4T0.xml'), catalog, 'de');
  // The carried one: drone-mounted weapons take their capacity from the mount.
  const har = c.weapons.find((w) => w.ref === 'fn_har' && w.mount === 'carried');
  assert.equal(har.name, 'FN Sturmgewehr');         // localized catalog name
  assert.equal(har.magazineCapacity, 35);            // catalog value, not built-in 20
  assert.deepEqual(har.firingModes, [{ mode: 'SA', rounds: 2 }, { mode: 'BF', rounds: 4 }, { mode: 'FA', rounds: 10 }]);
  // A ref not in the catalog falls back to the built-in table.
  const ares = c.weapons.find((w) => w.ref === 'ares_predator_vi');
  assert.equal(ares.name, 'Ares Predator VI');
});

test('S4T0: five deduped firearms with correct mounts', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  assert.equal(c.weapons.length, 5);
  const carried = c.weapons.filter((w) => w.mount === 'carried');
  assert.equal(carried.length, 2);
  const names = c.weapons.map((w) => w.name).sort();
  assert.deepEqual(names, ['Ares Predator VI', 'FN HAR', 'FN HAR', 'FN HAR', 'Remington Roomsweeper'].sort());
  const lynx = c.weapons.filter((w) => w.mount === 'R.E.X. (Steel Lync Combat Drone)');
  assert.equal(lynx.length, 2); // remington + one fn_har turret
  const gremlin = c.weapons.filter((w) => w.mount === 'Gremlin (MCT-Nissan Roto-Drohne)');
  assert.equal(gremlin.length, 1);
});

test('S4T0: weapon defs and full magazines applied', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  // The carried one: drone-mounted weapons take their capacity from the mount.
  const har = c.weapons.find((w) => w.ref === 'fn_har' && w.mount === 'carried');
  assert.equal(har.ammoCategory, 'ammo_rifles');
  assert.equal(har.magazineCapacity, 20);
  assert.equal(har.loaded.count, 20);
  assert.equal(har.loaded.ammoType, 'regular'); // matches ammo_rifles/regular reserve
  const ares = c.weapons.find((w) => w.ref === 'ares_predator_vi');
  assert.equal(ares.ammoCategory, 'ammo_heavy_smg');
});

test('S4T0: three reserve pools', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  assert.equal(c.reserves.length, 3);
  // sr6char ammunition counts are in units of 10 rounds, so the XML's "29" / "6"
  // become 290 / 60 actual rounds. (Weapon magazine sizes are already real rounds.)
  const rifle = c.reserves.find((r) => r.ammoCategory === 'ammo_rifles');
  assert.deepEqual(rifle, { ammoCategory: 'ammo_rifles', ammoType: 'regular', count: 290 });
  const shot = c.reserves.find((r) => r.ammoCategory === 'ammo_shotgun');
  assert.deepEqual(shot, { ammoCategory: 'ammo_shotgun', ammoType: 'explosive', count: 60 });
});

test('all-ammo: every ammo item imported as its own (category, type) pool', () => {
  const c = parseSr6CharDoc(load('all-ammo.xml'));
  assert.equal(c.reserves.length, 19); // one pool per AMMUNITION item, including all subtypes
  const cats = c.reserves.map((r) => r.ammoCategory);
  assert.ok(cats.includes('ammo_arrow'));
  assert.ok(cats.includes('ammo_bolt')); // new categories present
  assert.ok(cats.includes('ammo_injection_bolt'));
  const arrow = c.reserves.find((r) => r.ammoCategory === 'ammo_arrow');
  assert.equal(arrow.ammoType, 'regular'); // arrow item had no choice attribute
  assert.equal(arrow.count, 10); // XML count "1" -> 10 rounds (units of 10)
});

test('all-ammo: rifle subtypes import as distinct pools, not collapsed to regular', () => {
  const c = parseSr6CharDoc(load('all-ammo.xml'));
  const rifleTypes = c.reserves
    .filter((r) => r.ammoCategory === 'ammo_rifles')
    .map((r) => r.ammoType)
    .sort();
  assert.deepEqual(rifleTypes,
    ['apds', 'apds_caseless', 'explosive', 'flechette', 'gel', 'regular', 'stick_n_shock']);
});

test('S4T0: a catalog supplies attack ratings on import', () => {
  const catalog = {
    weapons: {
      fn_har: {
        name: 'FN HAR', magazineCapacity: 35, ammoCategory: 'ammo_rifles',
        firingModes: ['SA'], attackRating: [3, 11, 10, 6, 1],
      },
    },
  };
  const c = parseSr6CharDoc(load('S4T0.xml'), catalog, 'en');
  assert.deepEqual(c.weapons.find((w) => w.ref === 'fn_har').attackRating, [3, 11, 10, 6, 1]);
  // A ref the catalog does not know stays unrated, ready for backfill or editing.
  assert.deepEqual(c.weapons.find((w) => w.ref === 'ares_predator_vi').attackRating, [0, 0, 0, 0, 0]);
});

// Made-up stats (not rulebook values) keyed by the S4T0 drone refs.
const DRONE_CAT = { drones: {
  steel_lynx_combat_drone: { id: 'steel_lynx_combat_drone', name: { en: 'Lynx', de: 'Luchs' }, size: 'DRONE_LARGE', subtype: 'GROUND',
    stats: { handling: '1/2', acceleration: 3, speedInterval: 4, topSpeed: 5, body: 6, armor: 7, pilot: 8, sensor: 9 } },
  mct_gnat: { id: 'mct_gnat', name: { en: 'Gnat', de: 'Mücke' }, size: 'DRONE_MICRO', subtype: 'AIR',
    stats: { handling: '1', acceleration: 1, speedInterval: 1, topSpeed: 1, body: 0, armor: 0, pilot: 1, sensor: 1 } },
} };

test('S4T0: four drones imported without a drone catalog', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  // count="2" becomes two separate, uniquely numbered drones.
  assert.deepEqual(c.drones.map((d) => d.name), [
    'R.E.X. (Steel Lync Combat Drone)', 'Gremlin (MCT-Nissan Roto-Drohne)', 'Mct Gnat 1', 'Mct Gnat 2', 'Cyberspace Designs Quadrotor',
  ]);
  assert.equal(new Set(c.drones.map((d) => d.id)).size, 5);
  assert.equal(c.drones[0].ref, 'steel_lynx_combat_drone');
  assert.equal(c.drones[0].size, 'DRONE_LARGE');
  assert.equal(c.drones[0].subtype, 'GROUND');
  assert.ok(c.drones.every((d) => d.stats === null));
});

test('S4T0: a drone catalog supplies stats and names', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'), null, 'de', DRONE_CAT);
  const rex = c.drones[0];
  assert.equal(rex.name, 'R.E.X. (Steel Lync Combat Drone)'); // customName wins
  assert.deepEqual(rex.typeName, { en: 'Lynx', de: 'Luchs' });
  assert.equal(rex.stats.handling, '1/2');
  assert.equal(rex.stats.sensor, 9);
  const gnat = c.drones.find((d) => d.ref === 'mct_gnat');
  assert.equal(gnat.name, 'Mücke 1'); // no customName -> localized catalog name, numbered
  assert.equal(c.drones.find((d) => d.ref === 'cyberspace_designs_quadrotor').stats, null); // not in catalog
  // Mounted weapons still point at their drone by name.
  assert.equal(c.weapons.filter((w) => w.mount === rex.name).length, 2);
});

test('S4T0: software installed on a drone is imported onto that drone', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  const rex = c.drones[0];
  // Targeting's choice names the weapon it is bound to.
  assert.deepEqual(rex.software, [
    { ref: 'targeting', kind: 'autosoft', name: { en: 'Targeting', de: null }, rating: 7, target: 'Remington Roomsweeper' },
  ]);
  assert.deepEqual(c.drones.find((d) => d.ref === 'mct_gnat').software, []);
});

test('S4T0: rigger console software is imported as shared RCC software', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  assert.deepEqual(c.rcc.software.map((s) => [s.ref, s.kind, s.name.en, s.rating]), [
    ['signal_scrubber_rig', 'program', 'Signal Scrubber', null],
    ['evasion', 'autosoft', 'Evasion', 7],
    ['clearsight', 'autosoft', 'Clearsight', 7],
    ['maneuvering', 'autosoft', 'Maneuvering', 7],
    ['stealth_auto', 'autosoft', 'Stealth', 7],
    ['targeting', 'autosoft', 'Targeting', 7],
  ]);
  assert.equal(c.rcc.software[5].target, 'FN HAR');
  // The commlink's basic program is not rigger software.
  assert.ok(!c.rcc.software.some((s) => s.ref === 'browse'));
});

test('a drone catalog supplies software names', () => {
  const cat = { ...DRONE_CAT, software: { evasion: { en: 'Evade', de: 'Ausweichen' } } };
  const c = parseSr6CharDoc(load('S4T0.xml'), null, 'de', cat);
  assert.deepEqual(c.rcc.software.find((s) => s.ref === 'evasion').name, { en: 'Evade', de: 'Ausweichen' });
});

test('S4T0: every drone-mounted weapon has a drone to show it under', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  const names = new Set(c.drones.map((d) => d.name));
  assert.ok(c.weapons.filter((w) => w.mount !== 'carried').every((w) => names.has(w.mount)));
});

test('S4T0: drone weapons hold 250 rounds in a standard weapon mount', () => {
  const c = parseSr6CharDoc(load('S4T0.xml'));
  const mounted = c.weapons.filter((w) => w.mount !== 'carried');
  assert.ok(mounted.length > 0);
  for (const w of mounted) {
    assert.equal(w.magazineCapacity, 250, w.name);
    assert.equal(w.loaded.count, 250, w.name);
  }
  // Carried weapons keep their own magazine.
  assert.ok(c.weapons.filter((w) => w.mount === 'carried').every((w) => w.magazineCapacity !== 250));
});

test('a heavy weapon mount or turret holds 500 rounds; other mounts 250', () => {
  const xml = (mountRef) => `<sr6char><name>R</name><gear>
    <item count="1" ref="steel_lynx_combat_drone" subtype="GROUND" type="DRONE_LARGE" uniqueid="d1"/>
    <item count="1" embedin="d1" ref="${mountRef}" slot="VEHICLE_BODY" subtype="MOD_MOUNT" type="ACCESSORY" uniqueid="m1"/>
    <item count="1" embedin="m1" ref="fn_har" slot="VEHICLE_WEAPON" subtype="RIFLE_ASSAULT" type="ACCESSORY" uniqueid="w1"/>
  </gear></sr6char>`;
  const cap = (ref) => parse(xml(ref)).weapons[0].magazineCapacity;
  assert.equal(cap('weapon_mount_heavy'), 500);
  assert.equal(cap('weapon_turret_heavy_manual'), 500);
  assert.equal(cap('weapon_mount_standard'), 250);
  assert.equal(cap('weapon_mount_small'), 250);
  assert.equal(cap('weapon_turret_standard'), 250);
  assert.equal(parse(xml('weapon_mount_heavy')).weapons[0].loaded.count, 500);
});

test('S4T0: the rigger console is imported with all drones slaved and its slots filled', () => {
  const plain = parseSr6CharDoc(load('S4T0.xml'));
  assert.equal(plain.rcc.ref, 'proteus_poseidon');
  assert.deepEqual(plain.rcc.name, { en: 'Proteus Poseidon', de: null }); // prettified without a catalog
  assert.equal(plain.rcc.stats, null);
  assert.equal(plain.rcc.running.length, 6); // no slot count known -> all run
  assert.deepEqual(plain.rcc.slaved, plain.drones.map((d) => d.id));

  const cat = { ...DRONE_CAT, consoles: { proteus_poseidon: {
    name: { en: 'Proteus Poseidon', de: 'Proteus Poseidon' },
    stats: { deviceRating: 5, dataProcessing: 5, firewall: 6, programSlots: 5 },
  } } };
  const c = parseSr6CharDoc(load('S4T0.xml'), null, 'en', cat);
  assert.deepEqual(c.rcc.stats, { deviceRating: 5, dataProcessing: 5, firewall: 6, programSlots: 5 });
  assert.deepEqual(c.rcc.running, c.rcc.software.slice(0, 5).map((s) => s.id));
});

test('no rigger console: rcc is null', () => {
  assert.equal(parse('<sr6char><name>X</name></sr6char>').rcc, null);
});
