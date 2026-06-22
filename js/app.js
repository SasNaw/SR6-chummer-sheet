import { loadState, saveState } from './store.js';
import { el, clear } from './ui/dom.js';

let state = loadState();

export function getState() { return state; }

// Apply a pure update, persist, re-render.
export function mutate(fn) {
  state = fn(state);
  saveState(state);
  render();
}

function render() {
  const header = document.getElementById('app-header');
  const root = document.getElementById('app-root');
  clear(header);
  clear(root);
  header.append(el('h1', {}, 'SR6 Ammo Tracker'));
  root.append(el('p', { class: 'muted' }, 'Loading…')); // replaced in Task 11/12
}

render();
