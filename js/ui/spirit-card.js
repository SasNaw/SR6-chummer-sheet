import { el } from './dom.js';
import { t } from '../app.js';
import {
  removeSpirit, updateSpirit, spiritAttributeValues, spiritConditionMonitor,
} from '../model.js';
import { localizedPair } from '../spirit-catalog.js';
import { updateCharacter, uiLang } from './sheet-common.js';

// Localized attribute labels, kept here (the only consumer) rather than as 20 i18n
// keys. Order defines the display order of the attributes grid.
const ATTR_LABELS = {
  en: { body: 'Body', agility: 'Agility', reaction: 'Reaction', strength: 'Strength', willpower: 'Willpower', logic: 'Logic', intuition: 'Intuition', charisma: 'Charisma', magic: 'Magic', essence: 'Essence' },
  de: { body: 'Konstitution', agility: 'Geschicklichkeit', reaction: 'Reaktion', strength: 'Stärke', willpower: 'Willenskraft', logic: 'Logik', intuition: 'Intuition', charisma: 'Charisma', magic: 'Magie', essence: 'Essenz' },
};

// One "Label: a, b, c" line from a list of {en,de} pairs; null when the list is empty.
function pairLine(label, list, lang) {
  if (!list || list.length === 0) return null;
  const names = list.map((p) => localizedPair(p, lang)).filter(Boolean).join(', ');
  return el('div', { class: 'muted' }, [el('span', { class: 'spirit-label' }, `${label}: `), names]);
}

export function spiritCard(c, spirit) {
  const lang = uiLang();
  const typeLabel = localizedPair(spirit.typeName, lang) || spirit.type;
  const display = spirit.name ? `${spirit.name} (${typeLabel})` : typeLabel;
  const card = el('div', { class: 'card' });

  // Header: display name + rename / dismiss.
  card.append(el('div', { class: 'row spread' }, [
    el('div', { class: 'row' }, [
      el('h2', {}, display),
      el('button', { class: 'icon', title: t('edit'), onclick: () => renameSpirit(c, spirit) }, '✎'),
    ]),
    el('button', {
      class: 'icon danger', title: t('remove'),
      onclick: () => { if (confirm(t('removeSpiritConfirm', display))) updateCharacter(c.id, (ch) => removeSpirit(ch, spirit.id)); },
    }, '🗑'),
  ]));

  // Force headline (the condition monitor lives in the stat table below).
  card.append(el('div', { class: 'count' }, [String(spirit.force), el('span', { class: 'cap' }, ` ${t('force')}`)]));

  // Stat table — 4 columns × 3 rows. Rows 1-2 carry the eight core attributes;
  // the last row carries Magic, Essence, and the condition monitor, evenly split
  // across the full width.
  const labels = ATTR_LABELS[lang] || ATTR_LABELS.en;
  const v = spiritAttributeValues(spirit);
  const cell = (label, val) => el('div', { class: 'stat' }, [
    el('div', { class: 'stat-label' }, label),
    el('div', { class: 'stat-val' }, String(val ?? '–')),
  ]);
  card.append(el('div', { class: 'spirit-stats' }, [
    cell(labels.body, v.body), cell(labels.agility, v.agility), cell(labels.reaction, v.reaction), cell(labels.strength, v.strength),
    cell(labels.willpower, v.willpower), cell(labels.logic, v.logic), cell(labels.intuition, v.intuition), cell(labels.charisma, v.charisma),
    el('div', { class: 'stat-row3' }, [
      cell(labels.magic, v.magic), cell(labels.essence, v.essence), cell(t('conditionMonitor'), spiritConditionMonitor(spirit)),
    ]),
  ]));

  // Derived display strings (Force-independent notation, faithful to the source).
  const derived = [
    spirit.initiative && `${t('initiativeLabel')}: ${spirit.initiative}`,
    spirit.astralInitiative && `${t('astralInitiativeLabel')}: ${spirit.astralInitiative}`,
    spirit.actions && `${t('actionsLabel')}: ${spirit.actions}`,
    spirit.movement && `${t('movementLabel')}: ${spirit.movement}`,
  ].filter(Boolean);
  if (derived.length) card.append(el('div', { class: 'muted' }, derived.join('  ·  ')));

  // Powers / optional powers / skills / weaknesses.
  for (const line of [
    pairLine(t('innatePowers'), spirit.powers, lang),
    pairLine(t('optionalPowersLabel'), spirit.optionalPowers, lang),
    pairLine(t('skillsLabel'), spirit.skills, lang),
    pairLine(t('weaknessesLabel'), spirit.weaknesses, lang),
  ]) { if (line) card.append(line); }

  // Services counter.
  const setServices = (n) => updateCharacter(c.id, (ch) => updateSpirit(ch, spirit.id, { services: Math.max(0, n) }));
  card.append(el('div', { class: 'row spread' }, [
    el('span', { class: 'muted' }, t('services')),
    el('div', { class: 'row' }, [
      el('button', { class: 'icon', onclick: () => setServices(spirit.services - 1) }, '−'),
      el('span', { class: 'count' }, String(spirit.services)),
      el('button', { class: 'icon', onclick: () => setServices(spirit.services + 1) }, '+'),
    ]),
  ]));

  return card;
}

function renameSpirit(c, spirit) {
  const name = prompt(t('spiritNamePrompt'), spirit.name || '');
  if (name === null) return;
  updateCharacter(c.id, (ch) => updateSpirit(ch, spirit.id, { name: name.trim() }));
}
