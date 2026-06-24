// Shadowrun firing modes — the single source of truth for the whole app:
// canonical round costs, ordering, the SA→SS implication, and localized labels.
// Pure module (no imports), so model/UI can all derive from it without cycles.

export const FIRING_MODE_ROUNDS = { SS: 1, SA: 2, BF: 4, FA: 10 };
export const FIRING_MODE_ORDER = ['SS', 'SA', 'BF', 'FA'];

// The modes offered when creating a weapon (code + canonical round cost).
export const STANDARD_FIRING_MODES = FIRING_MODE_ORDER.map((mode) => ({ mode, rounds: FIRING_MODE_ROUNDS[mode] }));

// Display labels per language. English uses the codes; German uses EM/HM/SM/AM.
const MODE_LABELS = {
  en: { SS: 'SS', SA: 'SA', BF: 'BF', FA: 'FA' },
  de: { SS: 'EM', SA: 'HM', BF: 'SM', FA: 'AM' },
};

export function modeLabel(code, lang) {
  return (MODE_LABELS[lang] || MODE_LABELS.en)[code] || code;
}

// A weapon's effective firing modes for display/use: dedupe, add SS whenever SA
// is present (every semi-auto weapon can also single-shot), order canonically,
// and attach the canonical round cost. Accepts an array of {mode}-objects or
// plain mode-code strings.
export function expandFiringModes(modes) {
  const codes = new Set((modes || [])
    .map((m) => (typeof m === 'string' ? m : (m && m.mode)))
    .filter(Boolean));
  if (codes.has('SA')) codes.add('SS');
  return FIRING_MODE_ORDER.filter((m) => codes.has(m)).map((mode) => ({ mode, rounds: FIRING_MODE_ROUNDS[mode] }));
}
