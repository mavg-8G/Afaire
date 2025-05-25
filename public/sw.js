
// Service Worker for TodoFlow Pomodoro Timer
// Version: 1.3

console.log('[SW] Service Worker script evaluating/re-evaluating. Timestamp:', Date.now());

const POMODORO_WORK_DURATION_SECONDS = 25 * 60;
const POMODORO_SHORT_BREAK_DURATION_SECONDS = 5 * 60;
const POMODORO_LONG_BREAK_DURATION_SECONDS = 15 * 60;
const POMODORO_CYCLES_BEFORE_LONG_BREAK = 4;

let phase = 'off'; // 'work', 'shortBreak', 'longBreak', 'off'
let timeRemaining = POMODORO_WORK_DURATION_SECONDS;
let isRunning = false;
let timerId = null;
let cyclesCompleted = 0;
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
  },
};

function getTranslation(locale, key) {
  return translations[locale]?.[key] || translations['en'][key] || key;
}

function showUINotification(title, options) {
    console.log(`[SW] Attempting to show system notification. Title: "${title}", Options:`, options);
    if (self.registration && typeof self.registration.showNotification === 'function') {
        const notificationPromise = self.registration.showNotification(title, options);
        
        // Ensure notificationPromise is actually a promise before chaining
        if (notificationPromise && typeof notificationPromise.then === 'function') {
            return notificationPromise
                .then(() => {
                    console.log(`[SW] System notification shown successfully: "${title}"`);
                })
                .catch((err) => {
                    console.error('[SW] Error showing system notification:', err);
                    // Potentially broadcast this error back to the client if needed
                });
        } else {
            console.warn('[SW] self.registration.showNotification did not return a promise or was undefined.');
            return Promise.resolve(); // Still return a promise to maintain chainability if expected
        }
    } else {
        console.warn('[SW] self.registration.showNotification is not available.');
        return Promise.resolve(); // Return a resolved promise if not available
    }
}


function tick() {
    timeRemaining--;
    // console.log(`[SW] Tick. Phase: ${phase}, Time Remaining: ${timeRemaining}, IsRunning: ${isRunning}`);
    if (timeRemaining <= 0) {
        isRunning = false;
        clearInterval(timerId);
        timerId = null;
        
        let phaseEndedKey, nextPhaseMessageKey;

        if (phase === 'work') {
            cyclesCompleted++;
            phaseEndedKey = 'pomodoroWorkSessionEnded';
            if (cyclesCompleted > 0 && cyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0) {
                phase = 'longBreak';
                timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
                nextPhaseMessageKey = 'pomodoroTakeALongBreak';
            } else {
                phase = 'shortBreak';
                timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
                nextPhaseMessageKey = 'pomodoroTakeAShortBreak';
            }
        } else if (phase === 'shortBreak' || phase === 'longBreak') {
            phaseEndedKey = phase === 'shortBreak' ? 'pomodoroShortBreakEnded' : 'pomodoroLongBreakEnded';
            phase = 'work';
            timeRemaining = POMODORO_WORK_DURATION_SECONDS;
            nextPhaseMessageKey = 'pomodoroBackToWork';
        }
        
        if (phaseEndedKey && nextPhaseMessageKey) {
            const notificationTitle = getTranslation(currentLocale, phaseEndedKey);
            const notificationBody = getTranslation(currentLocale, nextPhaseMessageKey);
            showUINotification(notificationTitle, {
                body: notificationBody,
                icon: '/icons/icon-192x192.png',
                lang: currentLocale,
                tag: 'pomodoro-phase-end' // Use a tag to replace previous notifications of this type
            });
        }
        // Automatically start the next phase's timer if it's not 'off'
        // For now, we let the user manually start the next phase from the UI.
        // If auto-start is desired:
        // if (phase !== 'off') {
        //   isRunning = true;
        //   startTimer();
        // }
    }
    broadcastState(true, phase); // Send phaseJustChanged as true
}

function startTimer() {
    console.log(`[SW] startTimer called. Phase: ${phase}, isRunning: ${isRunning}`);
    if (!isRunning) return; // Should not happen if called correctly
    if (timerId) {
        console.warn("[SW] Timer already running. Clearing existing timerId before starting new one.");
        clearInterval(timerId);
    }
    // tick(); // Removed: First tick will happen after 1 second via interval
    timerId = setInterval(tick, 1000);
    console.log(`[SW] Timer started with ID: ${timerId}. Time Remaining: ${timeRemaining}`);
}

function pauseTimer() {
    console.log('[SW] pauseTimer called.');
    isRunning = false;
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
        console.log('[SW] Timer paused and cleared.');
    } else {
        console.log('[SW] Pause called but no active timerId found.');
    }
}

