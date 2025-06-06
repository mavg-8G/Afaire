// This service worker file is no longer used for Pomodoro functionality.
// If not used for other PWA features (like caching strategies or push notifications unrelated to Pomodoro),
// this file can be safely deleted from your '/public' directory.
// Ensure your PWA setup (e.g., manifest.json or service worker registration logic) is updated
// if you delete this file and it was being registered.

self.addEventListener('install', (event) => {
  // console.log('Service Worker: No longer used for Pomodoro - install event');
});

self.addEventListener('activate', (event) => {
  // console.log('Service Worker: No longer used for Pomodoro - activate event');
});

self.addEventListener('fetch', (event) => {
  // console.log('Service Worker: No longer used for Pomodoro - fetch event');
  // event.respondWith(fetch(event.request)); // Basic pass-through
});
