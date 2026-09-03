import { el, clear, openModal } from './dom.js';
import { t } from '../app.js';
import {
  addReserve, createReservePool, addDrone, createWeapon, addWeapon,
  createSpirit, addSpirit, optionalPowerCap, setAttackRating, updateWeapon,
  matchingReserves, reload,
} from '../model.js';
import { getCatalog, catalogWeaponList } from '../catalog.js';
import { getSpiritCatalog, spiritList, localizedPair } from '../spirit-catalog.js';
import { updateCharacter, findW, catName, typeNameL, uiLang, STANDARD_FIRING_MODES, modeLabel, ammoCategoryIds, ammoTypeIds } from './sheet-common.js';

// Build category/type <option>s sorted by their localized label.
const byLabel = (fn) => (a, b) => fn(a).localeCompare(fn(b));
function categoryOptions(extra = []) {
  return [...new Set([...ammoCategoryIds(), ...extra])].sort(byLabel(catName))
    .map((ref) => el('option', { value: ref }, catName(ref)));
}
function typeOptions() {
  return ammoTypeIds().slice().sort(byLabel(typeNameL))
    .map((code) => el('option', { value: code }, typeNameL(code)));
}

// Inline −/value/+ stepper — a mobile-friendly numeric input (big tap targets
// instead of the tiny native <input type=number> spinners). Returns the node and
// a getter; calls onChange(value) after each step.
function stepper(initial, { min = 0, onChange } = {}) {
  let v = initial;
  const val = el('span', { class: 'stepper-val' }, String(v));
  const step = (d) => { v = Math.max(min, v + d); val.textContent = String(v); if (onChange) onChange(v); };
  const node = el('span', { class: 'stepper' }, [
    el('button', { type: 'button', class: 'icon', onclick: () => step(-1) }, '−'),
    val,
    el('button', { type: 'button', class: 'icon', onclick: () => step(1) }, '+'),
  ]);
  return { node, get: () => v };
}

// Modal to add a pool: weapon + ammo-type dropdowns and a numbers-only amount.
// Selecting an existing (category, type) shows a live merge hint; Add calls
// addReserve, which merges into the existing pool.
export function openAddPoolModal(c) {
  // Catalog (or built-in) categories, plus any category the character's weapons
  // actually use, so every relevant pool is addable.
  const catSel = el('select', {}, categoryOptions(c.weapons.map((w) => w.ammoCategory).filter(Boolean)));
  const typeSel = el('select', {}, typeOptions());
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

// Pick which reserve pool the weapon reloads from. Selecting a different type
// runs reload(), which first returns the rounds currently loaded to their own
// pool and then fills from the chosen one — so nothing is lost by switching.
export function openAmmoSwitchModal(c, w) {
  const pools = matchingReserves(c, w.id);
  // The loaded type is always listed, even with no pool behind it, so the dialog
  // always shows what is actually chambered.
  const types = pools.map((p) => p.ammoType);
  if (!types.includes(w.loaded.ammoType)) types.unshift(w.loaded.ammoType);
  const countByType = Object.fromEntries(pools.map((p) => [p.ammoType, p.count]));

  // No pool matches this weapon's category: the only listable type would be the
  // loaded one at (0), which cannot be switched to. Say so instead.
  if (pools.length === 0) {
    const closeEmpty = openModal(t('switchAmmoTitle'), [
      el('div', { class: 'muted' }, t('noPoolsToSwitch')),
      el('div', { class: 'row spread' }, [el('button', { onclick: () => closeEmpty() }, t('cancel'))]),
    ]);
    return;
  }

  const radios = types.map((code) => {
    const input = el('input', { type: 'radio', name: 'ammo-switch', value: code });
    input.checked = code === w.loaded.ammoType;
    return { code, input };
  });

  const close = openModal(t('switchAmmoTitle'), [
    el('div', { class: 'field' }, [
      el('span', { class: 'muted' }, t('ammoType')),
      el('div', { class: 'pick-list', role: 'radiogroup', 'aria-label': t('ammoType') },
        radios.map(({ code, input }) =>
          el('label', { class: 'pick-row' }, [input, `${typeNameL(code)} (${countByType[code] ?? 0})`]))),
    ]),
    el('div', { class: 'row spread' }, [
      el('button', { onclick: () => close() }, t('cancel')),
      el('button', {
        class: 'accent',
        onclick: () => {
          const chosen = (radios.find((r) => r.input.checked) || {}).code;
          close();
          // Same guard the old <select> had: switching to what is already loaded
          // would otherwise top the magazine up as a side effect.
          if (!chosen || chosen === w.loaded.ammoType) return;
          updateCharacter(c.id, (ch) => reload(ch, w.id, chosen));
        },
      }, t('switchAmmo')),
    ]),
  ]);
}

// Edit a weapon's attack rating across the five SR6 range bands. Values come
// from the catalog, but mods change them, so every band is editable. An empty
// field saves as 0, which the card renders as an em dash.
export function openAttackRatingModal(c, w) {
  const bands = ['arClose', 'arNear', 'arMedium', 'arFar', 'arExtreme'];
  const current = Array.isArray(w.attackRating) ? w.attackRating : [];

  const inputs = bands.map((key, i) => {
    const input = el('input', {
      type: 'text', inputmode: 'numeric', 'aria-label': t(key),
      value: current[i] > 0 ? String(current[i]) : '',
    });
    input.addEventListener('input', () => { input.value = input.value.replace(/[^0-9]/g, ''); });
    return input;
  });

  const close = openModal(t('attackRatingTitle'), [
    el('div', { class: 'ar-fields' }, bands.map((key, i) =>
      el('label', { class: 'field' }, [el('span', { class: 'muted' }, t(key)), inputs[i]]))),
    el('div', { class: 'muted' }, t('arBlankHint')),
    el('div', { class: 'row spread' }, [
      el('button', { onclick: () => close() }, t('cancel')),
      el('button', {
        class: 'accent',
        onclick: () => {
          const values = inputs.map((n) => n.value);
          close();
          // setAttackRating returns a whole weapon, which updateWeapon merges.
          updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, setAttackRating(findW(ch, w.id), values)));
        },
      }, t('save')),
    ]),
  ]);
}

