
// Service Worker for Pomodoro Timer (public/sw.js)

const WORK_DURATION = 25 * 60; // 25 minutes in seconds
const SHORT_BREAK_DURATION = 5 * 60; // 5 minutes
const LONG_BREAK_DURATION = 15 * 60; // 15 minutes
const CYCLES_BEFORE_LONG_BREAK = 4;

let phase = 'off'; // 'work', 'shortBreak', 'longBreak', 'off'
let timeRemaining = WORK_DURATION;
let isRunning = false;
let intervalId = null;
let cyclesCompleted = 0;
let currentLocale = 'en'; // Default locale

// Basic translations (can be expanded)
const translations = {
  en: {
    pomodoroWorkSessionEnded: "Work Session Ended",
    pomodoroShortBreakEnded: "Short Break Ended",
    pomodoroLongBreakEnded: "Long Break Ended", // Added this key
    pomodoroTakeAShortBreak: "Time for a short break!",
    pomodoroTakeALongBreak: "Time for a long break!",
    pomodoroBackToWork: "Time to get back to work!",
    pomodoroErrorTitle: "Pomodoro Error", // For consistency
    pomodoroSWNotReady: "Service Worker for Pomodoro not ready.", // For consistency
    pomodoroInitializing: "Initializing...", // For consistency
  },
  es: {
    pomodoroWorkSessionEnded: "Sesión de Trabajo Terminada",
    pomodoroShortBreakEnded: "Descanso Corto Terminado",
    pomodoroLongBreakEnded: "Descanso Largo Terminado", // Added this key
    pomodoroTakeAShortBreak: "¡Tiempo para un descanso corto!",
    pomodoroTakeALongBreak: "¡Tiempo para un descanso largo!",
    pomodoroBackToWork: "¡Hora de volver al trabajo!",
    pomodoroErrorTitle: "Error de Pomodoro",
    pomodoroSWNotReady: "Service Worker para Pomodoro no listo.",
    pomodoroInitializing: "Inicializando...",
  },
  fr: {
    pomodoroWorkSessionEnded: "Session de travail terminée",
    pomodoroShortBreakEnded: "Courte pause terminée",
    pomodoroLongBreakEnded: "Longue pause terminée", // Added this key
    pomodoroTakeAShortBreak: "C'est l'heure d'une courte pause !",
    pomodoroTakeALongBreak: "C'est l'heure d'une longue pause !",
    pomodoroBackToWork: "C'est l'heure de retourner au travail !",
    pomodoroErrorTitle: "Erreur Pomodoro",
    pomodoroSWNotReady: "Service Worker pour Pomodoro non prêt.",
    pomodoroInitializing: "Initialisation...",
  }
};


self.addEventListener('install', (event) => {
  console.log('SW: Install event');
  event.waitUntil(self.skipWaiting()); // Activate new SW immediately
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activate event');
  event.waitUntil(self.clients.claim()); // Take control of all clients
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  console.log('SW: Message received:', event.data);

  if (event.data.payload && event.data.payload.locale) {
    currentLocale = event.data.payload.locale;
  }

  switch (event.data.type) {
    case 'START_WORK':
      startWork(true, event.data.payload?.locale); // true to reset cycles
      break;
    case 'START_SHORT_BREAK':
      startShortBreak(event.data.payload?.locale);
      break;
    case 'START_LONG_BREAK':
      startLongBreak(false, event.data.payload?.locale); // false to not reset cycles from here
      break;
    case 'PAUSE_TIMER':
      pauseTimer();
      break;
    case 'RESUME_TIMER':
      resumeTimer();
      break;
    case 'RESET_TIMER':
      resetTimer(event.data.payload?.locale);
      break;
    case 'GET_INITIAL_STATE': // Respond with current state
      broadcastState();
      break;
  }
});

