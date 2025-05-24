
// Pomodoro Service Worker

const POMODORO_WORK_DURATION_SECONDS = 25 * 60;
const POMODORO_SHORT_BREAK_DURATION_SECONDS = 5 * 60;
const POMODORO_LONG_BREAK_DURATION_SECONDS = 15 * 60;
const POMODORO_CYCLES_BEFORE_LONG_BREAK = 4;

let timerId = null;
let phase = 'off'; // 'work', 'shortBreak', 'longBreak', 'off'
let timeRemaining = POMODORO_WORK_DURATION_SECONDS;
let isRunning = false;
let cyclesCompleted = 0;
let currentLocale = 'en'; // Default locale, will be updated by client messages

const notificationMessages = {
  en: {
    pomodoroWorkSession: "Work Session",
    pomodoroShortBreakSession: "Short Break",
    pomodoroLongBreakSession: "Long Break",
    pomodoroWorkSessionEnded: "Work Session Ended",
    pomodoroShortBreakEnded: "Short Break Ended",
    pomodoroLongBreakEnded: "Long Break Ended",
    pomodoroTakeABreakOrStartNext: "Time for a break or start the next session!", // Generic fallback
    pomodoroTimeForShortBreak: "Time for a short break!",
    pomodoroTimeForLongBreak: "Time for a long break!",
    pomodoroFocusOnTask: "Time to focus on your task!",
    pomodoroTitle: "Pomodoro Timer"
  },
  es: {
    pomodoroWorkSession: "Sesión de Trabajo",
    pomodoroShortBreakSession: "Descanso Corto",
    pomodoroLongBreakSession: "Descanso Largo",
    pomodoroWorkSessionEnded: "Sesión de Trabajo Terminada",
    pomodoroShortBreakEnded: "Descanso Corto Terminado",
    pomodoroLongBreakEnded: "Descanso Largo Terminado",
    pomodoroTakeABreakOrStartNext: "¡Tiempo de un descanso o de iniciar la siguiente sesión!",
    pomodoroTimeForShortBreak: "¡Tiempo para un descanso corto!",
    pomodoroTimeForLongBreak: "¡Tiempo para un descanso largo!",
    pomodoroFocusOnTask: "¡Concéntrate en tu tarea!",
    pomodoroTitle: "Temporizador Pomodoro"
  },
  fr: {
    pomodoroWorkSession: "Session de Travail",
    pomodoroShortBreakSession: "Pause Courte",
    pomodoroLongBreakSession: "Longue Pause",
    pomodoroWorkSessionEnded: "Session de travail terminée",
    pomodoroShortBreakEnded: "Pause courte terminée",
    pomodoroLongBreakEnded: "Longue pause terminée",
    pomodoroTakeABreakOrStartNext: "C'est l'heure d'une pause ou de commencer la session suivante !",
    pomodoroTimeForShortBreak: "C'est l'heure d'une courte pause !",
    pomodoroTimeForLongBreak: "C'est l'heure d'une longue pause !",
    pomodoroFocusOnTask: "Concentrez-vous sur votre tâche !",
    pomodoroTitle: "Minuteur Pomodoro"
  }
};

function getTranslation(key, locale, fallbackLocale = 'en') {
  return notificationMessages[locale]?.[key] || notificationMessages[fallbackLocale]?.[key] || key;
}

async function broadcastState(sourceAction = "unknown") {
  console.log(`[SW] Broadcasting state (triggered by ${sourceAction}): Phase: ${phase}, Time: ${timeRemaining}, Running: ${isRunning}, Cycles: ${cyclesCompleted}, Locale: ${currentLocale}`);
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach(client => {
    client.postMessage({
      type: 'TIMER_STATE',
      payload: {
        phase,
        timeRemaining,
        isRunning,
        cyclesCompleted,
        // Include a flag if phase just changed, potentially with previousPhase
        // This part needs more sophisticated logic if AppProvider is to rely on it
        // For now, AppProvider derives "phase just changed" by comparing with its own previous state.
      }
    });
  });
}

