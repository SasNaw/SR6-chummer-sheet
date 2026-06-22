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
  const dialog = el('div', { class: 'modal' }, [
    el('div', { class: 'modal-title' }, title),
    ...(Array.isArray(body) ? body : [body]),
  ]);
  const backdrop = el('div', {
    class: 'modal-backdrop',
    onclick: (e) => { if (e.target === backdrop) close(); },
  }, dialog);

  function onKey(e) { if (e.key === 'Escape') close(); }
  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }

  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  return close;
}
