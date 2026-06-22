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

test('all-ammo: every category imported; missing choice -> regular', () => {
  const c = parseSr6CharDoc(load('all-ammo.xml'));
  assert.equal(c.reserves.length, 11);
  const cats = c.reserves.map((r) => r.ammoCategory).sort();
  assert.ok(cats.includes('ammo_arrow'));
  const arrow = c.reserves.find((r) => r.ammoCategory === 'ammo_arrow');
  assert.equal(arrow.ammoType, 'regular'); // arrow item had no choice attribute
  assert.equal(arrow.count, 10); // XML count "1" -> 10 rounds (units of 10)
});
