// Optional, on-device drone catalog (generated locally from a licensed Genesis
// install — see tools/build-drone-catalog.mjs). Stored in its own localStorage
// key, never in character data or backups. Pure helpers below are unit-tested;
// the localStorage-backed wrappers are browser-only.

const KEY = 'sr6-drone-catalog';
let cache; // undefined = not read yet, null = none loaded, object = loaded catalog

// --- Pure helpers -----------------------------------------------------------

export function isDroneCatalog(obj) {
  return Boolean(
    obj && typeof obj === 'object'
    && obj.drones && typeof obj.drones === 'object'
    && Object.keys(obj.drones).length > 0,
  );
}

// The catalog entry for a Genesis drone ref, or null.
export function droneEntry(catalog, ref) {
  return (catalog && catalog.drones && ref && catalog.drones[ref]) || null;
}

// --- localStorage-backed (browser only) ------------------------------------

export function getDroneCatalog() {
  if (cache === undefined) {
    try { cache = JSON.parse(localStorage.getItem(KEY)) || null; } catch { cache = null; }
  }
  return cache;
}

export function setDroneCatalog(obj) {
  if (!isDroneCatalog(obj)) throw new Error('not a drone catalog');
  localStorage.setItem(KEY, JSON.stringify(obj));
  cache = obj;
}

export function clearDroneCatalog() {
  localStorage.removeItem(KEY);
  cache = null;
}

export function droneCatalogCount() {
  const c = getDroneCatalog();
  return c ? Object.keys(c.drones).length : 0;
}
