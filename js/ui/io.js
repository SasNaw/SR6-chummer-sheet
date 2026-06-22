import { el } from './dom.js';
import { getState, mutate, t } from '../app.js';
import { importFromXmlString } from '../xml-import.js';
import { serialize, deserialize, mergeState } from '../store.js';
import { upsertCharacter } from '../model.js';

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
        const character = importFromXmlString(text);
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
}