// Modal to add a drone: just a name. Appended to the bottom of the Drones section.
export function openAddDroneModal(c) {
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
export function openAddWeaponModal(c, mount) {
  const nameInput = el('input', { type: 'text', placeholder: t('weaponNamePlaceholder') });
  const typeSel = el('select', {}, categoryOptions());
  const capInput = el('input', { type: 'text', inputmode: 'numeric', placeholder: 'e.g. 20', value: '' });
  capInput.addEventListener('input', () => { capInput.value = capInput.value.replace(/[^0-9]/g, ''); });

  // Firing-mode toggle buttons (tagged with their mode for catalog autofill).
  const selected = new Set();
  const modeButtons = STANDARD_FIRING_MODES.map((m) => {
    const btn = el('button', { type: 'button', class: 'toggle', 'data-mode': m.mode }, `${modeLabel(m.mode)} (${m.rounds})`);
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
  let picked = null; // the catalog entry, when the weapon came from the picker

  // Optional catalog picker: autocomplete weapon names -> autofill the fields.
  //
  // Deliberately NOT a native <datalist>: Firefox for Android ignores it entirely
  // (the field degrades to a plain text input) and it is broken in Android WebView
  // 8+, which is what an installed PWA can end up running in. Since this app is
  // mobile-first, the suggestion list is plain DOM we render ourselves, so it
  // behaves identically on every engine.
  const catalog = getCatalog();
  if (catalog) {
    const entries = catalogWeaponList(catalog, uiLang());
    const byLabel = new Map(entries.map((e) => [e.label, e]));

    const finder = el('input', {
      type: 'text', placeholder: t('findWeapon'), 'aria-label': t('findWeapon'),
      role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false',
      'aria-controls': 'addweapon-suggest',
      autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
    });
    const list = el('div', { class: 'suggest', id: 'addweapon-suggest', role: 'listbox' });
    list.hidden = true;

    // Fold case and diacritics so "prazision" also finds "Präzisionsgewehr".
    const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const MAX_SUGGESTIONS = 50; // keep the list scannable (and cheap) on a phone
    let shown = [];
    let active = -1;

    const applyPick = (e) => {
      picked = e;   // carries the catalog id and attack rating onto the new weapon
      nameInput.value = e.label;
      capInput.value = String(e.magazineCapacity ?? '');
      if (e.ammoCategory) {
        if (![...typeSel.options].some((o) => o.value === e.ammoCategory)) {
          typeSel.append(el('option', { value: e.ammoCategory }, catName(e.ammoCategory)));
        }
        typeSel.value = e.ammoCategory;
      }
      for (const m of STANDARD_FIRING_MODES) setMode(m.mode, (e.firingModes || []).includes(m.mode));
    };

    function closeList() {
      clear(list);
      list.hidden = true;
      finder.setAttribute('aria-expanded', 'false');
      finder.removeAttribute('aria-activedescendant');
      shown = [];
      active = -1;
    }

    function highlight(i) {
      const rows = [...list.children];
      if (rows.length === 0) return;
      active = (i + rows.length) % rows.length;
      rows.forEach((r, n) => {
        const on = n === active;
        r.classList.toggle('active', on);
        r.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      finder.setAttribute('aria-activedescendant', rows[active].id);
      rows[active].scrollIntoView({ block: 'nearest' });
    }

    function choose(e) {
      finder.value = e.label;
      applyPick(e);
      closeList();
    }

    function openList() {
      const q = norm(finder.value.trim());
      shown = (q ? entries.filter((e) => norm(e.label).includes(q)) : entries).slice(0, MAX_SUGGESTIONS);
      clear(list);
      if (shown.length === 0) { closeList(); return; }
      shown.forEach((e, i) => {
        // A div, not a button: openModal's focus trap cycles every button in the
        // dialog, and 50 of them would bury Cancel/Add behind the suggestions.
        const row = el('div', { class: 'suggest-item', role: 'option', id: `sug-${i}`, 'aria-selected': 'false' }, e.label);
        row.addEventListener('click', () => choose(e));
        list.append(row);
      });
      list.hidden = false;
      finder.setAttribute('aria-expanded', 'true');
      active = -1;
    }

    // No blur handler on purpose: hiding the list on blur races the tap that
    // picks a row on touch devices, and closing on scroll would make a long list
    // unusable. It closes on pick, on Escape, or with the modal itself.
    finder.addEventListener('focus', openList);
    finder.addEventListener('input', () => {
      openList();
      // Keep the old behaviour for a pasted/typed exact name.
      const exact = byLabel.get(finder.value);
      if (exact) applyPick(exact);
    });
    finder.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !list.hidden) {
        closeList();
        ev.stopPropagation(); // otherwise openModal's handler closes the dialog
        return;
      }
      if (list.hidden) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); highlight(active + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); highlight(active - 1); }
      else if (ev.key === 'Enter' && active >= 0) { ev.preventDefault(); choose(shown[active]); }
    });

    fields.push(el('div', { class: 'field' }, [el('span', { class: 'muted' }, t('findWeapon')), finder, list]));
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
            ref: (picked && picked.id) || '',
            attackRating: (picked && picked.attackRating) || [],
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

// Modal to summon a spirit from the loaded spirit catalog: name, type, Force, and
// an optional-powers selection capped at floor(Force/3). The card is built from a
// snapshot of the chosen catalog entry (see createSpirit). Only opened when a
// spirit catalog is loaded.
export function openAddSpiritModal(c) {
  const spirits = spiritList(getSpiritCatalog(), uiLang()); // [{ id, label, spirit }]
  if (spirits.length === 0) return;

  const nameInput = el('input', { type: 'text', placeholder: t('spiritNamePlaceholder') });
  const typeSel = el('select', {}, spirits.map((s) => el('option', { value: s.id }, s.label)));
  const forceStepper = stepper(3, { min: 1, onChange: () => rebuildOptional() });
  const servicesStepper = stepper(1, { min: 0 });
  const optBox = el('div', { class: 'pick-list' });
  const countLabel = el('div', { class: 'muted' }, '');

  const selected = new Set(); // keyed by an optional power's English name
  const spiritOf = (id) => (spirits.find((s) => s.id === id) || {}).spirit;
  const force = () => forceStepper.get();

  function rebuildOptional() {
    const sp = spiritOf(typeSel.value);
    const opts = (sp && sp.optionalPowers) || [];
    const cap = optionalPowerCap(force());
    clear(optBox);
    for (const p of opts) {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = selected.has(p.en);
      cb.disabled = !cb.checked && selected.size >= cap;
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(p.en); else selected.delete(p.en);
        rebuildOptional();
      });
      optBox.append(el('label', { class: 'pick-row' }, [cb, localizedPair(p, uiLang())]));
    }
    countLabel.textContent = t('optionalPowersCount', selected.size, cap);
  }
  typeSel.addEventListener('change', () => { selected.clear(); rebuildOptional(); });
  rebuildOptional();

  const close = openModal(t('addSpiritTitle'), [
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, t('name')), nameInput]),
    el('label', { class: 'field' }, [el('span', { class: 'muted' }, t('spiritType')), typeSel]),
    el('div', { class: 'field' }, [el('span', { class: 'muted' }, t('force')), forceStepper.node]),
    el('div', { class: 'field' }, [el('span', { class: 'muted' }, t('services')), servicesStepper.node]),
    el('div', { class: 'field' }, [el('span', { class: 'muted' }, t('optionalPowersLabel')), optBox, countLabel]),
    el('div', { class: 'row spread' }, [
      el('button', { onclick: () => close() }, t('cancel')),
      el('button', {
        class: 'accent',
        onclick: () => {
          const sp = spiritOf(typeSel.value);
          if (!sp) return;
          const spirit = createSpirit({
            name: nameInput.value.trim(), type: sp.id, typeName: sp.name, force: Math.max(1, force()),
            services: servicesStepper.get(),
            attributes: sp.attributes, conditionMonitor: sp.conditionMonitor,
            initiative: sp.initiative, astralInitiative: sp.astralInitiative,
            actions: sp.actions, movement: sp.movement,
            skills: sp.skills, powers: sp.powers,
            optionalPowers: (sp.optionalPowers || []).filter((p) => selected.has(p.en)),
            weaknesses: sp.weaknesses,
          });
          close();
          updateCharacter(c.id, (ch) => addSpirit(ch, spirit));
        },
      }, t('add')),
    ]),
  ]);
}
