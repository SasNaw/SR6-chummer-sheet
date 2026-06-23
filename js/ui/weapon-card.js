import { el } from './dom.js';
import { t } from '../app.js';
import {
  fire, spend, addRounds, setLoaded, reload, matchingReserves, updateWeapon, removeWeapon,
} from '../model.js';
import { AMMO_CATEGORIES } from '../ammo-db.js';
import { updateCharacter, findW, catName, typeNameL } from './sheet-common.js';

export function weaponCard(c, w, { stashable = false } = {}) {
  const card = el('div', { class: 'card' });

  // Header: name + edit/delete
  card.append(el('div', { class: 'row spread' }, [
    el('h2', {}, w.name),
    el('div', { class: 'row' }, [
      el('button', { class: 'icon', title: t('edit'), onclick: () => editWeapon(c, w) }, '✎'),
      el('button', {
        class: 'icon danger', title: t('remove'),
        onclick: () => { if (confirm(t('removeWeaponConfirm', w.name))) updateCharacter(c.id, (ch) => removeWeapon(ch, w.id)); },
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
        const n = parseInt(prompt(t('setLoadedPrompt'), String(w.loaded.count)) ?? '', 10);
        if (Number.isInteger(n)) updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, setLoaded(findW(ch, w.id), n)));
      },
    }, t('set')),
    el('button', { class: 'accent', onclick: () => doReload(c, w) }, t('reload')),
  ]));

  if (w.notes) card.append(el('div', { class: 'muted' }, w.notes));

  // Equipped/unequipped toggle, bottom-right (runner weapons only)
  if (stashable) {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = !w.stashed; // checked = equipped, unchecked = unequipped
    cb.addEventListener('change', () =>
      updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, { stashed: !cb.checked })));
    card.append(el('div', { class: 'card-foot' }, el('label', { class: 'carried-toggle' }, [cb, t('equipped')])));
  }

  return card;
}

// Dropdown of the weapon's eligible reserve pools. Switching returns the rounds
// currently loaded to their origin pool, then reloads from the chosen pool
// (reload() does both). When the weapon type has no reserve pools at all, the same
// dropdown is shown but coloured warning-red.
function ammoSwitcher(c, w) {
  const pools = matchingReserves(c, w.id);
  const empty = pools.length === 0;
  const countByType = Object.fromEntries(pools.map((p) => [p.ammoType, p.count]));
  const types = pools.map((p) => p.ammoType);
  if (!types.includes(w.loaded.ammoType)) types.unshift(w.loaded.ammoType); // always show current

  const sel = el('select', {
    class: empty ? 'ammo-empty' : null,
    title: empty ? t('noAmmoTitle') : t('ammoSwitchTitle'),
    onchange: () => {
      if (sel.value !== w.loaded.ammoType) updateCharacter(c.id, (ch) => reload(ch, w.id, sel.value));
    },
  }, types.map((code) => el('option', { value: code },
    `${typeNameL(code)} (${countByType[code] ?? 0})`))); // missing pool reads as 0
  sel.value = w.loaded.ammoType;
  sel.style.width = 'auto';
  return sel;
}

// Top up the currently-loaded type to capacity. Switching to a different type is
// done via the ammo dropdown (ammoSwitcher).
function doReload(c, w) {
  const pools = matchingReserves(c, w.id);
  if (pools.length === 0) {
    alert(t('noReserveForCategory', catName(w.ammoCategory)));
    return;
  }
  if (!pools.some((p) => p.ammoType === w.loaded.ammoType)) {
    alert(t('noTypeInReserve', typeNameL(w.loaded.ammoType)));
    return;
  }
  updateCharacter(c.id, (ch) => reload(ch, w.id, w.loaded.ammoType));
}

function editWeapon(c, w) {
  const name = prompt(t('weaponNamePrompt'), w.name);
  if (name == null) return;
  const cap = parseInt(prompt(t('magazineCapacityPrompt'), String(w.magazineCapacity)) ?? '', 10);
  const cat = prompt(t('ammoCategoryPrompt', Object.keys(AMMO_CATEGORIES).join(', ')), w.ammoCategory || '');
  const mount = prompt(t('mountPrompt'), w.mount);
  const modesStr = prompt(t('firingModesPrompt'), w.firingModes.map((m) => `${m.mode}:${m.rounds}`).join(', '));
  const notes = prompt(t('notesPrompt'), w.notes);
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
