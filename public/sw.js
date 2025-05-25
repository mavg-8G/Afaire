
// Service Worker for Pomodoro Timer
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
    pomodoroWorkSessionEnded: "Work Session Ended!",
    pomodoroShortBreakEnded: "Short Break Over!",
    pomodoroLongBreakEnded: "Long Break Over!",
    pomodoroTakeAShortBreak: "Time for a short break (5 min).",
    pomodoroTakeALongBreak: "Time for a long break (15 min)!",
    pomodoroBackToWork: "Time to get back to work!",
  },
  es: {
    pomodoroWorkSessionEnded: "¡Sesión de Trabajo Terminada!",
    pomodoroShortBreakEnded: "¡Descanso Corto Terminado!",
    pomodoroLongBreakEnded: "¡Descanso Largo Terminado!",
    pomodoroTakeAShortBreak: "Tiempo para un descanso corto (5 min).",
    pomodoroTakeALongBreak: "¡Tiempo para un descanso largo (15 min)!",
    pomodoroBackToWork: "¡Hora de volver al trabajo!",
  },
  fr: {
    pomodoroWorkSessionEnded: "Session de travail terminée !",
    pomodoroShortBreakEnded: "Petite pause terminée !",
    pomodoroLongBreakEnded: "Longue pause terminée !",
    pomodoroTakeAShortBreak: "C'est l'heure d'une petite pause (5 min).",
    pomodoroTakeALongBreak: "C'est l'heure d'une longue pause (15 min) !",
    pomodoroBackToWork: "C'est l'heure de retourner au travail !",
  }
};

function getTranslation(key, locale = 'en') {
  const lang = translations[locale] || translations.en;
  return lang[key] || `[${locale.toUpperCase()}] ${key}`;
}


function showUINotification(titleKey, bodyKey) {
  if (self.registration && self.registration.showNotification) {
    const title = getTranslation(titleKey, currentLocale);
    const body = getTranslation(bodyKey, currentLocale);
    console.log(`[SW] Showing system notification: Title: "${title}", Body: "${body}", Locale: ${currentLocale}`);
    self.registration.showNotification(title, {
      body: body,
      icon: '/icons/icon-192x192.png', // Ensure this icon exists
    }).catch(err => {
      console.error('[SW] Error showing notification:', err);
    });
  } else {
    console.warn('[SW] Notification API not available in this Service Worker context.');
  }
}

function tick() {
  if (!isRunning) {
    console.log('[SW] Tick called but timer is not running. Clearing interval if any.');
    if (timerId) clearInterval(timerId);
    timerId = null;
    return;
  }

  timeRemaining--;
  // console.log(`[SW] Tick: ${phase} - ${timeRemaining}s remaining. Running: ${isRunning}`);

  if (timeRemaining < 0) {
    isRunning = false;
    if (timerId) clearInterval(timerId);
    timerId = null;
    const previousPhase = phase;

    if (previousPhase === 'work') {
      cyclesCompleted++;
      if (cyclesCompleted > 0 && cyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0) {
        phase = 'longBreak';
        timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
        showUINotification('pomodoroWorkSessionEnded', 'pomodoroTakeALongBreak');
      } else {
        phase = 'shortBreak';
        timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
        showUINotification('pomodoroWorkSessionEnded', 'pomodoroTakeAShortBreak');
      }
    } else if (previousPhase === 'shortBreak') {
      phase = 'work';
      timeRemaining = POMODORO_WORK_DURATION_SECONDS;
      showUINotification('pomodoroShortBreakEnded', 'pomodoroBackToWork');
    } else if (previousPhase === 'longBreak') {
      phase = 'work';
      timeRemaining = POMODORO_WORK_DURATION_SECONDS;
      cyclesCompleted = 0; // Reset cycles after a long break
      showUINotification('pomodoroLongBreakEnded', 'pomodoroBackToWork');
    }
    isRunning = true; // Auto-start next phase
    startTimer(); // Start timer for the new phase
    broadcastState(true, previousPhase); // Indicate phase just changed
    return; // Return early as state has changed
  }
  broadcastState(false); // Phase did not change in this tick
}

function startTimer() {
  console.log(`[SW] startTimer called. Phase: ${phase}, Time: ${timeRemaining}, isRunning: ${isRunning}`);
  if (timerId) {
    console.log('[SW] Clearing existing timerId before starting new one.');
    clearInterval(timerId);
  }
  if (isRunning && phase !== 'off') {
    console.log('[SW] Setting new interval.');
    timerId = setInterval(tick, 1000);
  } else {
    console.log('[SW] Timer not started because isRunning is false or phase is off.');
    if (timerId) clearInterval(timerId); // Ensure it's cleared if conditions not met
    timerId = null;
  }
}

