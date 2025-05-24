
// public/sw.js
console.log('[SW] Service Worker script evaluating/re-evaluating. Timestamp:', Date.now());

const POMODORO_WORK_DURATION_SECONDS = 25 * 60;
const POMODORO_SHORT_BREAK_DURATION_SECONDS = 5 * 60;
const POMODORO_LONG_BREAK_DURATION_SECONDS = 15 * 60;
const POMODORO_CYCLES_BEFORE_LONG_BREAK = 4;

let phase = 'off'; // 'work', 'shortBreak', 'longBreak', 'off'
let timeRemaining = POMODORO_WORK_DURATION_SECONDS;
let isRunning = false;
let cyclesCompleted = 0;
let timerId = null;
let currentLocale = 'en'; // Default locale

const translations = {
  en: {
    pomodoroWorkSession: "Work Session",
    pomodoroShortBreakSession: "Short Break",
    pomodoroLongBreakSession: "Long Break",
    pomodoroWorkSessionEnded: "Work Session Ended!",
    pomodoroShortBreakEnded: "Short Break Ended!",
    pomodoroLongBreakEnded: "Long Break Ended!",
    pomodoroTakeAShortBreak: "Time for a short break (5 min).",
    pomodoroTakeALongBreak: "Time for a long break (15 min).",
    pomodoroBackToWork: "Time to get back to work!",
  },
  es: {
    pomodoroWorkSession: "Sesión de Trabajo",
    pomodoroShortBreakSession: "Descanso Corto",
    pomodoroLongBreakSession: "Descanso Largo",
    pomodoroWorkSessionEnded: "¡Sesión de Trabajo Terminada!",
    pomodoroShortBreakEnded: "¡Descanso Corto Terminado!",
    pomodoroLongBreakEnded: "¡Descanso Largo Terminado!",
    pomodoroTakeAShortBreak: "Tiempo para un descanso corto (5 min).",
    pomodoroTakeALongBreak: "Tiempo para un descanso largo (15 min).",
    pomodoroBackToWork: "¡Hora de volver al trabajo!",
  },
  fr: {
    pomodoroWorkSession: "Session de Travail",
    pomodoroShortBreakSession: "Petite Pause",
    pomodoroLongBreakSession: "Longue Pause",
    pomodoroWorkSessionEnded: "Session de travail terminée !",
    pomodoroShortBreakEnded: "Petite pause terminée !",
    pomodoroLongBreakEnded: "Longue pause terminée !",
    pomodoroTakeAShortBreak: "C'est l'heure d'une petite pause (5 min).",
    pomodoroTakeALongBreak: "C'est l'heure d'une longue pause (15 min).",
    pomodoroBackToWork: "Retour au travail !",
  }
};

function getTranslation(key, locale = 'en') {
  const lang = translations[locale] || translations.en;
  return lang[key] || translations.en[key] || key;
}


function broadcastState() {
  console.log('[SW] Broadcasting state:', { phase, timeRemaining, isRunning, cyclesCompleted });
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'TIMER_STATE',
        payload: { phase, timeRemaining, isRunning, cyclesCompleted, /* phaseJustChanged and previousPhase would need more logic */ }
      });
    });
  });
}

function showUINotification(titleKey, bodyKey) {
  const title = getTranslation(titleKey, currentLocale);
  const body = getTranslation(bodyKey, currentLocale);
  console.log(`[SW] Attempting to show notification: Title - "${title}", Body - "${body}"`);
  if (self.registration && self.registration.showNotification) {
    self.registration.showNotification(title, {
      body: body,
      icon: '/icons/icon-192x192.png', // Ensure this icon exists in public/icons
    }).then(() => {
      console.log('[SW] Notification shown successfully.');
    }).catch(err => {
      console.error('[SW] Error showing notification:', err);
    });
  } else {
    console.warn('[SW] self.registration.showNotification not available.');
  }
}

function tick() {
  if (!isRunning) {
    console.log('[SW] Tick called but isRunning is false. Clearing timerId if exists:', timerId);
    if (timerId) clearInterval(timerId);
    timerId = null;
    return;
  }

  timeRemaining--;
  console.log('[SW] Tick... Remaining:', timeRemaining, 'Phase:', phase, 'IsRunning:', isRunning);

  if (timeRemaining < 0) {
    if (timerId) clearInterval(timerId);
    timerId = null;
    isRunning = false;

    let notificationTitleKey = '';
    let notificationBodyKey = '';

    if (phase === 'work') {
      cyclesCompleted++;
      notificationTitleKey = 'pomodoroWorkSessionEnded';
      if (cyclesCompleted > 0 && cyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0) {
        phase = 'longBreak';
        timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
        notificationBodyKey = 'pomodoroTakeALongBreak';
      } else {
        phase = 'shortBreak';
        timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
        notificationBodyKey = 'pomodoroTakeAShortBreak';
      }
    } else if (phase === 'shortBreak' || phase === 'longBreak') {
      notificationTitleKey = phase === 'shortBreak' ? 'pomodoroShortBreakEnded' : 'pomodoroLongBreakEnded';
      notificationBodyKey = 'pomodoroBackToWork';
      phase = 'work'; // Always back to work after any break
      timeRemaining = POMODORO_WORK_DURATION_SECONDS;
    }
    console.log('[SW] Phase ended. New phase:', phase, 'New timeRemaining:', timeRemaining, 'Cycles completed:', cyclesCompleted);
    showUINotification(notificationTitleKey, notificationBodyKey);
    // Do not automatically start the next phase's timer; user should initiate.
    // startTimer(); // Removed this to avoid auto-start
  }
  broadcastState();
}

