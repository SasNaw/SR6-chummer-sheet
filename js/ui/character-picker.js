import { el } from './dom.js';
import { getState, mutate } from '../app.js';
import { createCharacter, upsertCharacter } from '../model.js';

export function renderPicker(container, { onOpen }) {
  const { characters } = getState();

  const addBtn = el('button', {
    class: 'accent',
    onclick: () => {
      const name = prompt('Character name?');
      if (!name) return;
      const c = createCharacter({ name });
      mutate((s) => ({ ...s, characters: upsertCharacter(s.characters, c), activeId: c.id }));
      onOpen(c.id);
    },
  }, '+ New character');

  container.append(el('div', { class: 'section-title' }, [el('h2', {}, 'Characters'), addBtn]));

  if (characters.length === 0) {
    container.append(el('div', { class: 'empty' }, 'No characters yet. Add one or import from XML below.'));
  }

  const list = el('div', { class: 'list' });
  for (const c of characters) {
    const open = el('button', { onclick: () => onOpen(c.id) },
      `${c.name}${c.realName ? ` — ${c.realName}` : ''}`);
    open.style.flex = '1';
    open.style.textAlign = 'left';

    const rename = el('button', {
      class: 'icon', title: 'Rename',
      onclick: () => {
        const name = prompt('New name?', c.name);
        if (!name) return;
        mutate((s) => ({ ...s, characters: upsertCharacter(s.characters, { ...c, name }) }));
      },
    }, '✎');

    const del = el('button', {
      class: 'icon danger', title: 'Delete',
      onclick: () => {
        if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
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
