
// Service Worker for Pomodoro Timer
// Version: 1.0.3

const POMODORO_WORK_DURATION_SECONDS = 25 * 60; // 25 minutes
const POMODORO_SHORT_BREAK_DURATION_SECONDS = 5 * 60; // 5 minutes
const POMODORO_LONG_BREAK_DURATION_SECONDS = 15 * 60; // 15 minutes
const POMODORO_CYCLES_BEFORE_LONG_BREAK = 4;

// In-memory state for the timer
let phase = 'off'; // 'work', 'shortBreak', 'longBreak', 'off'
let timeRemaining = POMODORO_WORK_DURATION_SECONDS;
let isRunning = false;
let cyclesCompleted = 0;
let timerId = null;

// Basic translations for notifications (can be expanded)
const translations = {
  en: {
    workSessionEnded: "Work Session Ended!",
    takeShortBreak: "Time for a short break (5 min).",
    takeLongBreak: "Time for a long break (15 min).",
    shortBreakEnded: "Short Break Over!",
    longBreakEnded: "Long Break Over!",
    backToWork: "Time to get back to work!",
    pomodoro: "Pomodoro Timer"
  },
  es: {
    workSessionEnded: "¡Sesión de Trabajo Terminada!",
    takeShortBreak: "Tiempo para un breve descanso (5 min).",
    takeLongBreak: "Tiempo para un descanso largo (15 min).",
    shortBreakEnded: "¡Descanso Corto Terminado!",
    longBreakEnded: "¡Descanso Largo Terminado!",
    backToWork: "¡Hora de volver al trabajo!",
    pomodoro: "Temporizador Pomodoro"
  },
  fr: {
    workSessionEnded: "Session de travail terminée !",
    takeShortBreak: "C'est l'heure d'une courte pause (5 min).",
    takeLongBreak: "C'est l'heure d'une longue pause (15 min).",
    shortBreakEnded: "Courte pause terminée !",
    longBreakEnded: "Longue pause terminée !",
    backToWork: "C'est l'heure de retourner au travail !",
    pomodoro: "Minuteur Pomodoro"
  }
};
let currentLocale = 'en'; // Default locale

console.log('[SW] Service Worker script loading/re-evaluating. Initial state:', { phase, timeRemaining, isRunning, cyclesCompleted, timerId });

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

async function broadcastState() {
  try {
    // console.log('[SW] Broadcasting state:', { phase, timeRemaining, isRunning, cyclesCompleted });
    const clients = await self.clients.matchAll({
      includeUncontrolled: true, // Ensure we're reaching all relevant clients
      type: 'window',
    });
    // console.log('[SW] Found clients:', clients.length);
    clients.forEach((client) => {
      // console.log('[SW] Sending state to client:', client.id);
      client.postMessage({
        type: 'TIMER_STATE',
        payload: {
          phase,
          timeRemaining,
          isRunning,
          cyclesCompleted,
        },
      });
    });
  } catch (error) {
    console.error('[SW] Error in broadcastState:', error);
  }
}


function showPhaseEndNotification(phaseEnded) {
  console.log(`[SW] showPhaseEndNotification called for phase: ${phaseEnded}. Current locale: ${currentLocale}`);
  const effectiveLocale = translations[currentLocale] ? currentLocale : 'en';
  const localeTranslations = translations[effectiveLocale];
  
  let title = '';
  let body = '';

  if (phaseEnded === 'work') {
    title = localeTranslations.workSessionEnded;
    if ((cyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0) && cyclesCompleted > 0) {
      body = localeTranslations.takeLongBreak;
    } else {
      body = localeTranslations.takeShortBreak;
    }
  } else if (phaseEnded === 'shortBreak') {
    title = localeTranslations.shortBreakEnded;
    body = localeTranslations.backToWork;
  } else if (phaseEnded === 'longBreak') {
    title = localeTranslations.longBreakEnded;
    body = localeTranslations.backToWork;
  }

  if (title && self.registration) {
    console.log(`[SW] Showing notification: Title: "${title}", Body: "${body}"`);
    self.registration.showNotification(title, {
      body: body,
      icon: '/icons/icon-192x192.png', // Ensure this icon exists in public/icons
      badge: '/icons/icon-192x192.png', // For Android
      lang: effectiveLocale,
    }).catch(err => console.error('[SW] Error showing notification:', err));
  } else {
    console.log('[SW] Not showing notification. Title empty or self.registration not available.');
  }
}

function tick() {
  console.log('[SW] Tick. Time remaining:', timeRemaining, 'Is running:', isRunning, 'Phase:', phase, 'TimerId:', timerId);
  if (!isRunning) {
    console.log('[SW] Tick: Not running, clearing interval (if any) and returning.');
    if (timerId) clearInterval(timerId);
    timerId = null;
    return;
  }

  timeRemaining--;
  broadcastState();

  if (timeRemaining <= 0) {
    console.log('[SW] Tick: Time up for phase:', phase);
    const endedPhase = phase;
    isRunning = false;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      console.log('[SW] Tick: Interval cleared due to time up.');
    }
    
    showPhaseEndNotification(endedPhase);

    if (endedPhase === 'work') {
      // cyclesCompleted already incremented when 'work' phase started or resumed for a new cycle
      if ((cyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0) && cyclesCompleted > 0) {
        phase = 'longBreak';
        timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
      } else {
        phase = 'shortBreak';
        timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
      }
    } else { // shortBreak or longBreak ended
      phase = 'work';
      timeRemaining = POMODORO_WORK_DURATION_SECONDS;
      // cyclesCompleted is incremented when a new work session effectively starts
      // If auto-starting work, increment here. If manual, client will send START_WORK
      cyclesCompleted++; // Assuming auto-start for the next work cycle
      console.log(`[SW] New work cycle starting, cyclesCompleted incremented to: ${cyclesCompleted}`);
    }
    console.log('[SW] Tick: Phase changed to:', phase, 'New timeRemaining:', timeRemaining);
    // Optionally auto-start the next phase's timer
    // For now, we'll let the client decide or require manual start for the next phase.
    // If you want auto-start: startTimer();
    broadcastState(); // Broadcast the new phase and 0 time (or new time if auto-starting)
  }
}