function broadcastState(phaseJustChanged = false, previousPhase = undefined) {
  // console.log(`[SW] Broadcasting state: Phase: ${phase}, Time: ${timeRemaining}, Running: ${isRunning}, Cycles: ${cyclesCompleted}, PhaseJustChanged: ${phaseJustChanged}, PrevPhase: ${previousPhase}`);
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
    if (!clients || clients.length === 0) {
        console.log('[SW] broadcastState: No clients to send to.');
        return;
    }
    clients.forEach(client => {
      client.postMessage({
        type: 'TIMER_STATE',
        payload: {
          phase,
          timeRemaining,
          isRunning,
          cyclesCompleted,
          phaseJustChanged,
          previousPhase
        }
      });
    });
  }).catch(err => console.error('[SW] Error in broadcastState clients.matchAll:', err));
}


self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('[SW] Clients claimed. Broadcasting initial state from activate.');
      broadcastState(); // Broadcast current state to newly controlled clients
    }).catch(err => console.error('[SW] Error in clients.claim() or initial broadcastState:', err))
  );
});

self.addEventListener('message', (event) => {
  console.log('[SW] Received message from client:', event.data);
  if (!event.data || !event.data.type) {
    console.warn('[SW] Received malformed message:', event.data);
    return;
  }

  const { type, payload } = event.data;

  if (payload && payload.locale) {
    currentLocale = payload.locale;
    console.log(`[SW] Locale updated to: ${currentLocale}`);
  }

  try {
    switch (type) {
      case 'START_WORK':
        console.log('[SW] Handling START_WORK');
        phase = 'work';
        timeRemaining = POMODORO_WORK_DURATION_SECONDS;
        isRunning = true;
        cyclesCompleted = 0; // Reset cycles when manually starting work
        startTimer();
        broadcastState(true, 'off');
        break;
      case 'START_SHORT_BREAK':
        console.log('[SW] Handling START_SHORT_BREAK');
        phase = 'shortBreak';
        timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
        isRunning = true;
        startTimer();
        broadcastState(true, 'off');
        break;
      case 'START_LONG_BREAK':
        console.log('[SW] Handling START_LONG_BREAK');
        phase = 'longBreak';
        timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
        isRunning = true;
        startTimer();
        broadcastState(true, 'off');
        break;
      case 'PAUSE_TIMER':
        console.log('[SW] Handling PAUSE_TIMER');
        if (isRunning) {
          isRunning = false;
          if (timerId) clearInterval(timerId);
          timerId = null;
          console.log('[SW] Timer paused. Interval cleared.');
        }
        broadcastState();
        break;
      case 'RESUME_TIMER':
        console.log('[SW] Handling RESUME_TIMER');
        if (!isRunning && phase !== 'off') {
          isRunning = true;
          startTimer();
          console.log('[SW] Timer resumed.');
        } else {
          console.log('[SW] Resume called but timer was already running or phase is off.');
        }
        broadcastState();
        break;
      case 'RESET_TIMER':
        console.log('[SW] Handling RESET_TIMER');
        phase = 'off';
        timeRemaining = POMODORO_WORK_DURATION_SECONDS;
        isRunning = false;
        cyclesCompleted = 0;
        if (timerId) clearInterval(timerId);
        timerId = null;
        console.log('[SW] Timer reset. Interval cleared.');
        broadcastState(true, phase); // Send previous phase as current phase to signal UI reset
        break;
      case 'GET_INITIAL_STATE':
        console.log('[SW] Handling GET_INITIAL_STATE. Broadcasting current state.');
        if (event.source) {
          console.log('[SW] Posting state directly to client:', event.source.id);
          event.source.postMessage({
            type: 'TIMER_STATE',
            payload: { phase, timeRemaining, isRunning, cyclesCompleted, phaseJustChanged: false }
          }).catch(err => console.error('[SW] Error posting directly to client:', err));
        } else {
            broadcastState(); // Fallback to broadcast if event.source is not available
        }
        break;
      default:
        console.warn('[SW] Received unknown message type:', type);
    }
  } catch (error) {
      console.error('[SW] Error processing message:', type, payload, error);
      if (event.source) {
          event.source.postMessage({ type: 'SW_ERROR', payload: { message: error.message, stack: error.stack }});
      }
  }
});
