import { el } from './dom.js';
import { localizedPair } from '../spirit-catalog.js';
import { uiLang } from './sheet-common.js';
import { t } from '../app.js';

// Stat labels in display order. Kept here, the only consumer, rather than as
// i18n keys (same approach as spirit-card). \u00ad = soft hyphen, so long German
// compounds break at a sensible point on narrow screens.
const STAT_LABELS = {
  en: [
    ['handling', 'Handling'], ['acceleration', 'Acceleration'],
    ['speedInterval', 'Speed Interval'], ['topSpeed', 'Top Speed'],
    ['body', 'Body'], ['armor', 'Armor'], ['pilot', 'Pilot'], ['sensor', 'Sensor'],
  ],
  de: [
    ['handling', 'Handling'], ['acceleration', 'Beschleunigung'],
    ['speedInterval', 'Geschwindigkeits\u00adintervall'], ['topSpeed', 'Höchst\u00adgeschwindigkeit'],
    ['body', 'Rumpf'], ['armor', 'Panzerung'], ['pilot', 'Pilot'], ['sensor', 'Sensor'],
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

// One-line summary under the drone name: "Steel Lynx Combat Drone · Large · Ground".
// The type name is omitted when the drone's name already is that type name.
// Returns '' when there is nothing to add.
function droneMeta(drone) {
  const lang = uiLang();
  const typeLabel = localizedPair(drone.typeName, lang);
  const parts = [
    typeLabel && typeLabel !== drone.name ? typeLabel : null,
    drone.size && ((SIZE_LABELS[lang] || SIZE_LABELS.en)[drone.size] || drone.size),
    drone.subtype && ((SUBTYPE_LABELS[lang] || SUBTYPE_LABELS.en)[drone.subtype] || drone.subtype),
  ].filter(Boolean);
  return parts.join(' · ');
}

// Stat grid for a drone that has a stats snapshot: two "Label: value" pairs per
// row, laid out as four grid columns (label | value | label | value). Each label
// column is as wide as its widest label, so every value sits right after its
// label and the values line up vertically — the spirit card's look, with full
// words instead of three-letter abbreviations.
function droneStats(drone) {
  const labels = STAT_LABELS[uiLang()] || STAT_LABELS.en;
  return el('div', { class: 'drone-stats' }, labels.flatMap(([key, label]) => [
    el('span', { class: 'stat-label' }, `${label}:`),
    el('span', { class: 'stat-val' }, String(drone.stats[key] ?? '–')),
  ]));
}

// Read-only drone card for the Drones tab: name, summary line, and the stat grid
// (or a hint when the drone has no stats snapshot).
export function droneCard(drone) {
  const meta = droneMeta(drone);
  return el('div', { class: 'card' }, [
    // Shared card header (see .card-head): title vertically centred, room for
    // edit/delete buttons on the right once drone cards get them.
    el('div', { class: 'row spread card-head' }, [el('h2', {}, drone.name)]),
    meta ? el('div', { class: 'muted' }, meta) : null,
    drone.stats ? droneStats(drone) : el('div', { class: 'hint' }, t('noDroneStats')),
  ].filter(Boolean));
}
