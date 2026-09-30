import { el } from './dom.js';
import { localizedPair } from '../spirit-catalog.js';
import { uiLang } from './sheet-common.js';

// Short stat labels (display order) with the full name as a tooltip. Kept here,
// the only consumer, rather than as i18n keys (same approach as spirit-card).
const STAT_LABELS = {
  en: [
    ['handling', 'Han', 'Handling (on-road/off-road)'], ['acceleration', 'Acc', 'Acceleration'],
    ['speedInterval', 'SpdI', 'Speed Interval'], ['topSpeed', 'TSpd', 'Top Speed'],
    ['body', 'Bod', 'Body'], ['armor', 'Arm', 'Armor'], ['pilot', 'Pil', 'Pilot'], ['sensor', 'Sen', 'Sensor'],
  ],
  de: [
    ['handling', 'Hand', 'Handling (Straße/Gelände)'], ['acceleration', 'Beschl', 'Beschleunigung'],
    ['speedInterval', 'GInt', 'Geschwindigkeitsintervall'], ['topSpeed', 'Max', 'Höchstgeschwindigkeit'],
    ['body', 'Rumpf', 'Rumpf'], ['armor', 'Panz', 'Panzerung'], ['pilot', 'Pilot', 'Pilot'], ['sensor', 'Sens', 'Sensor'],
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

// One-line summary under the drone name: "Steel Lynx Combat Drone · Large · Ground · ×2".
// The type name is omitted when the drone's name already is that type name.
// Returns '' when there is nothing to add.
export function droneMeta(drone) {
  const lang = uiLang();
  const typeLabel = localizedPair(drone.typeName, lang);
  const parts = [
    typeLabel && typeLabel !== drone.name ? typeLabel : null,
    drone.size && ((SIZE_LABELS[lang] || SIZE_LABELS.en)[drone.size] || drone.size),
    drone.subtype && ((SUBTYPE_LABELS[lang] || SUBTYPE_LABELS.en)[drone.subtype] || drone.subtype),
    drone.count > 1 ? `×${drone.count}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

// Stat grid (4 columns × 2 rows) for a drone that has a stats snapshot.
export function droneStats(drone) {
  const labels = STAT_LABELS[uiLang()] || STAT_LABELS.en;
  return el('div', { class: 'drone-stats' }, labels.map(([key, short, full]) => el('div', { class: 'stat', title: full }, [
    el('span', { class: 'stat-label' }, `${short}: `),
    el('span', { class: 'stat-val' }, String(drone.stats[key] ?? '–')),
  ])));
}
