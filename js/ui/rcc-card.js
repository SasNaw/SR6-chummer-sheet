import { el } from './dom.js';
import { localizedPair } from '../spirit-catalog.js';
import {
  rccProgramSlots, startRccProgram, stopRccProgram, toggleRccSlave, droneBaseName,
} from '../model.js';
import { softwareLabel } from './drone-card.js';
import { updateCharacter, uiLang } from './sheet-common.js';
import { t } from '../app.js';

// Stat labels in display order: short label for the cell, full name for its
// tooltip (same approach as drone-card).
const STAT_LABELS = {
  en: [
    ['deviceRating', 'Dev', 'Device Rating'], ['dataProcessing', 'Dat', 'Data Processing'],
    ['firewall', 'Fir', 'Firewall'], ['programSlots', 'Prg', 'Program slots'],
  ],
  de: [
    ['deviceRating', 'Ger', 'Gerätestufe'], ['dataProcessing', 'Dat', 'Datenverarbeitung'],
    ['firewall', 'Fir', 'Firewall'], ['programSlots', 'Prg', 'Programmplätze'],
  ],
};

// A heading in the card's tracker style ("RUNNING (3/5)").
const heading = (text) => el('span', { class: 'services-label' }, text);

// The rigger command console, on top of the Drones tab: name, stats, the
// programs running on it and the ones only installed (tap a chip to move it
// across; running is capped by the program slots), and which drones are slaved
// to it. Running programs on the RCC reach the slaved drones' cards.
export function rccCard(c) {
  const { rcc } = c;
  const lang = uiLang();
  const card = el('div', { class: 'card' });
  const name = localizedPair(rcc.name, lang) || t('rcc');

  card.append(el('div', { class: 'row spread card-head spirit-head' }, [el('h2', {}, `${name} (${t('rcc')})`)]));

  if (rcc.stats) {
    const labels = STAT_LABELS[lang] || STAT_LABELS.en;
    card.append(el('div', { class: 'spirit-stats' }, labels.map(([key, short, full]) => el('div', { class: 'stat', title: full }, [
      el('span', { class: 'stat-label' }, `${short}: `),
      el('span', { class: 'stat-val' }, String(rcc.stats[key] ?? '–')),
    ]))));
  } else {
    card.append(el('div', { class: 'hint' }, t('noRccStats')));
  }

  // Running | installed: two chip lists in software order.
  const slots = rccProgramSlots(rcc);
  const running = rcc.software.filter((s) => rcc.running.includes(s.id));
  const installed = rcc.software.filter((s) => !rcc.running.includes(s.id));
  const full = slots != null && running.length >= slots;
  const chips = (list, on) => (list.length
    ? el('div', { class: 'chips' }, list.map((s) => el('button', {
      type: 'button', class: on ? 'toggle on' : 'toggle', 'aria-pressed': on ? 'true' : 'false',
      disabled: !on && full ? 'true' : null,
      title: on ? t('stopProgram') : (full ? t('rccSlotsFull') : t('runProgram')),
      onclick: () => updateCharacter(c.id, (ch) => (on ? stopRccProgram(ch, s.id) : startRccProgram(ch, s.id))),
    }, softwareLabel(s, lang))))
    : el('div', { class: 'muted' }, t('none')));

  card.append(el('hr', { class: 'card-sep' }));
  card.append(el('div', { class: 'rcc-section' }, [
    heading(slots != null ? `${t('runningPrograms')} (${running.length}/${slots})` : `${t('runningPrograms')} (${running.length})`),
    chips(running, true),
  ]));
  card.append(el('div', { class: 'rcc-section' }, [heading(t('installedPrograms')), chips(installed, false)]));

  // Slaved drones: one toggle chip per drone.
  const drones = c.drones ?? [];
  const slavedCount = drones.filter((d) => rcc.slaved.includes(d.id)).length;
  card.append(el('hr', { class: 'card-sep' }));
  card.append(el('div', { class: 'rcc-section' }, [
    heading(`${t('slavedDrones')} (${slavedCount}/${drones.length})`),
    drones.length
      ? el('div', { class: 'chips' }, drones.map((d) => {
        const on = rcc.slaved.includes(d.id);
        return el('button', {
          type: 'button', class: on ? 'toggle on' : 'toggle', 'aria-pressed': on ? 'true' : 'false',
          onclick: () => updateCharacter(c.id, (ch) => toggleRccSlave(ch, d.id)),
        }, droneBaseName(d.name));
      }))
      : el('div', { class: 'muted' }, t('noDrones')),
  ]));

  return card;
}