function startTimer() {
  console.log('[SW] startTimer called. Current isRunning:', isRunning, 'Current timerId:', timerId);
  if (isRunning && !timerId) { // Ensure isRunning is true and no timer is already set
    console.log('[SW] Starting new interval. Phase:', phase, 'Time Remaining:', timeRemaining);
    // tick(); // Call tick immediately to update UI, then set interval
    timerId = setInterval(tick, 1000);
  } else if (!isRunning && timerId) {
    console.log('[SW] startTimer called but isRunning is false. Clearing existing timerId:', timerId);
    clearInterval(timerId);
    timerId = null;
  } else if (isRunning && timerId) {
    console.log('[SW] startTimer called, but isRunning is true and timerId already exists. Doing nothing to prevent multiple timers.');
  }
  broadcastState();
}

self.addEventListener('install', (event) => {
  console.log('[SW] Install event. Timestamp:', Date.now());
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event. Timestamp:', Date.now());
  event.waitUntil(self.clients.claim()); // Become available to all pages
  broadcastState(); // Broadcast initial state on activation
});

self.addEventListener('message', (event) => {
  if (!event.data) {
    console.log('[SW] Received message with no data.');
    return;
  }
  console.log('[SW] Received message from client:', event.data);

  const { type, locale } = event.data;
  if (locale) {
    currentLocale = locale;
    console.log('[SW] Updated currentLocale to:', currentLocale);
  }

  try {
    switch (type) {
      case 'GET_INITIAL_STATE':
        console.log('[SW] GET_INITIAL_STATE command received. Broadcasting current state.');
        broadcastState();
        break;
      case 'START_WORK':
        console.log('[SW] START_WORK command received.');
        if (phase !== 'work' || !isRunning) { // Start fresh or if paused in work
            phase = 'work';
            timeRemaining = POMODORO_WORK_DURATION_SECONDS;
            // cyclesCompleted = 0; // Reset cycles only when starting work from 'off' or after a break
            if (!isRunning && (phase === 'off' || phase === 'shortBreak' || phase === 'longBreak')) {
                 // This condition might need refinement. If we are explicitly told to START_WORK,
                 // we should probably reset cycles if we are not *resuming* a work session.
            }
        }
        isRunning = true;
        startTimer();
        break;
      case 'START_SHORT_BREAK':
        console.log('[SW] START_SHORT_BREAK command received.');
        phase = 'shortBreak';
        timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
        isRunning = true;
        startTimer();
        break;
      case 'START_LONG_BREAK':
        console.log('[SW] START_LONG_BREAK command received.');
        phase = 'longBreak';
        timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
        isRunning = true;
        startTimer();
        break;
      case 'PAUSE_TIMER':
        console.log('[SW] PAUSE_TIMER command received. Current timerId:', timerId);
        isRunning = false;
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
          console.log('[SW] Timer paused and interval cleared.');
        } else {
          console.log('[SW] PAUSE_TIMER: No active timerId to clear.');
        }
        broadcastState(); // Broadcast paused state
        break;
      case 'RESUME_TIMER':
        console.log('[SW] RESUME_TIMER command received. Current phase:', phase);
        if (phase !== 'off' && !isRunning) {
          isRunning = true;
          startTimer(); // This will create a new interval
        } else {
          console.log('[SW] RESUME_TIMER: Conditions not met or already running. Phase:', phase, 'IsRunning:', isRunning);
        }
        break;
      case 'RESET_TIMER':
        console.log('[SW] RESET_TIMER command received. Current timerId:', timerId);
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
          console.log('[SW] Timer reset and interval cleared.');
        } else {
          console.log('[SW] RESET_TIMER: No active timerId to clear.');
        }
        phase = 'off';
        timeRemaining = POMODORO_WORK_DURATION_SECONDS;
        isRunning = false;
        cyclesCompleted = 0;
        broadcastState();
        break;
      default:
        console.log('[SW] Unknown message type received:', type);
    }
  } catch (error) {
    console.error('[SW] Error processing message:', type, error);
    // Optionally, notify client about the error
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ERROR',
            payload: { message: error.message, commandType: type }
          });
        });
      });
  }
});

console.log('[SW] Event listeners for install, activate, message set up.');
