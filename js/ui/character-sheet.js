import { el } from './dom.js';
import { getState, t } from '../app.js';
import { setReserveCount, removeReserve, removeDrone } from '../model.js';
import { updateCharacter, catName, typeNameL, droneNames } from './sheet-common.js';
import { weaponCard } from './weapon-card.js';
import { openAddWeaponModal, openAddDroneModal, openAddPoolModal } from './modals.js';

function weaponList(c, weapons, stashable) {
  const list = el('div', { class: 'list' });
  for (const w of weapons) list.append(weaponCard(c, w, { stashable }));
  return list;
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
            el('button', {
              class: 'icon danger', title: t('remove'),
              onclick: () => {
                if (confirm(t('removeReserveConfirm', typeNameL(r.ammoType), catName(cat), r.count))) {
                  updateCharacter(c.id, (ch) => removeReserve(ch, cat, r.ammoType));
                }
              },
            }, '🗑'),
          ]),
        ]));
      }
    }
  }

  return wrap;
}

export function renderSheet(container, characterId) {
  const c = getState().characters.find((x) => x.id === characterId);
  if (!c) { container.append(el('div', { class: 'empty' }, t('characterNotFound'))); return; }

  // Runner weapons (personally carried) vs drone-mounted weapons.
  const runner = c.weapons.filter((w) => w.mount === 'carried');
  const carrying = runner.filter((w) => !w.stashed);
  const stashed = runner.filter((w) => w.stashed);
  const droneList = droneNames(c);

  // Runner section: Weapons with Equipped / Unequipped sub-headers.
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
