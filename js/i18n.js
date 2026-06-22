// UI string tables for English and German. Values are strings, or functions for
// strings with parameters. `translate(lang, key, ...params)` resolves a key for a
// language, falling back to English, then to the key itself.

export const STRINGS = {
  en: {
    language: 'Language',
    // Character picker
    characters: 'Characters',
    newCharacter: '+ New character',
    characterNamePrompt: 'Character name?',
    noCharacters: 'No characters yet. Add one or import from XML below.',
    rename: 'Rename',
    newNamePrompt: 'New name?',
    del: 'Delete',
    deleteCharacterConfirm: (name) => `Delete "${name}"? This cannot be undone.`,
    characterNotFound: 'Character not found.',
    // IO
    importXml: 'Import XML',
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    importFailed: (msg) => `Import failed: ${msg}`,
    noCharactersInFile: 'No characters found in that file — nothing imported.',
    importedCount: (n) => `Imported ${n} character(s).`,
    // Weapons section
    weapons: 'Weapons',
    addWeapon: '+ Weapon',
    equipped: 'Equipped',
    unequipped: 'Unequipped',
    nothingEquipped: 'Nothing equipped.',
    nothingUnequipped: 'Nothing unequipped.',
    // Drones section
    drones: 'Drones',
    addDrone: '+ Drone',
    noDrones: 'No drones. Add one to mount weapons on it.',
    noWeapons: 'No weapons.',
    deleteDrone: 'Delete drone',
    deleteDroneConfirm: (name, n) => (n > 0
      ? `Delete drone "${name}" and its ${n} weapon(s)?`
      : `Delete drone "${name}"?`),
    // Weapon card
    edit: 'Edit',
    remove: 'Remove',
    removeWeaponConfirm: (name) => `Remove ${name}?`,
    set: 'Set',
    setLoadedPrompt: 'Set loaded rounds:',
    reload: 'Reload',
    ammoSwitchTitle: 'Switch ammo — returns loaded rounds to their pool, reloads from the chosen one',
    noAmmoTitle: 'No reserve ammo for this weapon type — add a pool in Reserve ammo',
    noReserveForCategory: (cat) => `No reserve ammo for ${cat}. Add a pool in the Reserve section or use Set.`,
    noTypeInReserve: (type) => `No ${type} in reserve. Pick an available type from the Ammo dropdown.`,
    // Edit-weapon prompts
    weaponNamePrompt: 'Weapon name:',
    magazineCapacityPrompt: 'Magazine capacity:',
    ammoCategoryPrompt: (list) => `Ammo category ref (e.g. ${list}):`,
    mountPrompt: 'Mount (carried or a vehicle name):',
    firingModesPrompt: 'Firing modes as MODE:rounds, comma-separated (e.g. SA:1, BF:3, FA:6). Leave blank for none:',
    notesPrompt: 'Notes:',
    // Reserve section
    reserveAmmo: 'Reserve ammo',
    addPool: '+ Pool',
    noSpareAmmo: 'No spare ammo tracked.',
    // Add-pool modal
    addAmmoPool: 'Add ammo pool',
    weapon: 'Weapon',
    ammoType: 'Ammo type',
    amount: 'Amount',
    mergeHint: (cat, type, from, to) => `Will merge into ${cat} / ${type}: ${from} → ${to}`,
    // Add-drone modal
    addDroneTitle: 'Add drone',
    droneNamePlaceholder: 'Drone name',
    name: 'Name',
    // Add-weapon modal
    addWeaponTitle: 'Add weapon',
    weaponNamePlaceholder: 'Weapon name',
    weaponType: 'Weapon type',
    maxAmmoCapacity: 'Max ammo capacity',
    firingModes: 'Firing modes',
    // Shared modal buttons
    cancel: 'Cancel',
    add: 'Add',
  },
  de: {
    language: 'Sprache',
    characters: 'Charaktere',
    newCharacter: '+ Neuer Charakter',
    characterNamePrompt: 'Charaktername?',
    noCharacters: 'Noch keine Charaktere. Füge einen hinzu oder importiere unten aus XML.',
    rename: 'Umbenennen',
    newNamePrompt: 'Neuer Name?',
    del: 'Löschen',
    deleteCharacterConfirm: (name) => `"${name}" löschen? Dies kann nicht rückgängig gemacht werden.`,
    characterNotFound: 'Charakter nicht gefunden.',
    importXml: 'XML importieren',
    exportJson: 'JSON exportieren',
    importJson: 'JSON importieren',
    importFailed: (msg) => `Import fehlgeschlagen: ${msg}`,
    noCharactersInFile: 'Keine Charaktere in der Datei gefunden – nichts importiert.',
    importedCount: (n) => `${n} Charakter(e) importiert.`,
    weapons: 'Waffen',
    addWeapon: '+ Waffe',
    equipped: 'Ausgerüstet',
    unequipped: 'Verstaut',
    nothingEquipped: 'Nichts ausgerüstet.',
    nothingUnequipped: 'Nichts verstaut.',
    drones: 'Drohnen',
    addDrone: '+ Drohne',
    noDrones: 'Keine Drohnen. Füge eine hinzu, um Waffen daran zu montieren.',
    noWeapons: 'Keine Waffen.',
    deleteDrone: 'Drohne löschen',
    deleteDroneConfirm: (name, n) => (n > 0
      ? `Drohne "${name}" und ihre ${n} Waffe(n) löschen?`
      : `Drohne "${name}" löschen?`),
    edit: 'Bearbeiten',
    remove: 'Entfernen',
    removeWeaponConfirm: (name) => `${name} entfernen?`,
    set: 'Setzen',
    setLoadedPrompt: 'Geladene Patronen setzen:',
    reload: 'Nachladen',
    ammoSwitchTitle: 'Munition wechseln – geladene Patronen wandern zurück in ihren Pool, dann wird aus dem gewählten Pool nachgeladen',
    noAmmoTitle: 'Keine Reservemunition für diesen Waffentyp – lege einen Pool unter Reservemunition an',
    noReserveForCategory: (cat) => `Keine Reservemunition für ${cat}. Lege einen Pool im Reserve-Bereich an oder nutze Setzen.`,
    noTypeInReserve: (type) => `Kein ${type} im Vorrat. Wähle einen verfügbaren Typ aus dem Munitions-Dropdown.`,
    weaponNamePrompt: 'Waffenname:',
    magazineCapacityPrompt: 'Magazingröße:',
    ammoCategoryPrompt: (list) => `Munitionskategorie (z. B. ${list}):`,
    mountPrompt: 'Halterung (getragen oder Fahrzeugname):',
    firingModesPrompt: 'Feuermodi als MODUS:Patronen, kommagetrennt (z. B. SA:1, BF:3, FA:6). Leer lassen für keine:',
    notesPrompt: 'Notizen:',
    reserveAmmo: 'Reservemunition',
    addPool: '+ Pool',
    noSpareAmmo: 'Keine Reservemunition erfasst.',
    addAmmoPool: 'Munitionsvorrat hinzufügen',
    weapon: 'Waffe',
    ammoType: 'Munitionstyp',
    amount: 'Menge',
    mergeHint: (cat, type, from, to) => `Wird zusammengeführt mit ${cat} / ${type}: ${from} → ${to}`,
    addDroneTitle: 'Drohne hinzufügen',
    droneNamePlaceholder: 'Drohnenname',
    name: 'Name',
    addWeaponTitle: 'Waffe hinzufügen',
    weaponNamePlaceholder: 'Waffenname',
    weaponType: 'Waffentyp',
    maxAmmoCapacity: 'Max. Magazingröße',
    firingModes: 'Feuermodi',
    cancel: 'Abbrechen',
    add: 'Hinzufügen',
  },
};

export function translate(lang, key, ...params) {
  const table = STRINGS[lang] || STRINGS.en;
  let v = table[key];
  if (v === undefined) v = STRINGS.en[key];
  if (v === undefined) return key;
  return typeof v === 'function' ? v(...params) : v;
}
