import { el, clear, openModal } from './dom.js';
import { t } from '../app.js';
import {
  addReserve, createReservePool, addDrone, createWeapon, addWeapon,
  createSpirit, addSpirit, optionalPowerCap,
} from '../model.js';
import { getCatalog, catalogWeaponList } from '../catalog.js';
import { getSpiritCatalog, spiritList, localizedPair } from '../spirit-catalog.js';
import { updateCharacter, catName, typeNameL, uiLang, STANDARD_FIRING_MODES, ammoCategoryIds, ammoTypeIds } from './sheet-common.js';

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
    // Autofill as soon as the value matches a catalog name. Bound to both 'input'
    // and 'change' so picking a datalist suggestion fills immediately on every
    // browser (some fire only one of the two).
    const applyPick = () => {
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
    };
    finder.addEventListener('input', applyPick);
    finder.addEventListener('change', applyPick);
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
  const optBox = el('div', { class: 'opt-powers' });
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
      optBox.append(el('label', { class: 'opt-power' }, [cb, localizedPair(p, uiLang())]));
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
