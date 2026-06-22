import { loadState, saveState } from './store.js';
import { el, clear } from './ui/dom.js';
import { renderPicker } from './ui/character-picker.js';
import { renderSheet } from './ui/character-sheet.js';
import { renderIoBar } from './ui/io.js';

let state = loadState();
let view = { name: 'picker', characterId: null };

export function getState() { return state; }
export function mutate(fn) { state = fn(state); saveState(state); render(); }
export function goPicker() { view = { name: 'picker', characterId: null }; render(); }
export function goSheet(characterId) { view = { name: 'sheet', characterId }; render(); }

function render() {
  const header = document.getElementById('app-header');
  const root = document.getElementById('app-root');
  clear(header);
  clear(root);

  if (view.name === 'sheet') {
    const c = state.characters.find((x) => x.id === view.characterId);
    header.append(el('button', { class: 'icon', onclick: goPicker, title: 'Back' }, '‹'));
    header.append(el('h1', {}, c ? c.name : 'Character'));
    renderSheet(root, view.characterId);
    return;
  }

  header.append(el('h1', {}, 'SR6 Ammo Tracker'));
  renderPicker(root, { onOpen: goSheet });
  renderIoBar(root, { onImported: goSheet });
}

render();
