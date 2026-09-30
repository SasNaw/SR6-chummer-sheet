import { loadState, saveState, loadReport } from './store.js';
import { backfillAttackRatings } from './model.js';
import { getCatalog } from './catalog.js';
import { el, clear } from './ui/dom.js';
import { translate } from './i18n.js';
import { renderPicker } from './ui/character-picker.js';
import { renderSheet } from './ui/character-sheet.js';
import { renderIoBar } from './ui/io.js';

let state = loadState();
// Weapons saved before attack ratings existed (or imported with no catalog
// loaded) take theirs from the catalog. Only empty ratings are filled, so a
// value edited for weapon mods survives.
export function applyBackfills(s) {
  const catalog = getCatalog();
  if (!catalog) return s;
  const characters = s.characters.map((c) => backfillAttackRatings(c, catalog));
  return characters.some((c, i) => c !== s.characters[i]) ? { ...s, characters } : s;
}
state = applyBackfills(state);
// Reopen the last-viewed character on launch, if it still exists.
let view = (state.activeId && state.characters.some((c) => c.id === state.activeId))
  ? { name: 'sheet', characterId: state.activeId }
  : { name: 'picker', characterId: null };

export function getState() { return state; }
// A storage problem the user needs to know about: 'recovered', 'blocked',
// 'quota' or 'write'. Rendered as a banner; cleared by the next good save.
let storageWarning = (() => {
  const r = loadReport();
  if (!r.writable) return 'blocked';
  if (r.recovered) return 'recovered';
  return null;
})();

// Ask the browser to exempt this origin from automatic eviction. Chromium grants
// it by heuristic (an installed PWA counts); on iOS a home-screen web app is
// already exempt from ITP's 7-day sweep. Fire-and-forget, once, and only after
// there is data worth protecting so a first-time visitor is never prompted.
let persistenceAsked = false;
function requestPersistence() {
  if (persistenceAsked) return;
  persistenceAsked = true;
  const sm = navigator.storage;
  if (!sm || !sm.persist || !sm.persisted) return;
  sm.persisted().then((already) => (already ? null : sm.persist())).catch(() => {});
}

export function mutate(fn) {
  state = fn(state);
  const res = saveState(state);
  // Render either way: a failed write must not leave the UI frozen on stale data.
  storageWarning = res.ok ? null : res.reason;
  if (res.ok && state.characters.length > 0) requestPersistence();
  render();
}
// Translate a key in the current language (used throughout the UI).
export function t(key, ...params) { return translate(state.lang || 'en', key, ...params); }
export function rerender() { render(); }
export function goPicker() { view = { name: 'picker', characterId: null }; render(); }
export function goSheet(characterId) {
  view = { name: 'sheet', characterId };
  if (state.activeId !== characterId) { state = { ...state, activeId: characterId }; saveState(state); }
  render();
}

const WARNING_KEYS = {
  blocked: 'storageBlocked', recovered: 'storageRecovered',
  quota: 'storageSaveFailed', write: 'storageSaveFailed',
};

function render() {
  const header = document.getElementById('app-header');
  const root = document.getElementById('app-root');
  clear(header);
  clear(root);

  if (storageWarning) root.append(el('div', { class: 'warn', role: 'alert' }, t(WARNING_KEYS[storageWarning])));

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
if (state.characters.length > 0) requestPersistence();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
