import { loadState, saveState } from './store.js';
import { el, clear } from './ui/dom.js';
import { renderPicker } from './ui/character-picker.js';

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
    header.append(el('button', { class: 'icon', onclick: goPicker, title: 'Back' }, '‹'));
    header.append(el('h1', {}, 'Character'));
    root.append(el('p', { class: 'muted' }, 'Sheet view — added in Task 12.'));
    return;
  }

  header.append(el('h1', {}, 'SR6 Ammo Tracker'));
  renderPicker(root, { onOpen: goSheet });
}

render();
