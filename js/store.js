import { upsertCharacter } from './model.js';

export const STORAGE_KEY = 'sr6-ammo-tracker';
// Written before every save: the blob that was in STORAGE_KEY beforehand. One
// generation is enough to survive a single bad write.
export const BACKUP_KEY = 'sr6-ammo-tracker.bak';
// Where an unparseable blob is copied so it is never simply overwritten.
export const CORRUPT_KEY = 'sr6-ammo-tracker.corrupt';

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

// True when `text` is a state object we actually understood, as opposed to
// deserialize's empty-state fallback. Distinguishing the two is what lets us
// refuse to overwrite data we merely failed to read.
function parsesAsState(text) {
  if (!text) return false;
  try {
    const obj = JSON.parse(text);
    return Boolean(obj) && Array.isArray(obj.characters)
      && !obj.characters.some((c) => typeof c !== 'object' || c === null);
  } catch {
    return false;
  }
}

// Decide what to load and whether saving is safe, given the two stored blobs.
// Pure, so the recovery rules are unit-tested rather than reasoned about.
//
//   source     'main' | 'backup' | 'empty' | 'none'
//   writable   false only when readable bytes may still be in storage — saving
//              then would destroy a character we simply could not parse
//   corruptText the unreadable main blob, for quarantining
export function readPersisted(mainText, backupText) {
  if (parsesAsState(mainText)) {
    return {
      state: deserialize(mainText), source: 'main',
      writable: true, recovered: false, corrupt: false, corruptText: null,
    };
  }

  // Nothing stored at all: a normal first run, and saving must work.
  if (!mainText) {
    return {
      state: emptyState(), source: 'empty',
      writable: true, recovered: false, corrupt: false, corruptText: null,
    };
  }

  // Something is there but we cannot read it.
  if (parsesAsState(backupText)) {
    return {
      state: deserialize(backupText), source: 'backup',
      writable: true, recovered: true, corrupt: true, corruptText: mainText,
    };
  }

  return {
    state: emptyState(), source: 'none',
    writable: false, recovered: false, corrupt: true, corruptText: mainText,
  };
}

export function mergeState(state, incoming) {
  let characters = state.characters;
  for (const c of (incoming.characters ?? [])) characters = upsertCharacter(characters, c);
  return { ...state, characters };
}

// --- localStorage-backed (browser only) -------------------------------------

// Set when the load could not be parsed and was not recoverable. While true,
// saveState refuses to write, so the unreadable bytes stay put for recovery.
let saveBlocked = false;
let lastLoad = null;

export function loadState() {
  let main = null;
  let backup = null;
  try {
    main = localStorage.getItem(STORAGE_KEY);
    backup = localStorage.getItem(BACKUP_KEY);
  } catch {
    // Storage unreadable entirely (disabled/partitioned). Run from memory, and
    // do not pretend a save will work.
    lastLoad = { state: emptyState(), source: 'none', writable: false, recovered: false, corrupt: false };
    saveBlocked = true;
    return lastLoad.state;
  }

  const result = readPersisted(main, backup);
  lastLoad = result;
  saveBlocked = !result.writable;

  if (result.corrupt && result.corruptText) {
    // Keep the wreckage under its own key; never let it be silently replaced.
    try { localStorage.setItem(CORRUPT_KEY, result.corruptText); } catch { /* best effort */ }
  }
  return result.state;
}

// How the last load went, so the UI can warn about recovered or blocked storage.
export function loadReport() {
  return lastLoad || { source: 'empty', writable: true, recovered: false, corrupt: false };
}

// Never throws: returns { ok } so a failed write surfaces as a warning instead of
// aborting the mutation and leaving memory and storage silently diverged.
export function saveState(state) {
  if (saveBlocked) return { ok: false, reason: 'blocked' };
  const text = serialize(state);
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) localStorage.setItem(BACKUP_KEY, previous);
    localStorage.setItem(STORAGE_KEY, text);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e && e.name) === 'QuotaExceededError' ? 'quota' : 'write' };
  }
}
