import { el, openModal } from './dom.js';
import { getState, mutate, t } from '../app.js';
import {
  fire, spend, addRounds, setLoaded, reload, matchingReserves,
  updateWeapon, removeWeapon, addWeapon, addReserve, setReserveCount, removeReserve,
  createWeapon, createReservePool, upsertCharacter, addDrone, removeDrone,
} from '../model.js';
import { AMMO_CATEGORIES, AMMO_TYPES, categoryName, typeName } from '../ammo-db.js';
import { getCatalog, catalogCategoryName, catalogTypeName, catalogWeaponList } from '../catalog.js';

// Standard SR6 firing modes offered when creating a weapon (round cost per mode;
// editable later via the weapon's edit dialog).
const STANDARD_FIRING_MODES = [
  { mode: 'SS', rounds: 1 },
  { mode: 'SA', rounds: 1 },
  { mode: 'BF', rounds: 3 },
  { mode: 'FA', rounds: 6 },
];

// Localized display names: English uses our built-in tables; German prefers the
// loaded catalog's translations, falling back to English.
function uiLang() { return getState().lang || 'en'; }
function catName(ref) {
  return uiLang() === 'de' ? (catalogCategoryName(getCatalog(), ref, 'de') || categoryName(ref)) : categoryName(ref);
}
function typeNameL(code) {
  return uiLang() === 'de' ? (catalogTypeName(getCatalog(), code, 'de') || typeName(code)) : typeName(code);
}

// Apply a Character->Character transform to the active character.
function updateCharacter(characterId, fn) {
  mutate((s) => {
    const c = s.characters.find((x) => x.id === characterId);
    if (!c) return s;
    return { ...s, characters: upsertCharacter(s.characters, fn(c)) };
  });
}

function weaponCard(c, w, { stashable = false } = {}) {
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

function findW(character, weaponId) {
  return character.weapons.find((x) => x.id === weaponId);
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
  }, types.map((t) => el('option', { value: t },
    `${typeNameL(t)} (${countByType[t] ?? 0})`))); // missing pool reads as 0
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

function reserveSection(c) {
  // Reserve ammo lives outside a card, in the same grouped style as Weapons/Drones.
  // Here the weapon type (category) is the sub-header and the ammo type is the
  // muted row label — the reverse emphasis from the weapon cards.
  const wrap = el('div', { class: 'group' });
  wrap.append(el('div', { class: 'section-title' }, [
    el('h2', {}, t('reserveAmmo')),
    el('button', { onclick: () => openAddPoolModal(c) }, t('addPool')),
  ]));

  if (c.reserves.length === 0) {
    wrap.append(el('div', { class: 'muted' }, t('noSpareAmmo')));
  } else {
    // Group by category.
    const byCat = {};
    for (const r of c.reserves) (byCat[r.ammoCategory] ||= []).push(r);
    for (const [cat, pools] of Object.entries(byCat)) {
      wrap.append(el('div', { class: 'subgroup-title' }, catName(cat)));
      for (const r of pools) {
        wrap.append(el('div', { class: 'row spread' }, [
          el('span', { class: 'muted' }, typeNameL(r.ammoType)),
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
  const catSel = el('select', {}, Object.keys(AMMO_CATEGORIES).map((ref) =>
    el('option', { value: ref }, catName(ref))));
  const typeSel = el('select', {}, AMMO_TYPES.map((code) =>
    el('option', { value: code }, typeNameL(code))));
  const amount = el('input', { type: 'text', inputmode: 'numeric', placeholder: t('amount'), value: '' });
  const hint = el('div', { class: 'hint' }, '');

  const updateHint = () => {
    const existing = c.reserves.find((r) => r.ammoCategory === catSel.value && r.ammoType === typeSel.value);
    if (existing) {
      const add = parseInt(amount.value, 10) || 0;
      hint.textContent = t('mergeHint', catName(catSel.value), typeNameL(typeSel.value), existing.count, existing.count + add);
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

  const close = openModal(t('addAmmoPool'), [
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, t('weapon')), catSel]),
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, t('ammoType')), typeSel]),
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, t('amount')), amount]),
    hint,
    el('div', { class: 'row spread' }, [
      el('button', { onclick: () => close() }, t('cancel')),
      el('button', {
        class: 'accent',
        onclick: () => {
          const count = parseInt(amount.value, 10) || 0;
          close();
          updateCharacter(c.id, (ch) => addReserve(ch, createReservePool({
            ammoCategory: catSel.value, ammoType: typeSel.value, count,
          })));
        },
      }, t('add')),
    ]),
  ]);
}

