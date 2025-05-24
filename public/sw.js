
// Service Worker for Pomodoro Timer (public/sw.js)
const POMODORO_WORK_DURATION_SECONDS = 25 * 60;
const POMODORO_SHORT_BREAK_DURATION_SECONDS = 5 * 60;
const POMODORO_LONG_BREAK_DURATION_SECONDS = 15 * 60;
const POMODORO_CYCLES_BEFORE_LONG_BREAK = 4;

let timerId = null;
let phase = 'off'; // 'work', 'shortBreak', 'longBreak', 'off'
let timeRemaining = POMODORO_WORK_DURATION_SECONDS;
let isRunning = false;
let cyclesCompleted = 0;

const translations = {
  en: {
    pomodoroWorkSessionEnded: "Work Session Ended",
    pomodoroShortBreakEnded: "Short Break Ended",
    pomodoroLongBreakEnded: "Long Break Ended",
    pomodoroTakeABreakOrStartNext: "Time for a break!",
    pomodoroFocusOnTask: "Time to focus on your task!",
  },
  es: {
    pomodoroWorkSessionEnded: "Sesión de Trabajo Terminada",
    pomodoroShortBreakEnded: "Descanso Corto Terminado",
    pomodoroLongBreakEnded: "Descanso Largo Terminado",
    pomodoroTakeABreakOrStartNext: "¡Tiempo de un descanso!",
    pomodoroFocusOnTask: "¡Concéntrate en tu tarea!",
  },
  fr: {
    pomodoroWorkSessionEnded: "Session de travail terminée",
    pomodoroShortBreakEnded: "Pause courte terminée",
    pomodoroLongBreakEnded: "Longue pause terminée",
    pomodoroTakeABreakOrStartNext: "C'est l'heure d'une pause !",
    pomodoroFocusOnTask: "Concentrez-vous sur votre tâche !",
  }
};
let currentLocale = 'en'; // Default locale

function getTranslation(key, lang = currentLocale) {
  return translations[lang]?.[key] || translations.en[key];
}

function showNotification(title, body) {
  if (Notification.permission === 'granted') {
    self.registration.showNotification(title, {
      body: body,
      icon: '/icons/icon-192x192.png', // Ensure this icon exists
      lang: currentLocale,
    });
  }
}

function tick() {
  if (!isRunning) return;

  timeRemaining--;
  if (timeRemaining < 0) {
    // Phase ended
    isRunning = false;
    clearInterval(timerId);
    timerId = null;

    let notificationTitle = "";
    let notificationBody = "";

    if (phase === 'work') {
      cyclesCompleted++;
      notificationTitle = getTranslation("pomodoroWorkSessionEnded");
      notificationBody = getTranslation("pomodoroTakeABreakOrStartNext");
      if (cyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0 && cyclesCompleted > 0) {
        phase = 'longBreak';
        timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
      } else {
        phase = 'shortBreak';
        timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
      }
    } else if (phase === 'shortBreak' || phase === 'longBreak') {
      notificationTitle = phase === 'shortBreak' ? getTranslation("pomodoroShortBreakEnded") : getTranslation("pomodoroLongBreakEnded");
      notificationBody = getTranslation("pomodoroFocusOnTask");
      phase = 'work';
      timeRemaining = POMODORO_WORK_DURATION_SECONDS;
    }
    showNotification(notificationTitle, notificationBody);
  }
  broadcastState();
}

function startTimer() {
  if (timerId) clearInterval(timerId);
  isRunning = true;
  timerId = setInterval(tick, 1000);
  broadcastState();
}

function pauseTimer() {
  isRunning = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  broadcastState();
}

function resetTimer() {
  isRunning = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  phase = 'off';
  timeRemaining = POMODORO_WORK_DURATION_SECONDS;
  cyclesCompleted = 0;
  broadcastState();
}

function broadcastState() {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
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
  });
}

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting(); // Activate new SW immediately
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(self.clients.claim()); // Take control of all open clients
  broadcastState(); // Send initial state to clients
});

self.addEventListener('message', (event) => {
  if (!event.data || !event.data.type) return;

  console.log('Service Worker: Message received from client:', event.data);
  
  if (event.data.locale) {
    currentLocale = event.data.locale;
  }

  switch (event.data.type) {
    case 'START_WORK':
      if (phase !== 'work' || !isRunning) { // Reset cycles if not continuing a work session
        cyclesCompleted = 0;
      }
      phase = 'work';
      timeRemaining = POMODORO_WORK_DURATION_SECONDS;
      startTimer();
      break;
    case 'START_SHORT_BREAK':
      phase = 'shortBreak';
      timeRemaining = POMODORO_SHORT_BREAK_DURATION_SECONDS;
      startTimer();
      break;
    case 'START_LONG_BREAK':
      phase = 'longBreak';
      timeRemaining = POMODORO_LONG_BREAK_DURATION_SECONDS;
      startTimer();
      break;
    case 'PAUSE_TIMER':
      pauseTimer();
      break;
    case 'RESUME_TIMER':
      if (phase !== 'off' && timeRemaining > 0) {
        startTimer();
      }
      break;
    case 'RESET_TIMER':
      resetTimer();
      break;
    case 'GET_INITIAL_STATE': // Client can request initial state
      broadcastState();
      break;
  }
});
