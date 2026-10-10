// Service worker: keeps a copy of the app itself on the phone so it opens with no signal.
// It never touches your data, which Firestore keeps offline on its own.
//
// To release a change: bump VERSION here and in js/version.js. The app then shows
// "Update available" and switches over when Refresh is tapped.

const VERSION = '0.6.0';
const CACHE = `daily-log-${VERSION}`;
const SDK_CACHE = 'firebase-sdk'; // versioned by its own URLs, so it survives app updates

// Every file the app needs to start. A test fails if one is missing from this list.
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/exercises.js',
  'js/firebase-config.js',
  'js/food.js',
  'js/foods.js',
  'js/guide.js',
  'js/plan.js',
  'js/progress.js',
  'js/pwa.js',
  'js/rules.js',
  'js/settings.js',
  'js/state.js',
  'js/store.js',
  'js/today.js',
  'js/ui.js',
  'js/version.js',
  'js/workout.js',
  'fonts/barlow-400.woff2',
  'fonts/barlow-500.woff2',
  'fonts/barlow-600.woff2',
  'fonts/barlow-condensed-700.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.startsWith('daily-log-') && k !== CACHE).map((k) => caches.delete(k)))));
});

// The page sends this when Refresh is tapped on the update prompt.
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const own = url.origin === location.origin;
  const sdk = url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!own && !sdk) return; // everything else (the database, sign-in) goes straight to the network

  e.respondWith(caches.match(e.request, { ignoreSearch: own }).then((hit) => hit ?? fetch(e.request).then((res) => {
    if (sdk && res.ok) {
      const copy = res.clone();
      caches.open(SDK_CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  })));
});
