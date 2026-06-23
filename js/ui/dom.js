// Tiny DOM helper. attrs: { class, onclick, value, ... }. children: string | Node | array.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'value') node.value = v;
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Open a centered modal dialog over a dimmed backdrop. `body` is a node or array
// of nodes rendered under the title. Closes on backdrop click or Escape.
// Returns a close() function so callers can dismiss it (e.g. on submit).
export function openModal(title, body) {
  const previouslyFocused = document.activeElement;
  const dialog = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
    el('div', { class: 'modal-title' }, title),
    ...(Array.isArray(body) ? body : [body]),
  ]);
  const backdrop = el('div', {
    class: 'modal-backdrop',
    onclick: (e) => { if (e.target === backdrop) close(); },
  }, dialog);

  const focusable = () => Array.from(dialog.querySelectorAll(
    'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'))
    .filter((n) => !n.disabled && n.offsetParent !== null);

  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const items = focusable();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus(); // restore focus
  }

  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  const items = focusable();
  if (items.length) items[0].focus(); // move focus into the dialog
  return close;
}
