
// Service Worker for Pomodoro Timer
// Version: 2.0

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

// Minimalistic i18n for SW notifications
const translationsSw = {
  en: {
    pomodoroWorkSessionEnded: "Work Session Ended!",
    pomodoroShortBreakEnded: "Short Break Over!",
    pomodoroLongBreakEnded: "Long Break Over!",
    pomodoroTakeABreakOrStartNext: "Time for a break or start the next session!",
    pomodoroFocusOnTask: "Back to work! Focus on your task.",
  },
  es: {
    pomodoroWorkSessionEnded: "¡Sesión de Trabajo Terminada!",
    pomodoroShortBreakEnded: "¡Descanso Corto Terminado!",
    pomodoroLongBreakEnded: "¡Descanso Largo Terminado!",
    pomodoroTakeABreakOrStartNext: "¡Tiempo de un descanso o de iniciar la siguiente sesión!",
    pomodoroFocusOnTask: "¡De vuelta al trabajo! Concéntrate en tu tarea.",
  },
  fr: {
    pomodoroWorkSessionEnded: "Session de travail terminée !",
    pomodoroShortBreakEnded: "Petite pause terminée !",
    pomodoroLongBreakEnded: "Longue pause terminée !",
    pomodoroTakeABreakOrStartNext: "C'est l'heure d'une pause ou de commencer la prochaine session !",
    pomodoroFocusOnTask: "Au travail ! Concentrez-vous sur votre tâche.",
  }
};

function log(message) {
    console.log(`[SW Pomodoro ${new Date().toISOString()}] ${message}`);
}

const tSw = (key, lang = 'en') => {
  const langSet = translationsSw[lang] || translationsSw['en'];
  return langSet[key] || key;
};

function broadcastState(justChanged = false, previousPhaseForBroadcast = null) {
    log(`Broadcasting state: Phase=${phase}, TimeLeft=${timeRemaining}, Running=${isRunning}, Cycles=${cyclesCompleted}, JustChanged=${justChanged}, PrevPhase=${previousPhaseForBroadcast}`);
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'TIMER_STATE',
                payload: {
                    phase,
                    timeRemaining,
                    isRunning,
                    cyclesCompleted,
                    phaseJustChanged: justChanged,
                    previousPhaseSw: previousPhaseForBroadcast
                }
            });
        });
    }).catch(err => log(`Error broadcasting state: ${err}`));
}


function showPhaseEndNotification(endedPhase, currentPhaseForNextAction) {
    let titleKey, bodyKey;

    if (endedPhase === 'work') {
        titleKey = 'pomodoroWorkSessionEnded';
        bodyKey = 'pomodoroTakeABreakOrStartNext'; // Suggests next action
    } else if (endedPhase === 'shortBreak') {
        titleKey = 'pomodoroShortBreakEnded';
        bodyKey = 'pomodoroFocusOnTask';
    } else if (endedPhase === 'longBreak') {
        titleKey = 'pomodoroLongBreakEnded';
        bodyKey = 'pomodoroFocusOnTask';
    } else {
        return; // No notification for 'off' or unknown phases ending
    }

    const title = tSw(titleKey, currentLocale);
    const body = tSw(bodyKey, currentLocale);
    
    log(`Showing system notification: Title='${title}', Body='${body}'`);
    self.registration.showNotification(title, {
        body: body,
        icon: '/icons/icon-192x192.png', // Ensure this icon exists in /public/icons/
        lang: currentLocale,
    }).catch(err => log(`Error showing notification: ${err}`));
}


