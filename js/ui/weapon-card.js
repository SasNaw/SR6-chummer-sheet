import { el } from './dom.js';
import { t } from '../app.js';
import {
  fire, spend, addRounds, setLoaded, reload, matchingReserves, updateWeapon, removeWeapon,
  weaponDisplayName, expandFiringModes,
} from '../model.js';
import { updateCharacter, findW, catName, typeNameL, modeLabel } from './sheet-common.js';
import { openAttackRatingModal, openAmmoSwitchModal } from './modals.js';
import { ATTACK_RATING_BANDS } from '../catalog.js';

// Renders as "10 / 9 / 8 / \u2014 / \u2014". A 0 band means the weapon has no rating at
// that range, which the SR6 books print as a dash.
function formatAttackRating(values) {
  const ar = Array.isArray(values) ? values : [];
  return Array.from({ length: ATTACK_RATING_BANDS },
    (_, i) => (ar[i] > 0 ? String(ar[i]) : '\u2014')).join(' / ');
}

export function weaponCard(c, w, { stashable = false } = {}) {
  const card = el('div', { class: 'card' });

  // Header: name + alias-edit button on the left, delete on the right.
  card.append(el('div', { class: 'row spread' }, [
    el('div', { class: 'row' }, [
      el('h2', {}, weaponDisplayName(w)),
      el('button', { class: 'icon', title: t('editAlias'), onclick: () => editAlias(c, w) }, '✎'),
    ]),
    el('button', {
      class: 'icon danger', title: t('remove'),
      onclick: () => { if (confirm(t('removeWeaponConfirm', weaponDisplayName(w)))) updateCharacter(c.id, (ch) => removeWeapon(ch, w.id)); },
    }, '🗑'),
  ]));

  // Attack rating across the five range bands, with an edit button for weapons
  // whose mods change the printed values. 0 means "no rating at that range".
  card.append(el('div', { class: 'row spread' }, [
    el('div', { class: 'ar', title: t('attackRatingTitle') }, [
      el('span', { class: 'ar-label' }, t('attackRating')),
      el('span', { class: 'ar-vals' }, formatAttackRating(w.attackRating)),
    ]),
    el('button', {
      class: 'icon', title: t('editAttackRating'),
      onclick: () => openAttackRatingModal(c, w),
    }, '✎'),
  ]));

  // Count + ammo-pool switcher
  card.append(el('div', { class: 'row spread' }, [
    el('div', { class: 'row count-row' }, [
      el('div', { class: 'count' }, [String(w.loaded.count), el('span', { class: 'cap' }, ` / ${w.magazineCapacity}`)]),
      el('span', { class: 'loaded-type' }, typeNameL(w.loaded.ammoType)),
    ]),
    ammoSwitcher(c, w),
  ]));

  // Firing-mode buttons (ammo-interacting → right-aligned). Derived centrally:
  // SS is added wherever SA is present and round costs come from the rules module.
  const modes = expandFiringModes(w.firingModes);
  if (modes.length) {
    card.append(el('div', { class: 'modes end' }, modes.map((m) =>
      el('button', { onclick: () => updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, fire(findW(ch, w.id), m.mode))) },
        `${modeLabel(m.mode)} (-${m.rounds})`))));
  }

  // Manual controls (ammo-interacting → right-aligned)
  card.append(el('div', { class: 'row end' }, [
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

// Opens the pool picker. A native <select> here rendered as a full-screen system
// dialog on Android and could not show a selection indicator, so the choice moved
// into a normal modal. Coloured warning-red when the weapon type has no reserve
// pools at all.
function ammoSwitcher(c, w) {
  const empty = matchingReserves(c, w.id).length === 0;
  return el('button', {
    class: empty ? 'ammo-empty' : null,
    title: empty ? t('noAmmoTitle') : t('ammoSwitchTitle'),
    onclick: () => openAmmoSwitchModal(c, w),
  }, t('switchAmmo'));
}

// Top up the currently-loaded type to capacity. Switching to a different type is
// done via the Switch button (ammoSwitcher -> openAmmoSwitchModal).
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

// Edit only the display alias. The weapon's base name (from the catalog/import or
// the add-weapon dialog) is fixed; the alias is shown as "Alias (Base Name)".
function editAlias(c, w) {
  const alias = prompt(t('aliasPrompt', w.name), w.alias || '');
  if (alias === null) return;
  updateCharacter(c.id, (ch) => updateWeapon(ch, w.id, { alias: alias.trim() }));
}