// All drone names for this character: the explicit drones list unioned with any
// drone referenced by a weapon's mount (preserves explicit order, new ones last).
function droneNames(c) {
  return [...new Set([
    ...(c.drones ?? []),
    ...c.weapons.filter((w) => w.mount !== 'carried').map((w) => w.mount),
  ])];
}

// Modal to add a drone: just a name. Appended to the bottom of the Drones section.
function openAddDroneModal(c) {
  const nameInput = el('input', { type: 'text', placeholder: t('droneNamePlaceholder') });
  const close = openModal(t('addDroneTitle'), [
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, t('name')), nameInput]),
    el('div', { class: 'row spread' }, [
      el('button', { onclick: () => close() }, t('cancel')),
      el('button', {
        class: 'accent',
        onclick: () => {
          const name = nameInput.value.trim();
          if (!name) return;
          close();
          updateCharacter(c.id, (ch) => addDrone(ch, name));
        },
      }, t('add')),
    ]),
  ]);
}

// Modal to create a weapon: name, weapon type (ammo category), capacity, and
// toggle buttons for available firing modes. `mount` ('carried' or a drone name)
// is set by which "+ Weapon" button opened it.
function openAddWeaponModal(c, mount) {
  const nameInput = el('input', { type: 'text', placeholder: t('weaponNamePlaceholder') });
  const typeSel = el('select', {}, Object.keys(AMMO_CATEGORIES).map((ref) =>
    el('option', { value: ref }, catName(ref))));
  const capInput = el('input', { type: 'text', inputmode: 'numeric', placeholder: 'e.g. 20', value: '' });
  capInput.addEventListener('input', () => { capInput.value = capInput.value.replace(/[^0-9]/g, ''); });

  // Firing-mode toggle buttons (tagged with their mode for catalog autofill).
  const selected = new Set();
  const modeButtons = STANDARD_FIRING_MODES.map((m) => {
    const btn = el('button', { type: 'button', class: 'toggle', 'data-mode': m.mode }, `${m.mode} (${m.rounds})`);
    btn.addEventListener('click', () => {
      if (selected.has(m.mode)) { selected.delete(m.mode); btn.classList.remove('on'); }
      else { selected.add(m.mode); btn.classList.add('on'); }
    });
    return btn;
  });
  const setMode = (mode, on) => {
    const btn = modeButtons.find((b) => b.getAttribute('data-mode') === mode);
    if (!btn) return;
    if (on) { selected.add(mode); btn.classList.add('on'); } else { selected.delete(mode); btn.classList.remove('on'); }
  };

  const fields = [];

  // Optional catalog picker: autocomplete weapon names -> autofill the fields.
  const catalog = getCatalog();
  if (catalog) {
    const entries = catalogWeaponList(catalog, uiLang());
    const byLabel = new Map(entries.map((e) => [e.label, e]));
    const dl = el('datalist', { id: 'addweapon-catalog' }, entries.map((e) => el('option', { value: e.label })));
    const finder = el('input', { type: 'text', placeholder: t('findWeapon'), list: 'addweapon-catalog', autocomplete: 'off' });
    // 'input' fires immediately when an option is chosen from the datalist (and
    // on each keystroke); we autofill as soon as the value matches a catalog name.
    finder.addEventListener('input', () => {
      const e = byLabel.get(finder.value);
      if (!e) return;
      nameInput.value = e.label;
      capInput.value = String(e.magazineCapacity ?? '');
      if (e.ammoCategory) {
        if (![...typeSel.options].some((o) => o.value === e.ammoCategory)) {
          typeSel.append(el('option', { value: e.ammoCategory }, catName(e.ammoCategory)));
        }
        typeSel.value = e.ammoCategory;
      }
      for (const m of STANDARD_FIRING_MODES) setMode(m.mode, (e.firingModes || []).includes(m.mode));
    });
    fields.push(el('label', { class: 'field' }, [el('span', { class: 'muted' }, t('findWeapon')), finder]), dl);
  }

  fields.push(
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, t('name')), nameInput]),
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, t('weaponType')), typeSel]),
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, t('maxAmmoCapacity')), capInput]),
    el('div', { class: 'field' }, [el('span', { class: 'muted' }, t('firingModes')), el('div', { class: 'modes' }, modeButtons)]),
    el('div', { class: 'row spread' }, [
      el('button', { onclick: () => close() }, t('cancel')),
      el('button', {
        class: 'accent',
        onclick: () => {
          const weapon = createWeapon({
            name: nameInput.value.trim() || 'New Weapon',
            ammoCategory: typeSel.value,
            magazineCapacity: Math.max(0, parseInt(capInput.value, 10) || 0),
            mount,
            firingModes: STANDARD_FIRING_MODES.filter((m) => selected.has(m.mode)).map((m) => ({ ...m })),
          });
          close();
          updateCharacter(c.id, (ch) => addWeapon(ch, weapon));
        },
      }, t('add')),
    ]),
  );

  const close = openModal(t('addWeaponTitle'), fields);
}

