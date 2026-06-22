export function prettifyRef(ref) {
  if (!ref) return '';
  return ref
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function newId() {
  return globalThis.crypto.randomUUID();
}
