import { el } from './dom.js';
import { getState, mutate, t } from '../app.js';
import { createCharacter, upsertCharacter } from '../model.js';

// EN/DE language toggle for the whole app.
function languageSelector() {
  const lang = getState().lang || 'en';
  const opt = (code, label) => el('button', {
    class: lang === code ? 'toggle on' : 'toggle',
    onclick: () => { if (lang !== code) mutate((s) => ({ ...s, lang: code })); },
  }, label);
  return el('div', { class: 'row' }, [
    el('span', { class: 'muted' }, t('language')),
    opt('en', 'EN'),
    opt('de', 'DE'),
  ]);
}

export function renderPicker(container, { onOpen }) {
  const { characters } = getState();

  container.append(el('div', { class: 'section-title' }, [el('h2', {}, t('characters')), languageSelector()]));

  const addBtn = el('button', {
    class: 'accent',
    onclick: () => {
      const name = prompt(t('characterNamePrompt'));
      if (!name) return;
      const c = createCharacter({ name });
      mutate((s) => ({ ...s, characters: upsertCharacter(s.characters, c), activeId: c.id }));
      onOpen(c.id);
    },
  }, t('newCharacter'));
  container.append(el('div', { class: 'row' }, [addBtn]));

  if (characters.length === 0) {
    container.append(el('div', { class: 'empty' }, t('noCharacters')));
  }

  const list = el('div', { class: 'list' });
  for (const c of characters) {
    const open = el('button', { onclick: () => onOpen(c.id) },
      `${c.name}${c.realName ? ` — ${c.realName}` : ''}`);
    open.style.flex = '1';
    open.style.textAlign = 'left';

    const rename = el('button', {
      class: 'icon', title: t('rename'),
      onclick: () => {
        const name = prompt(t('newNamePrompt'), c.name);
        if (!name) return;
        mutate((s) => ({ ...s, characters: upsertCharacter(s.characters, { ...c, name }) }));
      },
    }, '✎');

    const del = el('button', {
      class: 'icon danger', title: t('del'),
      onclick: () => {
        if (!confirm(t('deleteCharacterConfirm', c.name))) return;
        mutate((s) => ({
          ...s,
          characters: s.characters.filter((x) => x.id !== c.id),
          activeId: s.activeId === c.id ? null : s.activeId,
        }));
      },
    }, '🗑');

    list.append(el('div', { class: 'card row' }, [open, rename, del]));
  }
  container.append(list);
}
