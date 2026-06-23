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
  const har = c.weapons.find((w) => w.ref === 'fn_har');
  assert.equal(har.name, 'FN Sturmgewehr');         // localized catalog name
  assert.equal(har.magazineCapacity, 35);            // catalog value, not built-in 20
  assert.deepEqual(har.firingModes, [{ mode: 'SA', rounds: 1 }, { mode: 'BF', rounds: 3 }, { mode: 'FA', rounds: 6 }]);
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
  const har = c.weapons.find((w) => w.ref === 'fn_har');
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