function tick() {
    if (!isRunning) {
        if (timerId) {
            clearInterval(timerId);
            log(`tick(): Timer ID ${timerId} cleared because !isRunning.`);
            timerId = null;
        }
        return;
    }

    // If code reaches here, isRunning is true.
    timeRemaining--;
    // log(`tick(): timeRemaining decremented to ${timeRemaining}`);

    if (timeRemaining < 0) { // Timer has completed its full duration for the current phase
        if (timerId) {
            clearInterval(timerId);
            log(`tick(): Timer ID ${timerId} cleared because timeRemaining < 0.`);
            timerId = null;
        }
        // isRunning will be set to false inside the transition or if next phase is 'off'
        // isRunning = false; // Mark as not running before setting up next phase

        let previousPhaseSw = phase;
        let justChanged = true;

        log(`tick(): Phase ${previousPhaseSw} ended. Current cycles: ${cyclesCompleted}.`);

        if (previousPhaseSw === 'work') {
            cyclesCompleted++;
            if (cyclesCompleted > 0 && cyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0) {
                phase = 'longBreak';
                timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
                log(`Transitioning to longBreak. New timeRemaining: ${timeRemaining}. Cycles: ${cyclesCompleted}`);
            } else {
                phase = 'shortBreak';
                timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
                log(`Transitioning to shortBreak. New timeRemaining: ${timeRemaining}. Cycles: ${cyclesCompleted}`);
            }
        } else if (previousPhaseSw === 'shortBreak' || previousPhaseSw === 'longBreak') {
            phase = 'work';
            timeRemaining = POMODORO_WORK_DURATION_SECONDS;
            log(`Transitioning to work. New timeRemaining: ${timeRemaining}.`);
        } else { 
            phase = 'off';
            timeRemaining = POMODORO_WORK_DURATION_SECONDS; 
            justChanged = false;
            log(`Transitioning to off (unexpected previous phase: ${previousPhaseSw}). New timeRemaining: ${timeRemaining}.`);
        }
        
        isRunning = (phase !== 'off'); // Keep running if next phase is not 'off'
                                        // This implies auto-start of next phase.
                                        // If we don't want auto-start, isRunning should be false here.
                                        // For now, let's assume we want it to pause, requiring user to start next.
        isRunning = false; // Explicitly pause after phase completion. User must resume/start next.
        log(`tick(): Phase transition complete. New phase: ${phase}. isRunning set to: ${isRunning}.`);


        showPhaseEndNotification(previousPhaseSw, phase);
        broadcastState(justChanged, previousPhaseSw);
        
        // If isRunning is now true (because next phase auto-started), start new interval.
        // This part is tricky if we set isRunning = false above.
        // If we want auto-start:
        // if (isRunning && phase !== 'off') {
        //    if (timerId) clearInterval(timerId); // Clear any old one just in case
        //    timerId = setInterval(tick, 1000);
        //    log(`tick(): New timer ${timerId} started for auto-transitioned phase ${phase}.`);
        // }


    } else {
        // Timer is still ticking for the current phase
        broadcastState(false, null);
    }
}


function startWork() {
    log(`startWork(): Current phase: ${phase}, isRunning: ${isRunning}. Starting work session.`);
    phase = 'work';
    timeRemaining = POMODORO_WORK_DURATION_SECONDS;
    isRunning = true;
    if (timerId) {
        clearInterval(timerId);
        log(`startWork(): Cleared existing timer ID ${timerId}.`);
    }
    timerId = setInterval(tick, 1000);
    log(`startWork(): New timer ID ${timerId} started. Duration: ${timeRemaining}s.`);
    broadcastState(true, phase === 'off' ? null : phase); // Indicate phase changed
}

function startShortBreak() {
    log(`startShortBreak(): Current phase: ${phase}, isRunning: ${isRunning}. Starting short break.`);
    phase = 'shortBreak';
    timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
    isRunning = true;
    if (timerId) {
        clearInterval(timerId);
        log(`startShortBreak(): Cleared existing timer ID ${timerId}.`);
    }
    timerId = setInterval(tick, 1000);
    log(`startShortBreak(): New timer ID ${timerId} started. Duration: ${timeRemaining}s.`);
    broadcastState(true, phase === 'off' ? null : phase);
}

function startLongBreak() {
    log(`startLongBreak(): Current phase: ${phase}, isRunning: ${isRunning}. Starting long break.`);
    phase = 'longBreak';
    timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
    isRunning = true;
    if (timerId) {
        clearInterval(timerId);
        log(`startLongBreak(): Cleared existing timer ID ${timerId}.`);
    }
    timerId = setInterval(tick, 1000);
    log(`startLongBreak(): New timer ID ${timerId} started. Duration: ${timeRemaining}s.`);
    broadcastState(true, phase === 'off' ? null : phase);
}

