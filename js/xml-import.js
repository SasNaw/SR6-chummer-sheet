import { createCharacter, createWeapon, createReservePool, createDrone } from './model.js';
import { getWeaponDef } from './weapons-db.js';
import { FIRING_MODE_ROUNDS } from './firing-modes.js';
import { prettifyRef } from './util.js';
import { droneEntry } from './drone-catalog.js';

// Resolve a weapon ref to a definition, preferring the loaded catalog (its 200+
// weapons) over the small built-in table. Returns { name, magazineCapacity,
// ammoCategory, firingModes:[{mode,rounds}] }.
function resolveWeaponDef(ref, catalog, lang) {
  const w = catalog && catalog.weapons && catalog.weapons[ref];
  if (!w) return getWeaponDef(ref);
  return {
    name: (lang === 'de' && w.nameDe) ? w.nameDe : (w.name || prettifyRef(ref)),
    magazineCapacity: w.magazineCapacity ?? 0,
    ammoCategory: w.ammoCategory ?? null,
    firingModes: (w.firingModes || []).map((m) => ({ mode: m, rounds: FIRING_MODE_ROUNDS[m] ?? 1 })),
    attackRating: w.attackRating || [],
  };
}

const MAX_MOUNT_DEPTH = 20;

// Display name for a top-level drone/vehicle item: its customName, else the
// drone catalog's localized name, else the prettified ref. Mounted weapons use
// the same name as their `mount`, so the two must agree.
function ownerName(item, droneCatalog, lang) {
  const custom = attr(item, 'customName');
  if (custom) return custom;
  const ref = attr(item, 'ref');
  const entry = droneEntry(droneCatalog, ref);
  const n = entry && entry.name;
  return (n && ((lang === 'de' && n.de) || n.en)) || prettifyRef(ref);
}

function itemCount(item) {
  return parseInt(attr(item, 'count') || '1', 10) || 1;
}

// Name of the i-th (0-based) drone of an item. An item with count > 1 becomes
// that many separate drones, numbered "Name 1", "Name 2", … so each stays
// uniquely addressable (weapons mount by drone name).
function droneName(item, i, droneCatalog, lang) {
  const base = ownerName(item, droneCatalog, lang);
  return itemCount(item) > 1 ? `${base} ${i + 1}` : base;
}

function parseDrones(items, droneCatalog, lang) {
  return items
    .filter((it) => (attr(it, 'type') || '').startsWith('DRONE_') && !attr(it, 'embedin'))
    .flatMap((it) => {
      const ref = attr(it, 'ref');
      const entry = droneEntry(droneCatalog, ref);
      return Array.from({ length: itemCount(it) }, (_, i) => createDrone({
        name: droneName(it, i, droneCatalog, lang),
        ref,
        typeName: entry ? entry.name : null,
        size: attr(it, 'type'),
        subtype: attr(it, 'subtype'),
        stats: entry ? entry.stats : null,
      }));
    });
}

// sr6char stores ammunition quantities in units of 10 rounds (a "count" of 6
// means 60 rounds). Weapon magazine capacities are already in real rounds.
const ROUNDS_PER_AMMO_UNIT = 10;

function firstText(doc, tag) {
  const el = doc.getElementsByTagName(tag)[0];
  return el && el.textContent ? el.textContent.trim() : '';
}

function attr(el, name) {
  return el.getAttribute ? el.getAttribute(name) : null;
}

function directChildren(el, tag) {
  return Array.from(el.childNodes || []).filter((n) => n.nodeName === tag);
}

// Build: id -> item element; and generated-uuid -> owning item id.
function indexItems(items) {
  const byId = new Map();
  const generatedToOwner = new Map();
  for (const it of items) {
    const id = attr(it, 'uniqueid');
    if (id) byId.set(id, it);
    for (const gen of directChildren(it, 'generatedUUIDs')) {
      for (const uuid of Array.from(gen.getElementsByTagName('uuid'))) {
        const token = (uuid.textContent || '').trim();
        const gid = token.includes('|') ? token.split('|')[1] : token;
        if (gid && id) generatedToOwner.set(gid, id);
      }
    }
  }
  return { byId, generatedToOwner };
}

