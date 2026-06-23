import { el } from './dom.js';
import { getState, mutate, t, rerender } from '../app.js';
import { importFromXmlString } from '../xml-import.js';
import { serialize, deserialize, mergeState } from '../store.js';
import { upsertCharacter } from '../model.js';
import { getCatalog, setCatalog, clearCatalog, catalogCount, isWeaponCatalog } from '../catalog.js';
import { setSpiritCatalog, clearSpiritCatalog, spiritCatalogCount, isSpiritCatalog } from '../spirit-catalog.js';

function readFile(accept, cb) {
  const input = el('input', { type: 'file', accept });
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result));
    reader.readAsText(file);
  });
  document.body.append(input);
  input.click();
  input.remove();
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function renderIoBar(container, { onImported }) {
  const importXml = el('button', {
    onclick: () => readFile('.xml,text/xml', (text) => {
      try {
        const character = importFromXmlString(text, getCatalog(), getState().lang || 'en');
        mutate((s) => ({ ...s, characters: upsertCharacter(s.characters, character), activeId: character.id }));
        onImported(character.id);
      } catch (e) {
        alert(t('importFailed', e.message));
      }
    }),
  }, t('importXml'));

  const exportJson = el('button', {
    onclick: () => download('sr6-ammo-backup.json', serialize(getState())),
  }, t('exportJson'));

  const importJson = el('button', {
    onclick: () => readFile('.json,application/json', (text) => {
      const incoming = deserialize(text);
      if (incoming.characters.length === 0) {
        alert(t('noCharactersInFile'));
        return;
      }
      mutate((s) => mergeState(s, incoming));
      alert(t('importedCount', incoming.characters.length));
    }),
  }, t('importJson'));

  container.append(el('div', { class: 'card row' }, [importXml, exportJson, importJson]));

  // Weapon catalog (on-device, optional): load a locally-generated catalog file.
  const count = catalogCount();
  const status = el('span', { class: 'muted' }, count ? t('catalogStatus', count) : t('noCatalog'));
  const loadCat = el('button', {
    onclick: () => readFile('.json,application/json', (text) => {
      let obj;
      try { obj = JSON.parse(text); } catch { obj = null; }
      if (!isWeaponCatalog(obj)) { alert(t('catalogInvalid')); return; }
      setCatalog(obj);
      alert(t('catalogLoaded', Object.keys(obj.weapons).length));
      rerender();
    }),
  }, t('loadCatalog'));
  const clearCat = count
    ? el('button', { class: 'danger', onclick: () => { if (confirm(t('clearCatalogConfirm'))) { clearCatalog(); rerender(); } } }, t('clearCatalog'))
    : null;
  container.append(el('div', { class: 'card row' }, [status, loadCat, clearCat].filter(Boolean)));

  // Spirit catalog (on-device, optional): load a locally-generated catalog file.
  const sCount = spiritCatalogCount();
  const sStatus = el('span', { class: 'muted' }, sCount ? t('spiritCatalogStatus', sCount) : t('noSpiritCatalog'));
  const loadSpirit = el('button', {
    onclick: () => readFile('.json,application/json', (text) => {
      let obj;
      try { obj = JSON.parse(text); } catch { obj = null; }
      if (!isSpiritCatalog(obj)) { alert(t('spiritCatalogInvalid')); return; }
      setSpiritCatalog(obj);
      alert(t('spiritCatalogLoaded', Object.keys(obj.spirits).length));
      rerender();
    }),
  }, t('loadSpiritCatalog'));
  const clearSpirit = sCount
    ? el('button', { class: 'danger', onclick: () => { if (confirm(t('clearSpiritCatalogConfirm'))) { clearSpiritCatalog(); rerender(); } } }, t('clearSpiritCatalog'))
    : null;
  container.append(el('div', { class: 'card row' }, [sStatus, loadSpirit, clearSpirit].filter(Boolean)));
}