function tick() {
  if (!isRunning) {
    console.warn('SW Tick: Called while isRunning is false. Interval should have been cleared. Clearing now.');
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    return;
  }

  // console.log(`SW Tick - Current: ${phase}, Time: ${timeRemaining}, Running: ${isRunning}, Interval: ${intervalId}`);
  timeRemaining--;

  if (timeRemaining < 0) {
    console.log(`SW Tick: Time is up for phase ${phase}. Transitioning...`);
    if (phase === 'work') {
      cyclesCompleted++;
      const notifTitle = translations[currentLocale]?.pomodoroWorkSessionEnded || translations.en.pomodoroWorkSessionEnded;
      const notifBodyKey = (cyclesCompleted > 0 && cyclesCompleted % CYCLES_BEFORE_LONG_BREAK === 0) ? 'pomodoroTakeALongBreak' : 'pomodoroTakeAShortBreak';
      const notifBody = translations[currentLocale]?.[notifBodyKey] || translations.en[notifBodyKey];
      
      if (self.registration && self.registration.showNotification) {
         self.registration.showNotification(notifTitle, { body: notifBody, icon: '/icons/icon-192x192.png' });
      } else {
        console.log("SW: Notification API not available or registration undefined.");
      }

      if (cyclesCompleted > 0 && cyclesCompleted % CYCLES_BEFORE_LONG_BREAK === 0) {
        startLongBreak(false); // false to not reset cycles from here
      } else {
        startShortBreak();
      }
    } else if (phase === 'shortBreak' || phase === 'longBreak') {
      const notifTitle = (phase === 'shortBreak' ? translations[currentLocale]?.pomodoroShortBreakEnded : translations[currentLocale]?.pomodoroLongBreakEnded) || 
                         (phase === 'shortBreak' ? translations.en.pomodoroShortBreakEnded : translations.en.pomodoroLongBreakEnded);
      const notifBody = translations[currentLocale]?.pomodoroBackToWork || translations.en.pomodoroBackToWork;

      if (self.registration && self.registration.showNotification) {
        self.registration.showNotification(notifTitle, { body: notifBody, icon: '/icons/icon-192x192.png' });
      } else {
        console.log("SW: Notification API not available or registration undefined.");
      }
      startWork(phase === 'longBreak'); // true to reset cycles if it was a long break
    }
    // The new phase's start function already handles the new interval and broadcast.
    // So, this tick's job is done.
    return; 
  }
  broadcastState();
}

function broadcastState() {
  // console.log('SW: Broadcasting state:', { phase, timeRemaining, isRunning, cyclesCompleted });
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'TIMER_STATE',
        payload: { phase, timeRemaining, isRunning, cyclesCompleted }
      });
    });
  }).catch(err => console.error("SW: Error broadcasting state:", err));
}

function clearExistingInterval() {
    if (intervalId !== null) {
        console.log('SW: Clearing existing interval ID:', intervalId);
        clearInterval(intervalId);
        intervalId = null;
    }
}

function startWork(resetCycles = true, locale) {
  console.log(`SW: Starting Work. Reset cycles: ${resetCycles}, Locale: ${locale}`);
  if (locale) currentLocale = locale;
  if (resetCycles) cyclesCompleted = 0;
  phase = 'work';
  timeRemaining = WORK_DURATION;
  clearExistingInterval();
  intervalId = setInterval(tick, 1000);
  isRunning = true;
  console.log('SW: Work interval started ID:', intervalId);
  broadcastState();
}

function startShortBreak(locale) {
  console.log(`SW: Starting Short Break. Locale: ${locale}`);
  if (locale) currentLocale = locale;
  phase = 'shortBreak';
  timeRemaining = SHORT_BREAK_DURATION;
  clearExistingInterval();
  intervalId = setInterval(tick, 1000);
  isRunning = true;
  console.log('SW: Short Break interval started ID:', intervalId);
  broadcastState();
}

function startLongBreak(resetCycles = false, locale) { // Typically false when auto-transitioning
  console.log(`SW: Starting Long Break. Reset cycles: ${resetCycles}, Locale: ${locale}`);
  if (locale) currentLocale = locale;
  if (resetCycles) cyclesCompleted = 0; // Only reset if explicitly told (e.g. manual start)
  phase = 'longBreak';
  timeRemaining = LONG_BREAK_DURATION;
  clearExistingInterval();
  intervalId = setInterval(tick, 1000);
  isRunning = true;
  console.log('SW: Long Break interval started ID:', intervalId);
  broadcastState();
}

function pauseTimer() {
  console.log('SW: Pausing timer. Current interval ID:', intervalId);
  clearExistingInterval();
  isRunning = false;
  broadcastState();
}

function resumeTimer() {
  console.log('SW: Resuming timer. Phase:', phase);
  if (!isRunning && phase !== 'off') {
    clearExistingInterval(); // Should be null, but clear just in case
    intervalId = setInterval(tick, 1000);
    isRunning = true;
    console.log('SW: Timer resumed. New interval ID:', intervalId);
    broadcastState();
  } else {
    console.log('SW: Resume called but timer already running or phase is off.');
  }
}

function resetTimer(locale) {
  console.log('SW: Resetting timer. Locale:', locale);
  clearExistingInterval();
  phase = 'off';
  timeRemaining = WORK_DURATION;
  isRunning = false;
  cyclesCompleted = 0;
  if (locale) currentLocale = locale;
  else currentLocale = 'en'; // Reset to default if no locale provided
  broadcastState();
}

// Ensure a key exists in translations[currentLocale] or fallback to 'en'
// This is a conceptual helper, actual usage is inline with `||`
function getTranslation(key, locale) {
    const effectiveLocale = translations[locale] ? locale : 'en';
    return translations[effectiveLocale]?.[key] || translations.en[key] || `Missing translation for ${key}`;
}
