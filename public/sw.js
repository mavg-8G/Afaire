
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
    pomodoroWorkSessionEnded: "Work Session Ended",
    pomodoroShortBreakEnded: "Short Break Ended",
    pomodoroLongBreakEnded: "Long Break Ended",
    pomodoroTakeAShortBreak: "Time for a short break!",
    pomodoroTakeALongBreak: "Time for a long break!",
    pomodoroBackToWork: "Time to get back to work!",
  },
  es: {
    pomodoroWorkSessionEnded: "Sesión de Trabajo Terminada",
    pomodoroShortBreakEnded: "Descanso Corto Terminado",
    pomodoroLongBreakEnded: "Descanso Largo Terminado",
    pomodoroTakeAShortBreak: "¡Tiempo para un descanso corto!",
    pomodoroTakeALongBreak: "¡Tiempo para un descanso largo!",
    pomodoroBackToWork: "¡Hora de volver al trabajo!",
  },
  fr: {
    pomodoroWorkSessionEnded: "Session de travail terminée",
    pomodoroShortBreakEnded: "Pause courte terminée",
    pomodoroLongBreakEnded: "Longue pause terminée",
    pomodoroTakeAShortBreak: "C'est l'heure d'une courte pause !",
    pomodoroTakeALongBreak: "C'est l'heure d'une longue pause !",
    pomodoroBackToWork: "C'est l'heure de retourner au travail !",
  }
};

function getTranslation(key, locale) {
  const effectiveLocale = translations[locale] ? locale : 'en';
  return translations[effectiveLocale][key] || translations['en'][key] || key;
}

function showUINotification(titleKey, descriptionKey) { // Removed phaseForIcon, icon is fixed
  const title = getTranslation(titleKey, currentLocale);
  const description = getTranslation(descriptionKey, currentLocale);
  console.log(`[SW] Showing notification: Title: "${title}", Description: "${description}", Locale: ${currentLocale}`);

  if (self.registration && self.registration.showNotification) {
    self.registration.showNotification(title, {
      body: description,
      icon: `/icons/icon-192x192.png`,
      lang: currentLocale,
      tag: `pomodoro-phase-end-${Date.now()}` // Unique tag to prevent stacking if user doesn't dismiss
    }).catch(err => console.error('[SW] Error showing notification:', err));
  } else {
    console.warn('[SW] Notification API not available on self.registration.');
  }
}

async function broadcastState(phaseJustChanged = false, previousPhase = undefined) {
  const statePayload = { phase, timeRemaining, isRunning, cyclesCompleted, phaseJustChanged, previousPhase };
  console.log(`[SW] Broadcasting state:`, statePayload);
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    if (!clients || clients.length === 0) {
        console.log('[SW] No clients found to broadcast state to.');
        return;
    }
    console.log('[SW] Found clients for broadcast:', clients.map(c => c.id));
    clients.forEach(client => {
      console.log('[SW] Posting TIMER_STATE to client:', client.id);
      client.postMessage({
        type: 'TIMER_STATE',
        payload: statePayload
      });
    });
  } catch (error) {
      console.error('[SW] Error during broadcastState:', error);
  }
}

function tick() {
  if (!isRunning) {
    // console.log('[SW] Tick called but not isRunning, clearing interval if any.');
    if (timerId) clearInterval(timerId); // Ensure interval stops if isRunning became false elsewhere
    timerId = null;
    return;
  }
  timeRemaining--;

  if (timeRemaining < 0) {
    const oldPhase = phase;
    if (phase === 'work') {
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
    } else if (phase === 'shortBreak' || phase === 'longBreak') {
      phase = 'work';
      timeRemaining = POMODORO_WORK_DURATION_SECONDS;
      // For a more robust cycle, when a break ends, we might not reset cyclesCompleted here.
      // cyclesCompleted should strictly count 'work' sessions.
      showUINotification(oldPhase === 'shortBreak' ? 'pomodoroShortBreakEnded' : 'pomodoroLongBreakEnded', 'pomodoroBackToWork');
    }
    broadcastState(true, oldPhase);
  } else {
    broadcastState();
  }
}

function startTimer() {
  console.log(`[SW] startTimer called. phase=${phase}, current isRunning=${isRunning}, timeRemaining=${timeRemaining}`);
  if (isRunning && timerId) {
    console.log('[SW] Timer already running with active interval, doing nothing.');
    return;
  }
  if (phase === 'off') {
    console.warn('[SW] Attempted to start timer while phase is off. Resetting to work phase.');
    resetTimerValues('work'); // Default to work if trying to start from 'off'
  }
  isRunning = true;
  if (timerId) clearInterval(timerId);
  // tick(); // No initial manual tick; setInterval will handle the first tick
  timerId = setInterval(tick, 1000);
  console.log(`[SW] Timer started with interval ID: ${timerId}. isRunning set to true.`);
  broadcastState();
}

function pauseTimer() {
  console.log(`[SW] pauseTimer called. current isRunning=${isRunning}`);
  if (!isRunning && timerId === null) { // Already paused
      console.log('[SW] Timer already paused, doing nothing.');
      return;
  }
  isRunning = false;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log('[SW] Timer interval cleared. isRunning set to false.');
  } else {
    console.log('[SW] pauseTimer called, but no active timerId. Ensuring isRunning is false.');
  }
  broadcastState();
}

