import { createCharacter, createWeapon, createReservePool } from './model.js';
import { getWeaponDef, DEFAULT_MODE_ROUNDS } from './weapons-db.js';
import { prettifyRef } from './util.js';

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
    firingModes: (w.firingModes || []).map((m) => ({ mode: m, rounds: DEFAULT_MODE_ROUNDS[m] ?? 1 })),
  };
}

const MAX_MOUNT_DEPTH = 20;

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

function resolveMount(item, idx) {
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
      return attr(owner, 'customName') || prettifyRef(attr(owner, 'ref'));
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

export function parseSr6CharDoc(doc, catalog = null, lang = 'en') {
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
      mount: resolveMount(it, idx),
      magazineCapacity: def.magazineCapacity,
      ammoCategory: def.ammoCategory,
      firingModes: def.firingModes,
      loaded: { ammoType: defaultAmmoType(reserves, def.ammoCategory), count: def.magazineCapacity },
      notes: '',
    });
  });

  return createCharacter({
    name: firstText(doc, 'name'),
    realName: firstText(doc, 'realname'),
    weapons,
    reserves,
  });
}

export function importFromXmlString(xmlString, catalog = null, lang = 'en') {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  return parseSr6CharDoc(doc, catalog, lang);
}
