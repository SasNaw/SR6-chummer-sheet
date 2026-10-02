import { el } from './dom.js';
import { localizedPair } from '../spirit-catalog.js';
import {
  removeDrone, droneConditionMonitor, setDroneDamage, damageAfterBoxClick,
  droneInitiative, droneSoftware, droneBaseName,
} from '../model.js';
import { openDroneModal } from './modals.js';
import { updateCharacter, uiLang } from './sheet-common.js';
import { t } from '../app.js';

// Stat labels in display order (two rows of four in the stats grid): a short
// label for the cell and the full name for its tooltip. Kept here, the only
// consumer, rather than as i18n keys (same approach as spirit-card).
const STAT_LABELS = {
  en: [
    ['handling', 'Han', 'Handling'], ['acceleration', 'Acc', 'Acceleration'],
    ['speedInterval', 'Int', 'Speed Interval'], ['topSpeed', 'Top', 'Top Speed'],
    ['body', 'Bod', 'Body'], ['armor', 'Arm', 'Armor'], ['pilot', 'Pil', 'Pilot'], ['sensor', 'Sen', 'Sensor'],
  ],
  de: [
    ['handling', 'Han', 'Handling'], ['acceleration', 'Bes', 'Beschleunigung'],
    ['speedInterval', 'Int', 'Geschwindigkeitsintervall'], ['topSpeed', 'Max', 'Höchstgeschwindigkeit'],
    ['body', 'Rum', 'Rumpf'], ['armor', 'Pan', 'Panzerung'], ['pilot', 'Pil', 'Pilot'], ['sensor', 'Sen', 'Sensor'],
  ],
};

const SIZE_LABELS = {
  en: { DRONE_MICRO: 'Micro', DRONE_MINI: 'Mini', DRONE_SMALL: 'Small', DRONE_MEDIUM: 'Medium', DRONE_LARGE: 'Large' },
  de: { DRONE_MICRO: 'Mikro', DRONE_MINI: 'Mini', DRONE_SMALL: 'Klein', DRONE_MEDIUM: 'Mittel', DRONE_LARGE: 'Groß' },
};
const SUBTYPE_LABELS = {
  en: { AIR: 'Air', GROUND: 'Ground', WATER: 'Water', ANTHRO: 'Anthro' },
  de: { AIR: 'Luft', GROUND: 'Boden', WATER: 'Wasser', ANTHRO: 'Anthro' },
};

// Header title, like the spirit's "Name (Type, Force: x)":
// "R.E.X. (Steel Lynx Combat Drone, Large, Ground)". A trailing "(…)" in the
// name is dropped (droneBaseName) so the type isn't shown twice; the type name
// is omitted when the name already is that type name; no parentheses when
// there is nothing to add.
function droneTitle(drone, lang) {
  const typeLabel = localizedPair(drone.typeName, lang);
  const parts = [
    typeLabel && typeLabel !== drone.name ? typeLabel : null,
    drone.size && ((SIZE_LABELS[lang] || SIZE_LABELS.en)[drone.size] || drone.size),
    drone.subtype && ((SUBTYPE_LABELS[lang] || SUBTYPE_LABELS.en)[drone.subtype] || drone.subtype),
  ].filter(Boolean);
  return parts.length ? `${droneBaseName(drone.name)} (${parts.join(', ')})` : drone.name;
}

// One "Label: value" line in the spirit card's detail style; null when no value.
function labelLine(label, value) {
  if (!value || (Array.isArray(value) && !value.length)) return null;
  return el('div', { class: 'muted' }, [el('span', { class: 'spirit-label' }, `${label}: `), ...[].concat(value)]);
}

// One software entry as text: "Targeting (Roomsweeper) 7" — name, bound
// weapon, rating.
export function softwareLabel(s, lang) {
  return `${localizedPair(s.name, lang) || s.ref}${s.target ? ` (${s.target})` : ''}${s.rating != null ? ` ${s.rating}` : ''}`;
}

