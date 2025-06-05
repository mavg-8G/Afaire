// Basic service worker
// This file allows navigator.serviceWorker.register('/sw.js') to succeed.
// Future enhancements can add caching strategies or push notification listeners here.

self.addEventListener('install', (event) => {
  // console.log('Service Worker: Install');
  // event.waitUntil(self.skipWaiting()); // Optionally activate immediately
});

self.addEventListener('activate', (event) => {
  // console.log('Service Worker: Activate');
  // event.waitUntil(self.clients.claim()); // Optionally take control of open clients immediately
});

self.addEventListener('fetch', (event) => {
  // console.log('Service Worker: Fetch', event.request.url);
  // For now, just pass through network requests
  // event.respondWith(fetch(event.request));
});

self.addEventListener('message', (event) => {
  // console.log('Service Worker: Message received', event.data);
  if (event.data && event.data.type === 'GET_INITIAL_STATE') {
    // In a real scenario, you might load state from IndexedDB or cache
    // For now, just acknowledge and send back a basic state
    // This part should match what the AppProvider expects or can handle
    event.ports[0].postMessage({
      type: 'TIMER_STATE',
      payload: {
        phase: 'off', // Default initial state
        timeRemaining: 25 * 60,
        isRunning: false,
        cyclesCompleted: 0,
      },
    });
  }
});
