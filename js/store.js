import { upsertCharacter } from './model.js';

export const STORAGE_KEY = 'sr6-ammo-tracker';

export function emptyState() {
  return { version: 1, characters: [], activeId: null, lang: 'en' };
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(text) {
  if (!text) return emptyState();
  try {
    const obj = JSON.parse(text);
    if (!obj || !Array.isArray(obj.characters)) return emptyState();
    if (obj.characters.some((c) => typeof c !== 'object' || c === null)) return emptyState();
    return {
      version: 1,
      characters: obj.characters,
      activeId: obj.activeId ?? null,
      lang: obj.lang === 'de' ? 'de' : 'en',
    };
  } catch {
    return emptyState();
  }
}

export function mergeState(state, incoming) {
  let characters = state.characters;
  for (const c of (incoming.characters ?? [])) characters = upsertCharacter(characters, c);
  return { ...state, characters };
}

export function loadState() {
  return deserialize(localStorage.getItem(STORAGE_KEY));
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, serialize(state));
}
