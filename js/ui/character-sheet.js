import { el, openModal } from './dom.js';
import { getState, mutate } from '../app.js';
import {
  fire, spend, addRounds, setLoaded, reload, matchingReserves,
  updateWeapon, removeWeapon, addReserve, setReserveCount, removeReserve,
  createWeapon, createReservePool, upsertCharacter,
} from '../model.js';
import { AMMO_CATEGORIES, AMMO_TYPES, categoryName, typeName } from '../ammo-db.js';

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

  // Count + ammo-pool switcher
  card.append(el('div', { class: 'row spread' }, [
    el('div', { class: 'count' }, [String(w.loaded.count), el('span', { class: 'cap' }, ` / ${w.magazineCapacity}`)]),
    ammoSwitcher(c, w),
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

// Dropdown of the weapon's eligible reserve pools. Switching returns the rounds
// currently loaded to their origin pool, then reloads from the chosen pool
// (reload() does both). Falls back to a static badge when there are no pools.
function ammoSwitcher(c, w) {
  const pools = matchingReserves(c, w.id);
  if (pools.length === 0) return el('span', { class: 'badge' }, typeName(w.loaded.ammoType));

  const countByType = Object.fromEntries(pools.map((p) => [p.ammoType, p.count]));
  const types = pools.map((p) => p.ammoType);
  if (!types.includes(w.loaded.ammoType)) types.unshift(w.loaded.ammoType); // always show current

  const sel = el('select', {
    title: 'Switch ammo — returns loaded rounds to their pool, reloads from the chosen one',
    onchange: () => {
      if (sel.value !== w.loaded.ammoType) updateCharacter(c.id, (ch) => reload(ch, w.id, sel.value));
    },
  }, types.map((t) => el('option', { value: t },
    countByType[t] === undefined ? typeName(t) : `${typeName(t)} (${countByType[t]})`)));
  sel.value = w.loaded.ammoType;
  sel.style.width = 'auto';
  return sel;
}

// updateWeapon expects a `changes` object; we pass a whole new weapon (a superset merge).
// fire/spend/etc return a full weapon, so updateWeapon(ch, id, fullWeapon) shallow-merges all fields — correct.

// Top up the currently-loaded type to capacity. Switching to a different type is
// done via the ammo dropdown (ammoSwitcher).
function doReload(c, w) {
  const pools = matchingReserves(c, w.id);
  if (pools.length === 0) {
    alert(`No reserve ammo for ${categoryName(w.ammoCategory)}. Add a pool in the Reserve section or use Set.`);
    return;
  }
  if (!pools.some((p) => p.ammoType === w.loaded.ammoType)) {
    alert(`No ${typeName(w.loaded.ammoType)} in reserve. Pick an available type from the Ammo dropdown.`);
    return;
  }
  updateCharacter(c.id, (ch) => reload(ch, w.id, w.loaded.ammoType));
}

function editWeapon(c, w) {
  const name = prompt('Weapon name:', w.name);
  if (name == null) return;
  const cap = parseInt(prompt('Magazine capacity:', String(w.magazineCapacity)) ?? '', 10);
  const cat = prompt(`Ammo category ref (e.g. ${Object.keys(AMMO_CATEGORIES).join(', ')}):`, w.ammoCategory || '');
  const mount = prompt('Mount (carried or a vehicle name):', w.mount);
  const modesStr = prompt(
    'Firing modes as MODE:rounds, comma-separated (e.g. SA:1, BF:3, FA:6). Leave blank for none:',
    w.firingModes.map((m) => `${m.mode}:${m.rounds}`).join(', '));
  const notes = prompt('Notes:', w.notes);
  const changes = {
    name,
    magazineCapacity: Number.isInteger(cap) ? cap : w.magazineCapacity,
    ammoCategory: cat || null,
    mount: mount || 'carried',
    notes: notes !== null ? notes : w.notes,
  };
  if (modesStr !== null) {
    changes.firingModes = modesStr.split(',').map((part) => {
      const [mode, rounds] = part.split(':').map((s) => s.trim());
      return { mode, rounds: parseInt(rounds, 10) };
    }).filter((m) => m.mode && Number.isInteger(m.rounds) && m.rounds >= 0);
  }
  updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, changes));
}

function reserveSection(c) {
  const wrap = el('div', { class: 'card' });
  wrap.append(el('div', { class: 'section-title' }, [
    el('h2', {}, 'Reserve ammo'),
    el('button', { onclick: () => openAddPoolModal(c) }, '+ Pool'),
  ]));

  if (c.reserves.length === 0) {
    wrap.append(el('div', { class: 'muted' }, 'No spare ammo tracked.'));
  } else {
    // Group by category.
    const byCat = {};
    for (const r of c.reserves) (byCat[r.ammoCategory] ||= []).push(r);
    for (const [cat, pools] of Object.entries(byCat)) {
      wrap.append(el('div', { class: 'muted' }, categoryName(cat)));
      for (const r of pools) {
        wrap.append(el('div', { class: 'row spread' }, [
          el('span', { class: 'badge' }, typeName(r.ammoType)),
          el('div', { class: 'row' }, [
            el('button', { class: 'icon', onclick: () => updateCharacter(c.id, (ch) => setReserveCount(ch, cat, r.ammoType, r.count - 1)) }, '−'),
            el('span', { class: 'count' }, String(r.count)),
            el('button', { class: 'icon', onclick: () => updateCharacter(c.id, (ch) => setReserveCount(ch, cat, r.ammoType, r.count + 1)) }, '+'),
            el('button', { class: 'icon danger', onclick: () => updateCharacter(c.id, (ch) => removeReserve(ch, cat, r.ammoType)) }, '🗑'),
          ]),
        ]));
      }
    }
  }

  return wrap;
}

// Modal to add a pool: weapon + ammo-type dropdowns and a numbers-only amount.
// Selecting an existing (category, type) shows a live merge hint; Add calls
// addReserve, which merges into the existing pool.
function openAddPoolModal(c) {
  const catSel = el('select', {}, Object.entries(AMMO_CATEGORIES).map(([ref, name]) =>
    el('option', { value: ref }, name)));
  const typeSel = el('select', {}, AMMO_TYPES.map((code) =>
    el('option', { value: code }, typeName(code))));
  const amount = el('input', { type: 'text', inputmode: 'numeric', placeholder: 'Amount', value: '' });
  const hint = el('div', { class: 'hint' }, '');

  const updateHint = () => {
    const existing = c.reserves.find((r) => r.ammoCategory === catSel.value && r.ammoType === typeSel.value);
    if (existing) {
      const add = parseInt(amount.value, 10) || 0;
      hint.textContent = `Will merge into ${categoryName(catSel.value)} / ${typeName(typeSel.value)}: ${existing.count} → ${existing.count + add}`;
    } else {
      hint.textContent = '';
    }
  };
  catSel.addEventListener('change', updateHint);
  typeSel.addEventListener('change', updateHint);
  amount.addEventListener('input', () => {
    amount.value = amount.value.replace(/[^0-9]/g, ''); // numbers only
    updateHint();
  });
  updateHint();

  const close = openModal('Add ammo pool', [
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, 'Weapon'), catSel]),
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, 'Ammo type'), typeSel]),
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, 'Amount'), amount]),
    hint,
    el('div', { class: 'row spread' }, [
      el('button', { onclick: () => close() }, 'Cancel'),
      el('button', {
        class: 'accent',
        onclick: () => {
          const count = parseInt(amount.value, 10) || 0;
          close();
          updateCharacter(c.id, (ch) => addReserve(ch, createReservePool({
            ammoCategory: catSel.value, ammoType: typeSel.value, count,
          })));
        },
      }, 'Add'),
    ]),
  ]);
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
