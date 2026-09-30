import { el } from './dom.js';
import { t } from '../app.js';
import {
  removeSpirit, updateSpirit, spiritAttributeValues, spiritConditionMonitor,
} from '../model.js';
import { localizedPair, getSpiritCatalog, localizeSpiritText } from '../spirit-catalog.js';
import { openSpiritModal } from './modals.js';
import { updateCharacter, uiLang } from './sheet-common.js';

// Localized attribute labels, kept here (the only consumer) rather than as 20 i18n
// keys. Order defines the display order of the attributes grid.
const ATTR_LABELS = {
  en: { body: 'Body', agility: 'Agility', reaction: 'Reaction', strength: 'Strength', willpower: 'Willpower', logic: 'Logic', intuition: 'Intuition', charisma: 'Charisma', magic: 'Magic', essence: 'Essence' },
  de: { body: 'Konstitution', agility: 'Geschicklichkeit', reaction: 'Reaktion', strength: 'Stärke', willpower: 'Willenskraft', logic: 'Logik', intuition: 'Intuition', charisma: 'Charisma', magic: 'Magie', essence: 'Essenz' },
};

// One "Label: value" line in the card's detail style; null when there is no value.
function labelLine(label, value) {
  if (!value) return null;
  return el('div', { class: 'muted' }, [el('span', { class: 'spirit-label' }, `${label}: `), value]);
}

// A "Label: a, b, c" line from a list of {en,de} pairs; null when the list is empty.
function pairLine(label, list, lang) {
  if (!list || list.length === 0) return null;
  return labelLine(label, list.map((p) => localizedPair(p, lang)).filter(Boolean).join(', '));
}

export function spiritCard(c, spirit) {
  const lang = uiLang();
  // Prefer the currently-loaded catalog's name for this type (so re-loading an
  // updated catalog refreshes even previously-summoned spirits), falling back to
  // the snapshot taken when the spirit was summoned.
  const cat = getSpiritCatalog();
  const liveName = cat && cat.spirits && cat.spirits[spirit.type] && cat.spirits[spirit.type].name;
  const typeLabel = localizedPair(liveName || spirit.typeName, lang) || spirit.type;
  const meta = `${typeLabel}, ${t('force')}: ${spirit.force}`;
  const display = spirit.name ? `${spirit.name} (${meta})` : `${typeLabel} (${t('force')}: ${spirit.force})`;
  const card = el('div', { class: 'card' });

  // Header: "Name (Type, Force: x)" on the left; edit (the spirit dialog) then
  // dismiss on the right — same layout as the weapon card.
  card.append(el('div', { class: 'row spread weapon-head' }, [
    el('h2', {}, display),
    el('div', { class: 'row' }, [
      el('button', { class: 'icon', title: t('editSpirit'), onclick: () => openSpiritModal(c, spirit) }, '✎'),
      el('button', {
        class: 'icon danger', title: t('remove'),
        onclick: () => { if (confirm(t('removeSpiritConfirm', display))) updateCharacter(c.id, (ch) => removeSpirit(ch, spirit.id)); },
      }, '🗑'),
    ]),
  ]));

  // Stat table — 4 columns × 3 rows. Rows 1-2 carry the eight core attributes;
  // the last row carries Magic, Essence, and the condition monitor, evenly split
  // across the full width.
  const labels = ATTR_LABELS[lang] || ATTR_LABELS.en;
  const v = spiritAttributeValues(spirit);
  // Abbreviate labels to their first 3 letters so cells stay narrow (e.g.
  // Konstitution -> Kon, Body -> Bod, Zustandsmonitor -> Zus).
  const cell = (label, val) => el('div', { class: 'stat' }, [
    el('span', { class: 'stat-label' }, `${label.slice(0, 3)}: `),
    el('span', { class: 'stat-val' }, String(val ?? '–')),
  ]);
  card.append(el('div', { class: 'spirit-stats' }, [
    cell(labels.body, v.body), cell(labels.agility, v.agility), cell(labels.reaction, v.reaction), cell(labels.strength, v.strength),
    cell(labels.willpower, v.willpower), cell(labels.logic, v.logic), cell(labels.intuition, v.intuition), cell(labels.charisma, v.charisma),
    el('div', { class: 'stat-row3' }, [
      cell(labels.magic, v.magic), cell(labels.essence, v.essence), cell(t('conditionMonitor'), spiritConditionMonitor(spirit)),
    ]),
  ]));

  // Derived values (Force-independent notation, faithful to the source), then
  // powers / optional powers / skills / weaknesses — one "Label: value" row each,
  // except the two initiatives, which share a row in two equal columns.
  const initiatives = [
    labelLine(t('initiativeLabel'), spirit.initiative),
    labelLine(t('astralInitiativeLabel'), spirit.astralInitiative),
  ].filter(Boolean);
  for (const line of [
    initiatives.length ? el('div', { class: 'spirit-pair' }, initiatives) : null,
    labelLine(t('actionsLabel'), localizeSpiritText(spirit.actions, lang)),
    labelLine(t('movementLabel'), localizeSpiritText(spirit.movement, lang)),
    pairLine(t('innatePowers'), spirit.powers, lang),
    pairLine(t('optionalPowersLabel'), spirit.optionalPowers, lang),
    pairLine(t('skillsLabel'), spirit.skills, lang),
    pairLine(t('weaknessesLabel'), spirit.weaknesses, lang),
  ]) { if (line) card.append(line); }

  // Services counter — bottom-right of the card.
  const setServices = (n) => updateCharacter(c.id, (ch) => updateSpirit(ch, spirit.id, { services: Math.max(0, n) }));
  card.append(el('div', { class: 'row spirit-services' }, [
    el('span', { class: 'services-label' }, t('services')),
    el('button', { class: 'icon', onclick: () => setServices(spirit.services - 1) }, '−'),
    el('span', { class: 'count' }, String(spirit.services)),
    el('button', { class: 'icon', onclick: () => setServices(spirit.services + 1) }, '+'),
  ]));

  return card;
}