function resetTimer() {
    console.log('[SW] resetTimer called.');
    pauseTimer();
    phase = 'off';
    timeRemaining = POMODORO_WORK_DURATION_SECONDS;
    cyclesCompleted = 0;
    console.log('[SW] Timer reset. Phase: off, Time Remaining:', timeRemaining);
}

async function broadcastState(phaseJustChanged = false, previousPhase = undefined) {
    // console.log('[SW] Broadcasting state to clients:', { phase, timeRemaining, isRunning, cyclesCompleted, phaseJustChanged, previousPhase });
    try {
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.forEach(client => {
            // console.log(`[SW] Posting state to client: ${client.id}`);
            client.postMessage({
                type: 'TIMER_STATE',
                payload: { phase, timeRemaining, isRunning, cyclesCompleted, phaseJustChanged, previousPhase }
            });
        });
    } catch (error) {
        console.error('[SW] Error broadcasting state:', error);
    }
}

async function broadcastError(errorMessage) {
    console.error('[SW] Broadcasting error to clients:', errorMessage);
    try {
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.forEach(client => {
            client.postMessage({ type: 'SW_ERROR', payload: { message: errorMessage } });
        });
    } catch (error) {
        console.error('[SW] Error broadcasting error message:', error);
    }
}


self.addEventListener('install', (event) => {
    console.log('[SW] Install event. Timestamp:', Date.now());
    event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event. Current phase on activation:', phase, 'Timestamp:', Date.now());
    event.waitUntil(
        self.clients.claim().then(() => {
            console.log('[SW] Clients claimed. Broadcasting initial state.');
            return broadcastState();
        }).catch(err => {
            console.error('[SW] Error during clients.claim() or initial broadcastState in activate:', err);
        })
    );
});

self.addEventListener('message', async (event) => {
    console.log('[SW] Received message from client:', event.data);
    if (!event.data || !event.data.type) {
        console.warn('[SW] Received message without type:', event.data);
        return;
    }

    if (event.data.payload && event.data.payload.locale) {
        currentLocale = event.data.payload.locale;
        // console.log(`[SW] Locale updated to: ${currentLocale}`);
    }

    try {
        switch (event.data.type) {
            case 'START_WORK':
                console.log('[SW] START_WORK command received.');
                pauseTimer(); // Clear any existing timer
                phase = 'work';
                timeRemaining = POMODORO_WORK_DURATION_SECONDS;
                isRunning = true;
                cyclesCompleted = 0; // Reset cycles when explicitly starting work
                startTimer();
                break;
            case 'START_SHORT_BREAK':
                console.log('[SW] START_SHORT_BREAK command received.');
                pauseTimer();
                phase = 'shortBreak';
                timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
                isRunning = true;
                startTimer();
                break;
            case 'START_LONG_BREAK':
                console.log('[SW] START_LONG_BREAK command received.');
                pauseTimer();
                phase = 'longBreak';
                timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
                isRunning = true;
                startTimer();
                break;
            case 'PAUSE_TIMER':
                console.log('[SW] PAUSE_TIMER command received.');
                pauseTimer();
                break;
            case 'RESUME_TIMER':
                console.log('[SW] RESUME_TIMER command received.');
                if (phase !== 'off' && timeRemaining > 0) {
                    isRunning = true;
                    startTimer();
                } else {
                    console.log('[SW] Resume called but phase is off or time is up. Not starting timer.');
                }
                break;
            case 'RESET_TIMER':
                console.log('[SW] RESET_TIMER command received.');
                resetTimer();
                break;
            case 'GET_INITIAL_STATE':
                console.log('[SW] GET_INITIAL_STATE command received from client:', event.source ? event.source.id : 'Unknown client');
                if (event.source && event.source.postMessage) {
                    try {
                        console.log('[SW] Posting state directly to requesting client:', event.source.id);
                        event.source.postMessage({ type: 'TIMER_STATE', payload: { phase, timeRemaining, isRunning, cyclesCompleted } });
                    } catch (e) {
                        console.error('[SW] Error posting state directly to client:', e);
                        // Fallback to broadcast if direct post fails
                        await broadcastState();
                    }
                } else {
                    console.log('[SW] No event.source or postMessage, broadcasting state to all clients.');
                    await broadcastState();
                }
                return; // Return early as we don't want to broadcast again immediately
            default:
                console.warn('[SW] Unknown message type received:', event.data.type);
        }
        await broadcastState(); // Broadcast state after processing command
    } catch (error) {
        console.error('[SW] Error processing client message:', event.data, error);
        // Try to inform the client about the error
        if (event.source && event.source.postMessage) {
             try {
                event.source.postMessage({ type: 'SW_ERROR', payload: { message: error.message || 'Unknown error processing message' } });
            } catch (e) {
                console.error('[SW] Error sending SW_ERROR to client:', e);
                await broadcastError(error.message || 'Unknown error processing message and no source client for error report');
            }
        } else {
             await broadcastError(error.message || 'Unknown error processing message and no source client for error report');
        }
    }
});