function resolveMount(item, idx, droneCatalog, lang) {
  if (attr(item, 'type') === 'WEAPON_FIREARMS') return 'carried';
  let cur = attr(item, 'embedin');
  const visited = new Set();
  for (let depth = 0; cur && depth < MAX_MOUNT_DEPTH; depth += 1) {
    if (visited.has(cur)) break;
    visited.add(cur);
    let owner = idx.byId.get(cur);
    if (!owner) {
      const viaGen = idx.generatedToOwner.get(cur);
      if (viaGen) { cur = viaGen; continue; }
      break;
    }
    const parentEmbed = attr(owner, 'embedin');
    if (!parentEmbed) {
      // Accessories of a multi-count drone attach to the first of them.
      return droneName(owner, 0, droneCatalog, lang);
    }
    cur = parentEmbed;
  }
  return 'Vehicle';
}

function parseReserves(items) {
  return items
    .filter((it) => attr(it, 'type') === 'AMMUNITION')
    .map((it) => createReservePool({
      ammoCategory: attr(it, 'ref'),
      ammoType: attr(it, 'choice') || 'regular',
      count: parseInt(attr(it, 'count') || '0', 10) * ROUNDS_PER_AMMO_UNIT,
    }));
}

function defaultAmmoType(reserves, ammoCategory) {
  const m = reserves.find((r) => r.ammoCategory === ammoCategory);
  return m ? m.ammoType : 'regular';
}

// A character is magical when the root <sr6char magic="..."> is anything other
// than "mundane" (e.g. magician/adept/mystic_adept/aspected). As a fallback for
// docs missing that attribute, a MAGIC attribute value > 0 also counts.
function detectMagic(doc) {
  const root = doc.getElementsByTagName('sr6char')[0];
  const m = ((root && attr(root, 'magic')) || '').trim().toLowerCase();
  if (m) return m !== 'mundane';
  const magicAttr = Array.from(doc.getElementsByTagName('attribute'))
    .find((a) => attr(a, 'id') === 'MAGIC');
  return magicAttr ? parseInt(attr(magicAttr, 'value') || '0', 10) > 0 : false;
}

export function parseSr6CharDoc(doc, catalog = null, lang = 'en', droneCatalog = null) {
  const items = Array.from(doc.getElementsByTagName('item'));
  const idx = indexItems(items);

  const reserves = parseReserves(items);

  const firearmItems = items.filter(
    (it) => attr(it, 'type') === 'WEAPON_FIREARMS' || attr(it, 'slot') === 'VEHICLE_WEAPON');
  const deduped = new Map();
  for (const it of firearmItems) {
    const id = attr(it, 'uniqueid');
    if (!deduped.has(id)) deduped.set(id, it);
  }

  const weapons = Array.from(deduped.values()).map((it) => {
    const ref = attr(it, 'ref');
    const def = resolveWeaponDef(ref, catalog, lang);
    return createWeapon({
      name: def.name,
      ref,
      mount: resolveMount(it, idx, droneCatalog, lang),
      magazineCapacity: def.magazineCapacity,
      ammoCategory: def.ammoCategory,
      firingModes: def.firingModes,
      attackRating: def.attackRating,
      loaded: { ammoType: defaultAmmoType(reserves, def.ammoCategory), count: def.magazineCapacity },
      notes: '',
    });
  });

  return createCharacter({
    name: firstText(doc, 'name'),
    realName: firstText(doc, 'realname'),
    magic: detectMagic(doc),
    weapons,
    reserves,
    drones: parseDrones(items, droneCatalog, lang),
  });
}

export function importFromXmlString(xmlString, catalog = null, lang = 'en', droneCatalog = null) {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  return parseSr6CharDoc(doc, catalog, lang, droneCatalog);
}
