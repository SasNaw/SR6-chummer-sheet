import { el } from './dom.js';
import { getState, t, rerender } from '../app.js';
import { setReserveCount, removeReserve } from '../model.js';
import { updateCharacter, catName, typeNameL } from './sheet-common.js';
import { weaponCard } from './weapon-card.js';
import { spiritCard } from './spirit-card.js';
import { getSpiritCatalog } from '../spirit-catalog.js';
import { openWeaponModal, openDroneModal, openAddPoolModal, openSpiritModal } from './modals.js';
import { droneCard } from './drone-card.js';
import { rccCard } from './rcc-card.js';

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

// Which top-level tab (weapons | drones | magic) is showing, and for which character.
// View-only state: it resets to weapons when a different character is opened, and
// survives the full re-render on each mutation. Not persisted.
let activeTab = 'weapons';
let activeTabCharId = null;

export function renderSheet(container, characterId) {
  const c = getState().characters.find((x) => x.id === characterId);
  if (!c) { container.append(el('div', { class: 'empty' }, t('characterNotFound'))); return; }

  if (characterId !== activeTabCharId) { activeTab = 'weapons'; activeTabCharId = characterId; }
  const magical = !!c.magic;
  // The Magic tab only exists for magical characters; fall back to weapons
  // otherwise. The Drones tab is always there (it is where drones are added).
  const tab = (magical && activeTab === 'magic') ? 'magic'
    : activeTab === 'drones' ? 'drones' : 'weapons';

  const tabBtn = (id, label) => el('button', {
    class: id === tab ? 'tab active' : 'tab',
    role: 'tab', 'aria-selected': id === tab ? 'true' : 'false',
    onclick: id === tab ? null : () => { activeTab = id; rerender(); },
  }, label);

  // The whole sheet is colour-themed by section: weapons keeps the amber accent,
  // magic re-points --accent to blue and drones to green, so every accent-derived
  // element recolours.
  const theme = { magic: ' theme-magic', drones: ' theme-drones' }[tab] || '';
  const sheet = el('div', { class: `sheet${theme}` });

  // Clickable section tabs, with the tab's contextual add action on the right:
  // + Weapon on Weapons, + Drone on Drones.
  sheet.append(el('div', { class: 'tabs' }, [
    el('div', { class: 'tablist', role: 'tablist' }, [
      tabBtn('weapons', t('weapons')),
      tabBtn('drones', t('drones')),
      magical ? tabBtn('magic', t('magic')) : null,
    ]),
    tab === 'weapons'
      ? el('button', { onclick: () => openWeaponModal(c, { mount: 'carried' }) }, t('addWeapon'))
      : tab === 'drones'
        ? el('button', { onclick: () => openDroneModal(c) }, t('addDrone'))
        : null,
  ]));

  if (tab === 'magic') {
    magicTab(sheet, c);
  } else if (tab === 'drones') {
    dronesTab(sheet, c);
  } else {
    weaponsTab(sheet, c);
  }

  container.append(sheet);
}

// Drones tab, in three headed sections like Reserve ammo: RCCs (the rigger
// command console, if the character has one); Drones, one card per drone that
// also holds the weapons mounted on it (inset weapon cards) and a + Weapon for
// that drone, so each drone reads as one group; then the reserve ammo (the same
// pools as on the Weapons tab).
function dronesTab(container, c) {
  const sectionTitle = (text) => el('div', { class: 'section-title' }, [el('h2', {}, text)]);
  if (c.rcc) {
    container.append(el('div', { class: 'group' }, [sectionTitle(t('rccs')), rccCard(c)]));
  }

  const drones = c.drones ?? [];
  const list = el('div', { class: 'list drone-list' });
  if (drones.length === 0) list.append(el('div', { class: 'muted' }, t('noDrones')));
  for (const d of drones) {
    const weapons = c.weapons.filter((w) => w.mount === d.name);
    const card = droneCard(c, d);
    card.append(el('hr', { class: 'card-sep' }));
    card.append(el('div', { class: 'drone-weapons' }, [
      weapons.length ? weaponList(c, weapons, false) : null,
      el('div', { class: 'row drone-add-weapon' }, [
        el('button', { onclick: () => openWeaponModal(c, { mount: d.name }) }, t('addWeapon')),
      ]),
    ]));
    list.append(card);
  }
  container.append(el('div', { class: 'group' }, [sectionTitle(t('drones')), list]));
  container.append(reserveSection(c));
}

function magicTab(container, c) {
  const hasCatalog = Boolean(getSpiritCatalog());
  const addBtn = el('button', {
    disabled: hasCatalog ? null : 'true',
    onclick: hasCatalog ? () => openSpiritModal(c) : null,
  }, t('addSpirit'));

  const children = [el('div', { class: 'section-title' }, [el('h2', {}, t('summonedSpirits')), addBtn])];
  if (!hasCatalog) children.push(el('div', { class: 'hint' }, t('needSpiritCatalog')));

  const spirits = c.spirits ?? [];
  if (spirits.length) {
    const list = el('div', { class: 'list' });
    for (const s of spirits) list.append(spiritCard(c, s));
    children.push(list);
  } else {
    children.push(el('div', { class: 'muted' }, t('noSpirits')));
  }

  container.append(el('div', { class: 'group' }, children));
}

function weaponsTab(container, c) {
  // Personally carried weapons only; drone-mounted ones live on the Drones tab.
  const runner = c.weapons.filter((w) => w.mount === 'carried');
  const carrying = runner.filter((w) => !w.stashed);
  const stashed = runner.filter((w) => w.stashed);

  // Runner weapons: Equipped / Unequipped sub-headers (the Weapons tab is the header).
  container.append(el('div', { class: 'group' }, [
    el('div', { class: 'subgroup-title' }, t('equipped')),
    carrying.length ? weaponList(c, carrying, true) : el('div', { class: 'muted' }, t('nothingEquipped')),
    el('div', { class: 'subgroup-title' }, t('unequipped')),
    stashed.length ? weaponList(c, stashed, true) : el('div', { class: 'muted' }, t('nothingUnequipped')),
  ]));

  // Reserve ammo: its own top-level section.
  container.append(reserveSection(c));
}
