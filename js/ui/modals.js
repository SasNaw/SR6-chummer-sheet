import { el, openModal } from './dom.js';
import { t } from '../app.js';
import { addReserve, createReservePool, addDrone, createWeapon, addWeapon } from '../model.js';
import { AMMO_CATEGORIES, AMMO_TYPES } from '../ammo-db.js';
import { getCatalog, catalogWeaponList } from '../catalog.js';
import { updateCharacter, catName, typeNameL, uiLang, STANDARD_FIRING_MODES } from './sheet-common.js';

// Modal to add a pool: weapon + ammo-type dropdowns and a numbers-only amount.
// Selecting an existing (category, type) shows a live merge hint; Add calls
// addReserve, which merges into the existing pool.
export function openAddPoolModal(c) {
  // Built-in categories plus any category the character's weapons actually use
  // (catalog-imported weapons may reference categories outside the built-in set).
  const cats = [...new Set([
    ...Object.keys(AMMO_CATEGORIES),
    ...c.weapons.map((w) => w.ammoCategory).filter(Boolean),
  ])];
  const catSel = el('select', {}, cats.map((ref) => el('option', { value: ref }, catName(ref))));
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