function resetTimerValues(newPhase) {
  console.log(`[SW] resetTimerValues called with newPhase: ${newPhase}`);
  phase = newPhase;
  isRunning = false;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log('[SW] Timer interval cleared during resetTimerValues.');
  }

  if (phase === 'work') {
    timeRemaining = POMODORO_WORK_DURATION_SECONDS;
    cyclesCompleted = 0; // Reset cycles when work phase is explicitly set/reset
  } else if (phase === 'shortBreak') {
    timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
  } else if (phase === 'longBreak') {
    timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
  } else { // 'off'
    timeRemaining = POMODORO_WORK_DURATION_SECONDS; // Default to work duration when off
    cyclesCompleted = 0;
  }
  console.log(`[SW] Timer values reset. New phase: ${phase}, timeRemaining: ${timeRemaining}, cyclesCompleted: ${cyclesCompleted}, isRunning: ${isRunning}`);
}


function handleStartWork() {
    console.log('[SW] Handling START_WORK');
    // If already in work and running, do nothing. If paused, resume. If different phase, reset.
    if (phase !== 'work') {
        resetTimerValues('work');
    } else if (!isRunning) { // In work phase but paused
      console.log('[SW] Resuming work phase.');
    } else { // Already in work and running
        console.log('[SW] Work phase already running.');
        broadcastState(); // ensure client knows
        return;
    }
    startTimer();
}

function handleStartShortBreak() {
    console.log('[SW] Handling START_SHORT_BREAK');
    resetTimerValues('shortBreak');
    startTimer();
}

function handleStartLongBreak() {
    console.log('[SW] Handling START_LONG_BREAK');
    resetTimerValues('longBreak');
    startTimer();
}

function handlePauseTimer() {
    console.log('[SW] Handling PAUSE_TIMER');
    pauseTimer();
}

function handleResumeTimer() {
    console.log('[SW] Handling RESUME_TIMER');
    if (phase !== 'off' && !isRunning) {
        console.log('[SW] Resuming timer.');
        startTimer();
    } else if (isRunning) {
        console.log('[SW] Timer already running, cannot resume. Broadcasting state.');
        broadcastState();
    } else {
        console.log('[SW] Cannot resume, phase is off or timer already running. Broadcasting current state.');
        broadcastState();
    }
}

function handleResetTimer() {
    console.log('[SW] Handling RESET_TIMER');
    resetTimerValues('off');
    broadcastState();
}

function handleGetInitialState(event) {
    console.log('[SW] Handling GET_INITIAL_STATE from client:', event.source ? event.source.id : 'unknown client');
    const statePayload = { phase, timeRemaining, isRunning, cyclesCompleted, phaseJustChanged: false, previousPhase: undefined };
    if (event.source && typeof event.source.postMessage === 'function') {
        console.log('[SW] Directly posting state to requester:', event.source.id, statePayload);
        try {
            event.source.postMessage({ type: 'TIMER_STATE', payload: statePayload });
        } catch (e) {
            console.error('[SW] Error posting directly to client:', e, '. Falling back to broadcast.');
            broadcastState(false, undefined); // Fallback
        }
    } else {
        console.warn('[SW] event.source not available or cannot postMessage for GET_INITIAL_STATE. Broadcasting state instead.');
        broadcastState(false, undefined);
    }
}


self.addEventListener('install', (event) => {
  console.log('[SW] Install event. Calling self.skipWaiting().');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event starting...');
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('[SW] Clients claimed in activate event.');
      return broadcastState(false, undefined); // Ensure this returns a promise if broadcastState is async
    }).then(() => {
      console.log('[SW] Initial state broadcast on activate finished.');
    }).catch(err => {
      console.error('[SW] Error during activate event (clients.claim or broadcastState):', err);
    })
  );
  console.log('[SW] Activate event handler setup finished.');
});

self.addEventListener('message', (event) => {
  if (!event.data || !event.data.type) {
    console.warn('[SW] Received message with no data or type:', event);
    return;
  }
  console.log('[SW] Message received from client:', event.data);

  const { type, payload } = event.data;
  const command = type;

  if (payload && payload.locale) {
    currentLocale = payload.locale;
    console.log('[SW] Updated currentLocale to:', currentLocale);
  }

  try {
    switch (command) {
      case 'START_WORK':
        handleStartWork();
        break;
      case 'START_SHORT_BREAK':
        handleStartShortBreak();
        break;
      case 'START_LONG_BREAK':
        handleStartLongBreak();
        break;
      case 'PAUSE_TIMER':
        handlePauseTimer();
        break;
      case 'RESUME_TIMER':
        handleResumeTimer();
        break;
      case 'RESET_TIMER':
        handleResetTimer();
        break;
      case 'GET_INITIAL_STATE':
        handleGetInitialState(event);
        break;
      default:
        console.warn('[SW] Unknown command received:', command);
    }
  } catch (error) {
    console.error('[SW] Error processing command:', command, error);
    const errorPayload = { message: `Error processing command ${command}: ${error.message || String(error)}` };
    if (event.source && typeof event.source.postMessage === 'function') {
        event.source.postMessage({ type: 'SW_ERROR', payload: errorPayload });
    } else {
        const clients = self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.then(allClients => {
            allClients.forEach(client => {
                 client.postMessage({ type: 'SW_ERROR', payload: errorPayload });
            });
        }).catch(e => console.error('[SW] Error broadcasting SW_ERROR:', e));
    }
  }
});

// Keep-alive logic removed for now to simplify debugging initial connection.
// It's often not very effective on mobile anyway.
console.log('[SW] Event listeners set up.');