function showUINotification(titleKey, messageKey, previousPhaseForContext = null) {
  const title = getTranslation(titleKey, currentLocale);
  let description;

  if (previousPhaseForContext === 'work' && messageKey === 'pomodoroTakeABreakOrStartNext') {
     // This specific key means the work session just ended. Determine if short or long break is next.
    description = (cyclesCompleted > 0 && cyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0)
        ? getTranslation('pomodoroTimeForLongBreak', currentLocale)
        : getTranslation('pomodoroTimeForShortBreak', currentLocale);
  } else {
    description = getTranslation(messageKey, currentLocale);
  }

  console.log(`[SW] Showing notification: Title: "${title}", Desc: "${description}", Locale: ${currentLocale}`);
  
  if (self.registration && typeof self.registration.showNotification === 'function') {
    return self.registration.showNotification(title, {
      body: description,
      icon: '/icons/icon-192x192.png',
      lang: currentLocale,
      tag: `pomodoro-phase-end-${Date.now()}` // Unique tag
    });
  } else {
    console.warn('[SW] self.registration.showNotification is not available.');
    return Promise.resolve();
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
  // console.log(`[SW] Tick: Time Remaining: ${timeRemaining}, Phase: ${phase}, Running: ${isRunning}`);

  if (timeRemaining < 0) timeRemaining = 0; // Ensure it doesn't go negative

  if (timeRemaining === 0) {
    handlePhaseEnd();
  }
  broadcastState("tick");
}

function handlePhaseEnd() {
  console.log(`[SW] Phase ${phase} ended. Cycles: ${cyclesCompleted}. IsRunning: ${isRunning}`);
  
  // Capture current running state and timerId before clearing
  const wasRunning = isRunning;
  const oldTimerId = timerId;

  if (oldTimerId) {
    clearInterval(oldTimerId);
    console.log(`[SW] Cleared timerId ${oldTimerId} in handlePhaseEnd.`);
  }
  timerId = null;
  isRunning = false; 

  let notificationTitleKey = 'pomodoroWorkSessionEnded'; // Default
  let notificationMessageKey = 'pomodoroTakeABreakOrStartNext'; // Default for work ending
  const previousPhase = phase;

  if (previousPhase === 'work') {
    cyclesCompleted++;
    notificationTitleKey = 'pomodoroWorkSessionEnded';
    // Message key 'pomodoroTakeABreakOrStartNext' will be specialized in showUINotification
    if (cyclesCompleted > 0 && cyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0) {
      phase = 'longBreak';
      timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
    } else {
      phase = 'shortBreak';
      timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
    }
  } else if (previousPhase === 'shortBreak' || previousPhase === 'longBreak') {
    phase = 'work';
    timeRemaining = POMODORO_WORK_DURATION_SECONDS;
    notificationTitleKey = previousPhase === 'shortBreak' ? 'pomodoroShortBreakEnded' : 'pomodoroLongBreakEnded';
    notificationMessageKey = 'pomodoroFocusOnTask';
  } else { // 'off' or unexpected
    phase = 'off';
    timeRemaining = POMODORO_WORK_DURATION_SECONDS;
    cyclesCompleted = 0;
    // No notification if ending from 'off' state (shouldn't happen if timer was running)
     broadcastState("phaseEnd_to_off_unexpected");
    return;
  }
  
  if (wasRunning) { // Only show notification if timer was actually running and completed a phase
    showUINotification(notificationTitleKey, notificationMessageKey, previousPhase)
      .then(() => {
          console.log('[SW] Notification shown successfully or promise resolved.');
      })
      .catch(err => {
          console.error('[SW] Error showing notification:', err);
      });
  }
  console.log(`[SW] New phase: ${phase}, New timeRemaining: ${timeRemaining}, Cycles: ${cyclesCompleted}`);
  broadcastState("phaseEnd");
}

function startTimer(newPhase, duration, actionSource) {
  console.log(`[SW] startTimer called. New Phase: ${newPhase}, Duration: ${duration}, Current Phase: ${phase}, IsRunning: ${isRunning}, Source: ${actionSource}`);
  if (timerId) {
    clearInterval(timerId);
    console.log('[SW] Cleared existing timerId in startTimer.');
  }
  phase = newPhase;
  timeRemaining = duration;
  isRunning = true;
  
  if (newPhase === 'work' && (actionSource === 'START_WORK' || actionSource === 'RESUME_TIMER_into_work')) {
    // Reset cycles if explicitly starting a 'work' session or resuming into one from a paused non-work state
    // Keep cycles if resuming a paused work session
    // This logic might need refinement based on precise resume behavior desired.
    // For now, a direct 'START_WORK' command resets cycles.
    if(actionSource === 'START_WORK') {
        cyclesCompleted = 0;
        console.log('[SW] Cycles reset to 0 due to START_WORK command.');
    }
  }
  
  // tick(); // First tick will happen after 1 second
  timerId = setInterval(tick, 1000);
  console.log(`[SW] New timerId set: ${timerId} for phase ${phase}`);
  broadcastState(`startTimer (${actionSource})`);
}

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

self.addEventListener('message', (event) => {
  if (!event.data) {
    console.log('[SW] Received message with no data.');
    return;
  }
  console.log('[SW] Message received from client:', event.data);

  if (event.data.locale) {
    currentLocale = event.data.locale;
    console.log(`[SW] Locale updated to: ${currentLocale}`);
  }

  if (event.data.type) {
    const source = event.source ? `Client ID: ${event.source.id}` : 'Unknown Client';
    console.log(`[SW] Processing command: ${event.data.type} from ${source}`);
    switch (event.data.type) {
      case 'START_WORK':
        startTimer('work', POMODORO_WORK_DURATION_SECONDS, 'START_WORK');
        break;
      case 'START_SHORT_BREAK':
        startTimer('shortBreak', POMODORO_SHORT_BREAK_DURATION_SECONDS, 'START_SHORT_BREAK');
        break;
      case 'START_LONG_BREAK':
        startTimer('longBreak', POMODORO_LONG_BREAK_DURATION_SECONDS, 'START_LONG_BREAK');
        break;
      case 'PAUSE_TIMER':
        if (isRunning) {
          clearInterval(timerId);
          timerId = null;
          isRunning = false;
          console.log('[SW] Timer paused.');
          broadcastState("PAUSE_TIMER");
        }
        break;
      case 'RESUME_TIMER':
        if (!isRunning && phase !== 'off' && timeRemaining > 0) {
          isRunning = true;
          if (timerId) clearInterval(timerId); 
          timerId = setInterval(tick, 1000);
          console.log('[SW] Timer resumed. New timerId:', timerId);
          broadcastState("RESUME_TIMER");
        } else if (phase === 'off' || timeRemaining <=0 ) {
            console.log('[SW] Cannot resume, phase is off or timeRemaining is zero. Resetting.');
            // Optionally reset or suggest starting a new session
             if (timerId) clearInterval(timerId);
            timerId = null;
            phase = 'off';
            timeRemaining = POMODORO_WORK_DURATION_SECONDS;
            isRunning = false;
            cyclesCompleted = 0;
            broadcastState("RESUME_TIMER_failed_reset");
        }
        break;
      case 'RESET_TIMER':
        if (timerId) clearInterval(timerId);
        timerId = null;
        phase = 'off';
        timeRemaining = POMODORO_WORK_DURATION_SECONDS;
        isRunning = false;
        cyclesCompleted = 0;
        console.log('[SW] Timer reset.');
        broadcastState("RESET_TIMER");
        break;
      case 'GET_INITIAL_STATE':
        console.log('[SW] GET_INITIAL_STATE request received. Broadcasting current state.');
        // Ensure the client that sent this specific message gets the state
        if (event.source) {
             event.source.postMessage({
                type: 'TIMER_STATE',
                payload: { phase, timeRemaining, isRunning, cyclesCompleted }
            });
        } else { // Fallback to broadcast if source is not available (shouldn't happen for page messages)
            broadcastState("GET_INITIAL_STATE_response");
        }
        break;
      default:
        console.log('[SW] Unknown message type received:', event.data.type);
    }
  }
});