function pauseTimer() {
    log(`pauseTimer(): Attempting to pause. Current phase: ${phase}, isRunning: ${isRunning}, timeRemaining: ${timeRemaining}.`);
    if (isRunning) {
        isRunning = false;
        if (timerId) {
            clearInterval(timerId);
            log(`pauseTimer(): Timer ID ${timerId} cleared.`);
            timerId = null;
        }
        broadcastState(); // Broadcast the paused state
        log(`pauseTimer(): Timer paused. isRunning: ${isRunning}.`);
    } else {
        log('pauseTimer(): Timer was not running or already paused.');
    }
}

function resumeTimer() {
    log(`resumeTimer(): Attempting to resume. Current phase: ${phase}, isRunning: ${isRunning}, timeRemaining: ${timeRemaining}.`);
    if (!isRunning && phase !== 'off' && timeRemaining > 0) {
        isRunning = true;
        if (timerId) { // Should be null if properly paused
            clearInterval(timerId);
            log(`resumeTimer(): Cleared existing timer ID ${timerId} (unexpected).`);
        }
        timerId = setInterval(tick, 1000);
        log(`resumeTimer(): New timer ID ${timerId} started for resuming phase ${phase}.`);
        broadcastState(); // Broadcast the resumed state
        log(`resumeTimer(): Timer resumed. isRunning: ${isRunning}.`);
    } else {
        log(`resumeTimer(): Cannot resume. isRunning: ${isRunning}, phase: ${phase}, timeRemaining: ${timeRemaining}.`);
        // If trying to resume 'off' phase or time is 0, effectively start work
        if (phase === 'off' || timeRemaining <= 0) {
            log('resumeTimer(): Phase was off or time ran out, defaulting to startWork.');
            cyclesCompleted = 0; // Reset cycles if "resuming" from off/completed state
            startWork();
        }
    }
}

function resetTimer() {
    log(`resetTimer(): Attempting to reset. Current phase: ${phase}, isRunning: ${isRunning}.`);
    if (timerId) {
        clearInterval(timerId);
        log(`resetTimer(): Timer ID ${timerId} cleared.`);
        timerId = null;
    }
    isRunning = false;
    phase = 'off';
    timeRemaining = POMODORO_WORK_DURATION_SECONDS;
    cyclesCompleted = 0;
    broadcastState(true, null); // Indicate phase changed to 'off'
    log('resetTimer(): Timer reset.');
}


self.addEventListener('install', (event) => {
    log('Service Worker installing.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    log('Service Worker activating.');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.locale) {
        if (currentLocale !== event.data.locale) {
            currentLocale = event.data.locale;
            log(`Locale updated to: ${currentLocale}`);
        }
    }

    const command = event.data.type;
    if (!command) return;

    log(`Command received: ${command}`);

    switch (command) {
        case 'START_WORK':
            // If starting work manually, and it's not a continuation, reset cycles.
            if (phase !== 'work' || !isRunning) { // if it was paused work, don't reset cycles
                cyclesCompleted = 0;
                log('Cycles reset because starting work from non-work/paused state.');
            }
            startWork();
            break;
        case 'START_SHORT_BREAK':
            startShortBreak();
            break;
        case 'START_LONG_BREAK':
            startLongBreak();
            break;
        case 'PAUSE_TIMER':
            pauseTimer();
            break;
        case 'RESUME_TIMER':
            resumeTimer();
            break;
        case 'RESET_TIMER':
            resetTimer();
            break;
        case 'GET_INITIAL_STATE':
            log('GET_INITIAL_STATE command received. Broadcasting current state.');
            // Send the current state to the client that requested it
            // Ensure phaseJustChanged is false for initial state sync
            if (event.source && event.source.postMessage) {
                 event.source.postMessage({
                    type: 'TIMER_STATE',
                    payload: { phase, timeRemaining, isRunning, cyclesCompleted, phaseJustChanged: false, previousPhaseSw: null }
                });
            } else { // Fallback to broadcast if source is not directly available
                broadcastState(false, null);
            }
            break;
        default:
            log(`Unknown command: ${command}`);
    }
});

log('Service Worker script loaded and parsed. Initial state: Phase=' + phase + ', TimeLeft=' + timeRemaining + ', Running=' + isRunning);

// Initial broadcast in case a client is already there and SW just (re)started
// but this might be too early if clients aren't listening yet.
// Better to rely on GET_INITIAL_STATE from client.
// broadcastState();

    