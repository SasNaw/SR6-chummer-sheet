import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSpiritCatalog, localizedPair, spiritList, localizeSpiritText } from '../js/spirit-catalog.js';

const CAT = {
  spirits: {
    spirit_of_fire: {
      id: 'spirit_of_fire',
      name: { en: 'Spirits of Fire', de: 'Feuergeister' },
      attributes: { body: 1, agility: 2, reaction: 3, strength: 0, willpower: 0, logic: 0, intuition: 0, charisma: 0, magic: 0, essence: 0 },
      conditionMonitor: 9,
      skills: [{ en: 'Astral', de: 'Astral' }],
      powers: [{ en: 'Astral Form', de: 'astr. Gestalt' }],
      optionalPowers: [{ en: 'Guard', de: 'Schutz' }],
      weaknesses: [{ en: 'Allergy (cold, severe)', de: 'Allergie (kälte, schwer)' }],
    },
    spirit_of_air: {
      id: 'spirit_of_air',
      name: { en: 'Spirits of Air', de: 'Luftgeister' },
      attributes: { body: -2, agility: 3, reaction: 4, strength: -3, willpower: 0, logic: 0, intuition: 0, charisma: 0, magic: 0, essence: 0 },
      conditionMonitor: 8,
      skills: [],
      powers: [{ en: 'Movement', de: 'Bewegung' }],
      optionalPowers: [],
      weaknesses: [],
    },
  },
};

test('isSpiritCatalog validates shape', () => {
  assert.equal(isSpiritCatalog(CAT), true);
  assert.equal(isSpiritCatalog({}), false);
  assert.equal(isSpiritCatalog({ spirits: {} }), false); // empty is not a usable catalog
  assert.equal(isSpiritCatalog(null), false);
});

test('localizedPair falls back to English when German is missing', () => {
  assert.equal(localizedPair({ en: 'Guard', de: 'Schutz' }, 'de'), 'Schutz');
  assert.equal(localizedPair({ en: 'Guard', de: null }, 'de'), 'Guard'); // no DE -> EN
  assert.equal(localizedPair({ en: 'Guard', de: 'Schutz' }, 'en'), 'Guard');
  assert.equal(localizedPair(null, 'de'), null);
});

test('spiritList yields labelled, sorted entries', () => {
  const list = spiritList(CAT, 'en');
  assert.deepEqual(list.map((s) => s.label), ['Spirits of Air', 'Spirits of Fire']);
  assert.equal(list[0].id, 'spirit_of_air');
  assert.equal(list[0].spirit.conditionMonitor, 8);
  assert.deepEqual(spiritList(null, 'en'), []);
  assert.deepEqual(spiritList({}, 'en'), []);
});

test('localizeSpiritText translates action and movement terms for German', () => {
  assert.equal(localizeSpiritText('1 Major, 3 Minor', 'de'), '1 Haupthandlung, 3 Nebenhandlungen');
  assert.equal(localizeSpiritText('2 Major, 1 Minor', 'de'), '2 Haupthandlungen, 1 Nebenhandlung');
  assert.equal(localizeSpiritText('5 / 10, +1/hit', 'de'), '5 / 10, +1/Erfolg');
  assert.equal(localizeSpiritText('1 Major, 3 Minor', 'en'), '1 Major, 3 Minor'); // English untouched
  assert.equal(localizeSpiritText('+2D6', 'de'), '+2D6');
  assert.equal(localizeSpiritText('', 'de'), '');
  assert.equal(localizeSpiritText(undefined, 'de'), '');
});