function weaponList(c, weapons, stashable) {
  const list = el('div', { class: 'list' });
  for (const w of weapons) list.append(weaponCard(c, w, { stashable }));
  return list;
}

export function renderSheet(container, characterId) {
  const c = getState().characters.find((x) => x.id === characterId);
  if (!c) { container.append(el('div', { class: 'empty' }, t('characterNotFound'))); return; }

  // Runner weapons (personally carried) vs drone-mounted weapons.
  const runner = c.weapons.filter((w) => w.mount === 'carried');
  const carrying = runner.filter((w) => !w.stashed);
  const stashed = runner.filter((w) => w.stashed);
  const droneList = droneNames(c);

  // Runner section: <name> with Carrying / Stashed sub-headers.
  container.append(el('div', { class: 'group' }, [
    el('div', { class: 'section-title' }, [
      el('h2', {}, t('weapons')),
      el('button', { onclick: () => openAddWeaponModal(c, 'carried') }, t('addWeapon')),
    ]),
    el('div', { class: 'subgroup-title' }, t('equipped')),
    carrying.length ? weaponList(c, carrying, true) : el('div', { class: 'muted' }, t('nothingEquipped')),
    el('div', { class: 'subgroup-title' }, t('unequipped')),
    stashed.length ? weaponList(c, stashed, true) : el('div', { class: 'muted' }, t('nothingUnequipped')),
  ]));

  // Drones section: + Drone button; a sub-header per drone with a delete control.
  const droneChildren = [el('div', { class: 'section-title' }, [
    el('h2', {}, t('drones')),
    el('button', { onclick: () => openAddDroneModal(c) }, t('addDrone')),
  ])];
  if (droneList.length === 0) {
    droneChildren.push(el('div', { class: 'muted' }, t('noDrones')));
  } else {
    for (const name of droneList) {
      const weapons = c.weapons.filter((w) => w.mount === name);
      droneChildren.push(el('div', { class: 'row spread' }, [
        el('span', { class: 'subgroup-title' }, name),
        el('div', { class: 'row' }, [
          el('button', { onclick: () => openAddWeaponModal(c, name) }, t('addWeapon')),
          el('button', {
            class: 'icon danger', title: t('deleteDrone'),
            onclick: () => {
              if (confirm(t('deleteDroneConfirm', name, weapons.length))) {
                updateCharacter(c.id, (ch) => removeDrone(ch, name));
              }
            },
          }, '🗑'),
        ]),
      ]));
      droneChildren.push(weapons.length ? weaponList(c, weapons, false) : el('div', { class: 'muted' }, t('noWeapons')));
    }
  }
  container.append(el('div', { class: 'group' }, droneChildren));

  // Reserve ammo: its own top-level section.
  container.append(reserveSection(c));
}
