import { el } from './dom.js';
import { getState, mutate } from '../app.js';
import {
  fire, spend, addRounds, setLoaded, reload, matchingReserves,
  updateWeapon, removeWeapon, addReserve, setReserveCount, removeReserve,
  createWeapon, createReservePool, upsertCharacter,
} from '../model.js';
import { AMMO_CATEGORIES, AMMO_TYPES, categoryName } from '../ammo-db.js';

// Apply a Character->Character transform to the active character.
function updateCharacter(characterId, fn) {
  mutate((s) => {
    const c = s.characters.find((x) => x.id === characterId);
    if (!c) return s;
    return { ...s, characters: upsertCharacter(s.characters, fn(c)) };
  });
}

function weaponCard(c, w) {
  const card = el('div', { class: 'card' });

  // Header: name + mount badge + edit/delete
  card.append(el('div', { class: 'row spread' }, [
    el('div', { class: 'row' }, [
      el('h2', {}, w.name),
      el('span', { class: 'badge' }, w.mount === 'carried' ? 'Carried' : w.mount),
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'icon', title: 'Edit', onclick: () => editWeapon(c, w) }, '✎'),
      el('button', {
        class: 'icon danger', title: 'Remove',
        onclick: () => { if (confirm(`Remove ${w.name}?`)) updateCharacter(c.id, (ch) => removeWeapon(ch, w.id)); },
      }, '🗑'),
    ]),
  ]));

  // Count + loaded ammo type
  card.append(el('div', { class: 'row spread' }, [
    el('div', { class: 'count' }, [String(w.loaded.count), el('span', { class: 'cap' }, ` / ${w.magazineCapacity}`)]),
    el('span', { class: 'badge' }, w.loaded.ammoType),
  ]));

  // Firing-mode buttons
  if (w.firingModes.length) {
    card.append(el('div', { class: 'modes' }, w.firingModes.map((m) =>
      el('button', { onclick: () => updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, fire(findW(ch, w.id), m.mode))) },
        `${m.mode} (-${m.rounds})`))));
  }

  // Manual controls
  card.append(el('div', { class: 'row' }, [
    el('button', { class: 'icon', onclick: () => updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, spend(findW(ch, w.id), 1))) }, '−'),
    el('button', { class: 'icon', onclick: () => updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, addRounds(findW(ch, w.id), 1))) }, '+'),
    el('button', {
      onclick: () => {
        const n = parseInt(prompt('Set loaded rounds:', String(w.loaded.count)) ?? '', 10);
        if (Number.isInteger(n)) updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, setLoaded(findW(ch, w.id), n)));
      },
    }, 'Set'),
    el('button', { class: 'accent', onclick: () => doReload(c, w) }, 'Reload'),
  ]));

  if (w.notes) card.append(el('div', { class: 'muted' }, w.notes));
  return card;
}

function findW(character, weaponId) {
  return character.weapons.find((x) => x.id === weaponId);
}

// updateWeapon expects a `changes` object; we pass a whole new weapon (a superset merge).
// fire/spend/etc return a full weapon, so updateWeapon(ch, id, fullWeapon) shallow-merges all fields — correct.

function doReload(c, w) {
  const pools = matchingReserves(c, w.id);
  if (pools.length === 0) {
    alert(`No reserve ammo for ${categoryName(w.ammoCategory)}. Add a pool in the Reserve section or use Set.`);
    return;
  }
  let type = pools[0].ammoType;
  if (pools.length > 1) {
    const choice = prompt(`Reload which type? ${pools.map((p) => `${p.ammoType} (${p.count})`).join(', ')}`, w.loaded.ammoType);
    if (!choice) return;
    type = choice.trim();
  }
  updateCharacter(c.id, (ch) => reload(ch, w.id, type));
}

function editWeapon(c, w) {
  const name = prompt('Weapon name:', w.name);
  if (name == null) return;
  const cap = parseInt(prompt('Magazine capacity:', String(w.magazineCapacity)) ?? '', 10);
  const cat = prompt(`Ammo category ref (e.g. ${Object.keys(AMMO_CATEGORIES).join(', ')}):`, w.ammoCategory || '');
  const mount = prompt('Mount (carried or a vehicle name):', w.mount);
  const notes = prompt('Notes:', w.notes);
  updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, {
    name,
    magazineCapacity: Number.isInteger(cap) ? cap : w.magazineCapacity,
    ammoCategory: cat || null,
    mount: mount || 'carried',
    notes: notes ?? '',
  }));
}

function reserveSection(c) {
  const wrap = el('div', { class: 'card' });
  wrap.append(el('div', { class: 'section-title' }, [
    el('h2', {}, 'Reserve ammo'),
    el('button', { onclick: () => addReservePrompt(c) }, '+ Pool'),
  ]));

  if (c.reserves.length === 0) {
    wrap.append(el('div', { class: 'muted' }, 'No spare ammo tracked.'));
    return wrap;
  }

  // Group by category.
  const byCat = {};
  for (const r of c.reserves) (byCat[r.ammoCategory] ||= []).push(r);
  for (const [cat, pools] of Object.entries(byCat)) {
    wrap.append(el('div', { class: 'muted' }, categoryName(cat)));
    for (const r of pools) {
      wrap.append(el('div', { class: 'row spread' }, [
        el('span', { class: 'badge' }, r.ammoType),
        el('div', { class: 'row' }, [
          el('button', { class: 'icon', onclick: () => updateCharacter(c.id, (ch) => setReserveCount(ch, cat, r.ammoType, r.count - 1)) }, '−'),
          el('span', { class: 'count' }, String(r.count)),
          el('button', { class: 'icon', onclick: () => updateCharacter(c.id, (ch) => setReserveCount(ch, cat, r.ammoType, r.count + 1)) }, '+'),
          el('button', { class: 'icon danger', onclick: () => updateCharacter(c.id, (ch) => removeReserve(ch, cat, r.ammoType)) }, '🗑'),
        ]),
      ]));
    }
  }
  return wrap;
}

function addReservePrompt(c) {
  const cat = prompt(`Category ref (${Object.keys(AMMO_CATEGORIES).join(', ')}):`, 'ammo_rifles');
  if (!cat) return;
  const type = prompt(`Ammo type (${AMMO_TYPES.join(', ')}):`, 'regular');
  if (!type) return;
  const count = parseInt(prompt('Count:', '0') ?? '', 10);
  updateCharacter(c.id, (ch) => addReserve(ch, createReservePool({ ammoCategory: cat, ammoType: type, count: Number.isInteger(count) ? count : 0 })));
}

export function renderSheet(container, characterId) {
  const c = getState().characters.find((x) => x.id === characterId);
  if (!c) { container.append(el('div', { class: 'empty' }, 'Character not found.')); return; }

  container.append(el('div', { class: 'section-title' }, [
    el('h2', {}, 'Weapons'),
    el('button', {
      onclick: () => updateCharacter(c.id, (ch) => ({ ...ch, weapons: [...ch.weapons, createWeapon({ name: 'New Weapon', magazineCapacity: 10 })] })),
    }, '+ Weapon'),
  ]));

  if (c.weapons.length === 0) container.append(el('div', { class: 'empty' }, 'No weapons. Add one or import from XML.'));
  const list = el('div', { class: 'list' });
  for (const w of c.weapons) list.append(weaponCard(c, w));
  container.append(list);

  container.append(reserveSection(c));
}