// "Targeting (Roomsweeper) 7, Evasion 7 · RCC": each entry's label, plus a mark
// on software shared from the rigger console.
function softwareList(list, lang) {
  return list.flatMap((s, i) => [
    i ? ', ' : null,
    softwareLabel(s, lang),
    s.viaRcc ? el('span', { class: 'via-rcc', title: t('viaRccTitle') }, ` · ${t('viaRcc')}`) : null,
  ]).filter(Boolean);
}

// Stat table in the spirit card's look: 4 columns × 2 rows of "LAB: value".
function droneStats(drone, lang) {
  const labels = STAT_LABELS[lang] || STAT_LABELS.en;
  return el('div', { class: 'spirit-stats' }, labels.map(([key, short, full]) => el('div', { class: 'stat', title: full }, [
    el('span', { class: 'stat-label' }, `${short}: `),
    el('span', { class: 'stat-val' }, String(drone.stats[key] ?? '–')),
  ])));
}

// Drone card for the Drones tab, laid out like the spirit card: header with
// edit/delete, stat table, details (initiative, software), and the
// condition monitor (no services). Without a stats snapshot, a hint replaces the stats and monitor.
export function droneCard(c, drone) {
  const lang = uiLang();
  const title = droneTitle(drone, lang);
  const weapons = c.weapons.filter((w) => w.mount === drone.name);
  const card = el('div', { class: 'card' });

  card.append(el('div', { class: 'row spread card-head spirit-head' }, [
    el('h2', {}, title),
    el('div', { class: 'row' }, [
      el('button', { class: 'icon', title: t('editDrone'), onclick: () => openDroneModal(c, drone) }, '✎'),
      el('button', {
        class: 'icon danger', title: t('deleteDrone'),
        onclick: () => {
          if (confirm(t('deleteDroneConfirm', drone.name, weapons.length))) {
            updateCharacter(c.id, (ch) => removeDrone(ch, drone.name));
          }
        },
      }, '🗑'),
    ]),
  ]));

  if (!drone.stats) {
    card.append(el('div', { class: 'hint' }, t('noDroneStats')));
  } else {
    card.append(droneStats(drone, lang));
  }

  // Details, one "Label: value" row each (omitted when empty): initiative, then
  // the autosofts (own, then RCC) and programs running on the drone. Its
  // weapons have their own cards below this one on the Drones tab.
  const { autosofts, programs } = droneSoftware(c, drone);
  const details = [
    labelLine(t('initiativeLabel'), droneInitiative(drone)),
    // Autosofts split by source: installed on the drone, and shared by the RCC
    // (the line's label says where they come from, so no per-entry mark).
    labelLine(t('autosoftsLabel'), softwareList(autosofts.filter((s) => !s.viaRcc), lang)),
    labelLine(t('rccAutosoftsLabel'), softwareList(autosofts.filter((s) => s.viaRcc).map((s) => ({ ...s, viaRcc: false })), lang)),
    programs.length ? labelLine(t('programsLabel'), softwareList(programs, lang)) : null,
  ].filter(Boolean);
  if (details.length) {
    card.append(el('hr', { class: 'card-sep' }));
    card.append(...details);
  }

  // Condition monitor: full width (no services column). Same box behaviour as
  // the spirit card (damageAfterBoxClick).
  const boxes = droneConditionMonitor(drone);
  if (boxes != null) {
    const damage = Math.min(drone.damage ?? 0, boxes);
    card.append(el('hr', { class: 'card-sep' }));
    card.append(el('div', { class: 'drone-trackers' }, [
      el('span', { class: 'services-label' }, `${t('conditionMonitor')} (${damage}/${boxes})`),
      el('div', { class: 'cm-boxes', role: 'group', 'aria-label': t('conditionMonitor') },
        Array.from({ length: boxes }, (_, i) => {
          const box = i + 1;
          const filled = box <= damage;
          return el('button', {
            type: 'button', class: filled ? 'cm-box filled' : 'cm-box',
            role: 'checkbox', 'aria-checked': filled ? 'true' : 'false', 'aria-label': `${box} / ${boxes}`,
            onclick: () => updateCharacter(c.id, (ch) => setDroneDamage(ch, drone.id, damageAfterBoxClick(damage, box))),
          });
        })),
    ]));
  }

  return card;
}