function startTimer() {
  console.log(`[SW] startTimer called. Current phase: ${phase}, timeRemaining: ${timeRemaining}, isRunning: ${isRunning}, timerId: ${timerId}`);
  if (timerId) {
    console.log('[SW] startTimer: Timer already exists (timerId), clearing it first.');
    clearInterval(timerId);
    timerId = null;
  }
  
  isRunning = true; // Set isRunning true *before* starting the interval
  
  if (timeRemaining > 0) {
    console.log('[SW] startTimer: Setting new interval. Initial timeRemaining:', timeRemaining, 'Phase:', phase);
    // No immediate tick() call here; first tick will occur after 1 second.
    timerId = setInterval(tick, 1000);
    console.log(`[SW] Interval set with new timerId: ${timerId}`);
  } else {
    console.log('[SW] startTimer: timeRemaining is 0 or less, not starting interval. Handling phase end.');
    isRunning = false; 
    // This state should be handled by the phase transition logic in tick() or when setting up a new phase
  }
  broadcastState(); // Broadcast the new state (running or not)
}


self.addEventListener('message', (event) => {
  if (event.data.locale) {
    console.log(`[SW] Locale received from client: ${event.data.locale}`);
    currentLocale = event.data.locale;
  }

  console.log('[SW] Message received from client:', event.data);

  switch (event.data.type) {
    case 'START_WORK':
      console.log('[SW] START_WORK command received.');
      if (phase !== 'work' || !isRunning) { // Start new work session or if paused in work
        cyclesCompleted = (phase === 'off' || phase === 'shortBreak' || phase === 'longBreak') ? (cyclesCompleted + 1) : cyclesCompleted; // Increment if starting a fresh work session
        if (phase === 'off') cyclesCompleted = 1; // First work session
        console.log(`[SW] Starting work session. Cycles completed will be: ${cyclesCompleted}`);
      }
      phase = 'work';
      timeRemaining = POMODORO_WORK_DURATION_SECONDS;
      console.log(`[SW] Phase set to 'work', timeRemaining set to ${timeRemaining}. Current cyclesCompleted: ${cyclesCompleted}`);
      startTimer();
      break;
    case 'START_SHORT_BREAK':
      console.log('[SW] START_SHORT_BREAK command received.');
      phase = 'shortBreak';
      timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
      console.log(`[SW] Phase set to 'shortBreak', timeRemaining set to ${timeRemaining}`);
      startTimer();
      break;
    case 'START_LONG_BREAK':
      console.log('[SW] START_LONG_BREAK command received.');
      phase = 'longBreak';
      timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
      console.log(`[SW] Phase set to 'longBreak', timeRemaining set to ${timeRemaining}`);
      startTimer();
      break;
    case 'PAUSE_TIMER':
      console.log('[SW] PAUSE_TIMER command received. Current timerId:', timerId);
      if (isRunning) {
        isRunning = false;
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
          console.log('[SW] Timer paused and interval cleared.');
        } else {
          console.log('[SW] PAUSE_TIMER: isRunning was true, but no timerId found.');
        }
        broadcastState();
      } else {
        console.log('[SW] PAUSE_TIMER: Already paused.');
      }
      break;
    case 'RESUME_TIMER':
      console.log('[SW] RESUME_TIMER command received.');
      if (!isRunning && phase !== 'off' && timeRemaining > 0) {
        console.log('[SW] Resuming timer. Phase:', phase, 'Time remaining:', timeRemaining);
        // If resuming a work phase that was paused, and cyclesCompleted was based on starting a new work phase,
        // we might need to ensure it's correctly set. For now, resuming doesn't change cyclesCompleted.
        startTimer(); // This will set isRunning = true
      } else {
        console.log('[SW] RESUME_TIMER: Cannot resume. IsRunning:', isRunning, 'Phase:', phase, 'TimeRemaining:', timeRemaining);
      }
      break;
    case 'RESET_TIMER':
      console.log('[SW] RESET_TIMER command received. Current timerId:', timerId);
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
        console.log('[SW] Interval cleared by RESET_TIMER.');
      }
      phase = 'off';
      timeRemaining = POMODORO_WORK_DURATION_SECONDS;
      isRunning = false;
      cyclesCompleted = 0;
      console.log('[SW] Timer reset. New state:', { phase, timeRemaining, isRunning, cyclesCompleted });
      broadcastState();
      break;
    case 'GET_INITIAL_STATE':
      console.log('[SW] GET_INITIAL_STATE command received. Broadcasting current state.');
      // This ensures a newly connected client gets the current state
      broadcastState();
      break;
    default:
      console.log('[SW] Unknown message type received:', event.data.type);
  }
});

console.log('[SW] Event listeners set up.');
