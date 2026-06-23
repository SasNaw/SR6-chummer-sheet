const CACHE = 'sr6-ammo-v9';
const ASSETS = [
  '.', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/app.js', 'js/store.js', 'js/model.js', 'js/util.js', 'js/i18n.js', 'js/catalog.js', 'js/spirit-catalog.js',
  'js/ammo-db.js', 'js/weapons-db.js', 'js/xml-import.js',
  'js/ui/dom.js', 'js/ui/character-picker.js', 'js/ui/character-sheet.js', 'js/ui/io.js',
  'js/ui/sheet-common.js', 'js/ui/weapon-card.js', 'js/ui/modals.js', 'js/ui/spirit-card.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('index.html'))));
});
