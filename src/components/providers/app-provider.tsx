
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  Activity, Todo, Category, AppMode, RecurrenceRule, UINotification, HistoryLogEntry, HistoryLogActionKey, Translations, Assignee, PomodoroPhase,
  BackendCategoryCreatePayload, BackendCategory, BackendUser, BackendUserCreatePayload, BackendUserUpdatePayload, BackendActivityCreatePayload, BackendActivityUpdatePayload, BackendActivity, BackendTodoCreate, BackendHistory, RecurrenceType, BackendCategoryMode, BackendRepeatMode, BackendTodo
} from '@/lib/types';
import { HARDCODED_APP_PIN } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import {
  isSameDay, formatISO, parseISO,
  addDays, addWeeks, addMonths,
  subDays, subWeeks,
  startOfDay as dateFnsStartOfDay, endOfDay as dateFnsEndOfDay,
  isBefore, isAfter,
  getDay, getDate,
  isWithinInterval,
  setDate as setDayOfMonthFn,
  addYears, isEqual,
  formatDistanceToNowStrict,
  format as formatDateFns, // Renamed to avoid conflict
} from 'date-fns';
import * as Icons from 'lucide-react';
import { useTranslations } from '@/contexts/language-context';
import { enUS, es, fr } from 'date-fns/locale';
import { useTheme } from 'next-themes';

const API_BASE_URL = 'http://62.171.187.41:10242';


export interface AppContextType {
  activities: Activity[];
  getRawActivities: () => Activity[];
  categories: Category[];
  assignees: Assignee[];
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  addActivity: (
    activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'completedAt' | 'notes' | 'recurrence' | 'completedOccurrences' | 'responsiblePersonIds' | 'categoryId' | 'appMode' | 'masterActivityId' | 'isRecurringInstance' | 'originalInstanceDate'> & {
      todos?: Omit<Todo, 'id' | 'completed'>[]; // Todo IDs will be numbers from backend
      time?: string;
      notes?: string;
      recurrence?: RecurrenceRule | null;
      responsiblePersonIds?: number[];
      categoryId: number;
      appMode: AppMode;
    },
    customCreatedAt?: number
  ) => Promise<void>;
  updateActivity: (activityId: number, updates: Partial<Omit<Activity, 'id'>>, originalActivity?: Activity) => Promise<void>;
  deleteActivity: (activityId: number) => Promise<void>;
  toggleOccurrenceCompletion: (masterActivityId: number, occurrenceDateTimestamp: number, completed: boolean) => void;
  addTodoToActivity: (activityId: number, todoText: string) => void; // ActivityId is number
  updateTodoInActivity: (activityId: number, todoId: number, updates: Partial<Todo>) => void; // IDs are numbers
  deleteTodoFromActivity: (activityId: number, todoId: number, masterActivityId?: number) => void; // IDs are numbers
  getCategoryById: (categoryId: number) => Category | undefined;
  addCategory: (name: string, iconName: string, mode: AppMode | 'all') => Promise<void>;
  updateCategory: (categoryId: number, updates: Partial<Omit<Category, 'id' | 'icon'>>, oldCategoryData?: Category) => Promise<void>;
  deleteCategory: (categoryId: number) => Promise<void>;
  addAssignee: (name: string, username?: string, password?: string) => Promise<void>; // Now async, takes more params
  updateAssignee: (assigneeId: number, updates: Partial<Omit<Assignee, 'id' | 'username'>>) => Promise<void>; // username excluded from direct update here
  deleteAssignee: (assigneeId: number) => Promise<void>; // Now async
  getAssigneeById: (assigneeId: number) => Assignee | undefined; // ID is number
  isLoading: boolean;
  error: string | null;

  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean, rememberMe?: boolean) => void;
  loginAttempts: number;
  setLoginAttempts: (attempts: number) => void;
  lockoutEndTime: number | null;
  setLockoutEndTime: (timestamp: number | null) => void;
  sessionExpiryTimestamp: number | null;
  logout: () => void;
  logPasswordChange: () => void;

  uiNotifications: UINotification[];
  addUINotification: (data: Omit<UINotification, 'id' | 'timestamp' | 'read'>) => void;
  markUINotificationAsRead: (notificationId: string) => void;
  markAllUINotificationsAsRead: () => void;
  clearAllUINotifications: () => void;

  historyLog: HistoryLogEntry[];
  addHistoryLogEntry: (actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined>, scope?: HistoryLogEntry['scope']) => void;

  systemNotificationPermission: NotificationPermission | null;
  requestSystemNotificationPermission: () => Promise<void>;

  pomodoroPhase: PomodoroPhase;
  pomodoroTimeRemaining: number;
  pomodoroIsRunning: boolean;
  pomodoroCyclesCompleted: number;
  startPomodoroWork: () => void;
  startPomodoroShortBreak: () => void;
  startPomodoroLongBreak: () => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  resetPomodoro: () => void;
  isPomodoroReady: boolean;

  isAppLocked: boolean;
  appPinState: string | null;
  unlockApp: (pinAttempt: string) => boolean;
  setAppPin: (pin: string | null) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES = 'todoFlowPersonalActivities_v3_api';
const LOCAL_STORAGE_KEY_WORK_ACTIVITIES = 'todoFlowWorkActivities_v3_api';
const LOCAL_STORAGE_KEY_APP_MODE = 'todoFlowAppMode';
const LOCAL_STORAGE_KEY_IS_AUTHENTICATED = 'todoFlowIsAuthenticated';
const LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS = 'todoFlowLoginAttempts';
const LOCAL_STORAGE_KEY_LOCKOUT_END_TIME = 'todoFlowLockoutEndTime';
const LOCAL_STORAGE_KEY_SESSION_EXPIRY = 'todoFlowSessionExpiry';
const LOCAL_STORAGE_KEY_UI_NOTIFICATIONS = 'todoFlowUINotifications_v1';
const SESSION_STORAGE_KEY_HISTORY_LOG = 'todoFlowHistoryLog_v2_api'; // No longer used for primary load
const LOCAL_STORAGE_KEY_APP_PIN = 'todoFlowAppPin';


const SESSION_DURATION_24_HOURS_MS = 24 * 60 * 60 * 1000;
const SESSION_DURATION_30_DAYS_MS = 30 * 24 * 60 * 60 * 1000;


const getIconComponent = (iconName: string): Icons.LucideIcon => {
  const capitalizedIconName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
  const pascalCaseIconName = capitalizedIconName.replace(/[^A-Za-z0-9]/g, '');
  return (Icons as any)[pascalCaseIconName] || Icons.Package;
};

let logoutChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined') {
  logoutChannel = new BroadcastChannel('todoFlowLogoutChannel');
}

const getStartOfDayUtil = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

interface FutureInstance {
  instanceDate: Date;
  masterActivityId: number;
}

function generateFutureInstancesForNotifications(
  masterActivity: Activity,
  rangeStartDate: Date,
  rangeEndDate: Date
): FutureInstance[] {
  if (!masterActivity.recurrence || masterActivity.recurrence.type === 'none') {
    const activityDate = new Date(masterActivity.createdAt);
    if (isWithinInterval(activityDate, { start: rangeStartDate, end: rangeEndDate }) && !masterActivity.completed) {
        return [{ instanceDate: activityDate, masterActivityId: masterActivity.id }];
    }
    return [];
  }

  const instances: FutureInstance[] = [];
  const recurrence = masterActivity.recurrence;
  let currentDate = new Date(masterActivity.createdAt);

   if (isBefore(currentDate, rangeStartDate)) {
      if (recurrence.type === 'daily') {
          currentDate = rangeStartDate;
      } else if (recurrence.type === 'weekly' && recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
          let tempDate = dateFnsStartOfDay(rangeStartDate);
          while(isBefore(tempDate, new Date(masterActivity.createdAt)) || !recurrence.daysOfWeek.includes(getDay(tempDate)) || isBefore(tempDate, rangeStartDate)) {
              tempDate = addDays(tempDate, 1);
              if (isAfter(tempDate, rangeEndDate)) break;
          }
          currentDate = tempDate;
      } else if (recurrence.type === 'monthly' && recurrence.dayOfMonth) {
          let tempMasterStartMonthDay = setDayOfMonthFn(new Date(masterActivity.createdAt), recurrence.dayOfMonth);
          if (isBefore(tempMasterStartMonthDay, new Date(masterActivity.createdAt))) {
              tempMasterStartMonthDay = addMonths(tempMasterStartMonthDay, 1);
          }

          currentDate = setDayOfMonthFn(rangeStartDate, recurrence.dayOfMonth);
          if (isBefore(currentDate, rangeStartDate)) currentDate = addMonths(currentDate,1);
          if (isBefore(currentDate, tempMasterStartMonthDay)) {
             currentDate = tempMasterStartMonthDay;
          }
      }
  }

  const seriesEndDate = recurrence.endDate ? new Date(recurrence.endDate) : null;
  let iterations = 0;
  const maxIterations = 366 * 1; // Check for 1 year of occurrences

  while (iterations < maxIterations && !isAfter(currentDate, rangeEndDate)) {
    iterations++;
    if (seriesEndDate && isAfter(currentDate, seriesEndDate)) break;
    if (isBefore(currentDate, new Date(masterActivity.createdAt))) {
        if (recurrence.type === 'daily') currentDate = addDays(currentDate, 1);
        else if (recurrence.type === 'weekly') currentDate = addDays(currentDate, 1); // Iterate daily for weekly, check day later
        else if (recurrence.type === 'monthly') {
            // Carefully advance to the next potential day in the next month
            const nextMonth = addMonths(currentDate, 1);
            currentDate = recurrence.dayOfMonth ? setDayOfMonthFn(nextMonth, recurrence.dayOfMonth) : nextMonth;
        } else break;
        continue;
    }

    let isValidOccurrence = false;
    switch (recurrence.type) {
      case 'daily':
        isValidOccurrence = true;
        break;
      case 'weekly':
        if (recurrence.daysOfWeek?.includes(getDay(currentDate))) {
          isValidOccurrence = true;
        }
        break;
      case 'monthly':
        if (recurrence.dayOfMonth && getDate(currentDate) === recurrence.dayOfMonth) {
          isValidOccurrence = true;
        }
        break;
    }

    if (isValidOccurrence) {
      const occurrenceDateKey = formatISO(currentDate, { representation: 'date' });
      const isInstanceCompleted = !!masterActivity.completedOccurrences?.[occurrenceDateKey];
      if (!isInstanceCompleted) {
           instances.push({
            instanceDate: new Date(currentDate.getTime()), // Create new Date object
            masterActivityId: masterActivity.id,
          });
      }
    }

    // Advance current date
    if (recurrence.type === 'daily') {
        currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'weekly') {
        currentDate = addDays(currentDate, 1); // Iterate daily, check day in next loop
    } else if (recurrence.type === 'monthly') {
        // Ensure we move to the next month if dayOfMonth logic is tricky
        if (recurrence.dayOfMonth) {
            let nextIterationDate;
            const currentMonthTargetDay = setDayOfMonthFn(currentDate, recurrence.dayOfMonth);
            if(isAfter(currentMonthTargetDay, currentDate) && getDate(currentMonthTargetDay) === recurrence.dayOfMonth){
                 nextIterationDate = currentMonthTargetDay; // Target day is later this month
            } else {
                 // Target day was today, already passed, or doesn't exist this month (e.g. 31st in Feb)
                 // Move to target day in next month
                 let nextMonthDate = addMonths(currentDate, 1);
                 nextIterationDate = setDayOfMonthFn(nextMonthDate, recurrence.dayOfMonth);
            }
            currentDate = nextIterationDate;
        } else {
            // Should not happen if dayOfMonth is required for monthly
            currentDate = addDays(currentDate, 1);
        }
    } else {
      break; // Should not happen with valid recurrence types
    }
  }
  return instances;
}

function parseHslString(hslString: string): { h: number; s: number; l: number } | null {
  if (!hslString) return null;
  const match = hslString.match(/^(?:hsl\(\s*)?(-?\d*\.?\d+)(?:deg|rad|turn|)?\s*[, ]?\s*(-?\d*\.?\d+)%?\s*[, ]?\s*(-?\d*\.?\d+)%?(?:\s*[,/]\s*(-?\d*\.?\d+)\%?)?(?:\s*\))?$/i);
  if (!match) return null;
  const h = parseFloat(match[1]);
  const s = parseFloat(match[2]);
  const l = parseFloat(match[3]);
  if (isNaN(h) || isNaN(s) || isNaN(l)) return null;
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHexByte = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHexByte(f(0))}${toHexByte(f(8))}${toHexByte(f(4))}`;
}

const POMODORO_WORK_DURATION_SECONDS = 25 * 60;
const POMODORO_SHORT_BREAK_DURATION_SECONDS = 5 * 60;
const POMODORO_LONG_BREAK_DURATION_SECONDS = 15 * 60;
const POMODORO_CYCLES_BEFORE_LONG_BREAK = 4;

// --- Transformation Helpers ---
const backendToFrontendCategory = (backendCat: BackendCategory): Category => ({
  id: backendCat.id,
  name: backendCat.name,
  iconName: backendCat.icon_name,
  icon: getIconComponent(backendCat.icon_name || 'Package'),
  mode: backendCat.mode === 'both' ? 'all' : backendCat.mode,
});

const frontendToBackendCategoryMode = (frontendMode: AppMode | 'all'): BackendCategoryMode => {
  if (frontendMode === 'all') return 'both';
  return frontendMode; // 'personal' or 'work'
};

const backendToFrontendAssignee = (backendUser: BackendUser): Assignee => ({
  id: backendUser.id,
  name: backendUser.name,
  username: backendUser.username,
});

const backendToFrontendActivity = (backendActivity: BackendActivity, currentAppMode: AppMode): Activity => {
  let daysOfWeekArray: number[] = [];
  if (backendActivity.days_of_week && typeof backendActivity.days_of_week === 'string') {
    daysOfWeekArray = backendActivity.days_of_week.split(',').map(dayStr => parseInt(dayStr.trim(), 10)).filter(num => !isNaN(num));
  } else if (Array.isArray(backendActivity.days_of_week)) { // Should not happen if backend sends string
    daysOfWeekArray = backendActivity.days_of_week.map(dayStr => parseInt(String(dayStr).trim(), 10)).filter(num => !isNaN(num));
  }

  const recurrenceRule: RecurrenceRule = {
    type: backendActivity.repeat_mode as RecurrenceType, // Direct cast, ensure enums match
    endDate: backendActivity.end_date ? parseISO(backendActivity.end_date).getTime() : null,
    daysOfWeek: daysOfWeekArray,
    dayOfMonth: backendActivity.day_of_month ?? undefined, // Use ?? for null/undefined
  };

  return {
    id: backendActivity.id,
    title: backendActivity.title,
    categoryId: backendActivity.category_id,
    todos: (backendActivity.todos || []).map((bt: BackendTodo) => ({ // Ensure todos is an array
      id: bt.id,
      text: bt.text,
      completed: false, // Backend todo doesn't have completed state, default to false
    })),
    createdAt: parseISO(backendActivity.start_date).getTime(),
    time: backendActivity.time,
    notes: backendActivity.notes ?? undefined,
    recurrence: recurrenceRule.type === 'none' ? { type: 'none' } : recurrenceRule,
    completedOccurrences: {}, // Initialize as empty, client manages this
    responsiblePersonIds: backendActivity.responsibles.map(r => r.id),
    appMode: backendActivity.mode === 'both' ? currentAppMode : backendActivity.mode,
    // completed, completedAt are client-side or derived, not directly from backendActivity
  };
};

const frontendToBackendActivityPayload = (
  activity: Omit<Activity, 'id' | 'todos' | 'completedOccurrences' | 'isRecurringInstance' | 'originalInstanceDate' | 'masterActivityId'> & { todos?: Omit<Todo, 'id' | 'completed'>[] },
  isUpdate: boolean = false
): BackendActivityCreatePayload | BackendActivityUpdatePayload => {
  const payload: Partial<BackendActivityCreatePayload & BackendActivityUpdatePayload> = {
    title: activity.title,
    start_date: new Date(activity.createdAt).toISOString(), // Ensure ISO string
    time: activity.time || "00:00", // Backend expects time
    category_id: activity.categoryId,
    notes: activity.notes,
    mode: activity.appMode, // 'personal' or 'work' directly matches BackendCategoryMode here
    responsible_ids: activity.responsiblePersonIds || [],
  };

  if (activity.recurrence && activity.recurrence.type !== 'none') {
    payload.repeat_mode = activity.recurrence.type as BackendRepeatMode; // Cast, ensure enums match
    if (activity.recurrence.endDate) {
      payload.end_date = new Date(activity.recurrence.endDate).toISOString();
    }
    if (activity.recurrence.type === 'weekly' && activity.recurrence.daysOfWeek) {
      // Backend expects array of strings e.g., ["0", "1"]
      payload.days_of_week = activity.recurrence.daysOfWeek.map(String);
    }
    if (activity.recurrence.type === 'monthly' && activity.recurrence.dayOfMonth) {
      payload.day_of_month = activity.recurrence.dayOfMonth;
    }
  } else {
    payload.repeat_mode = 'none';
  }

  if (!isUpdate && activity.todos) { // For create
    (payload as BackendActivityCreatePayload).todos = activity.todos.map(t => ({ text: t.text }));
  }
  // Note: For updates, todos are not sent in this payload as per current backend definition.
  // If todos need to be updated with the activity, backend PUT /activities/{id} must handle it.

  return payload as BackendActivityCreatePayload | BackendActivityUpdatePayload;
};

const backendToFrontendHistory = (backendHistory: BackendHistory): HistoryLogEntry => ({
  id: backendHistory.id,
  timestamp: parseISO(backendHistory.timestamp).getTime(),
  // Attempt to map backendHistory.action to a known HistoryLogActionKey
  // This requires a mapping or more sophisticated logic if backend actions don't directly match frontend keys
  actionKey: backendHistory.action as HistoryLogActionKey, // This is a simplification
  backendAction: backendHistory.action, // Store original backend action
  backendUserId: backendHistory.user_id,
  scope: 'account', // Default scope, can be refined if backend provides more info
  details: { rawBackendAction: backendHistory.action } // Store raw action if needed
});

const createApiErrorToast = (
    err: unknown,
    toastFn: (options: any) => void,
    defaultTitleKey: keyof Translations,
    operationType: 'loading' | 'adding' | 'updating' | 'deleting',
    translationFn: (key: keyof Translations, params?: any) => string,
    endpoint?: string
  ) => {
    const error = err as Error;
    console.error(`[AppProvider] Failed ${operationType}. API: ${endpoint || API_BASE_URL}. Error:`, error);
    let description = error.message || `An unknown error occurred while ${operationType}. Check console for details.`;

    if (error.message.toLowerCase().includes('failed to fetch')) {
      description = `Could not connect to the server at ${endpoint || API_BASE_URL}. Please check network, server status, and CORS.`;
    } else if (error.message.includes("Unexpected token '<'")) {
      description = `Server returned HTML instead of JSON. Check server logs or if API endpoint ${endpoint || API_BASE_URL} exists and is correct.`;
    }
    toastFn({ variant: "destructive", title: translationFn(defaultTitleKey), description });
};


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [personalActivities, setPersonalActivities] = useState<Activity[]>([]);
  const [workActivities, setWorkActivities] = useState<Activity[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [assignees, setAllAssignees] = useState<Assignee[]>([]);
  const [appModeState, setAppModeState] = useState<AppMode>('personal');

  const [isLoadingState, setIsLoadingState] = useState<boolean>(true); // Overall initial loading
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isAssigneesLoading, setIsAssigneesLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true); // For history loading

  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, locale } = useTranslations();

  const dateFnsLocale = useMemo(() => (locale === 'es' ? es : locale === 'fr' ? fr : enUS), [locale]);
  const [lastNotificationCheckDay, setLastNotificationCheckDay] = useState<number | null>(null);
  const [notifiedToday, setNotifiedToday] = useState<Set<string>>(new Set());
  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(false);
  const [loginAttempts, setLoginAttemptsState] = useState<number>(0);
  const [lockoutEndTime, setLockoutEndTimeState] = useState<number | null>(null);
  const [sessionExpiryTimestamp, setSessionExpiryTimestampState] = useState<number | null>(null);
  const [uiNotifications, setUINotifications] = useState<UINotification[]>([]);
  const [historyLog, setHistoryLog] = useState<HistoryLogEntry[]>([]);
  const { theme, resolvedTheme } = useTheme();
  const [systemNotificationPermission, setSystemNotificationPermission] = useState<NotificationPermission | null>(null);

  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('off');
  const [pomodoroTimeRemaining, setPomodoroTimeRemaining] = useState(POMODORO_WORK_DURATION_SECONDS);
  const [pomodoroIsRunning, setPomodoroIsRunning] = useState(false);
  const [pomodoroCyclesCompleted, setPomodoroCyclesCompleted] = useState(0);
  const [isPomodoroReady, setIsPomodoroReady] = useState(false);
  const prevPomodoroPhaseRef = useRef<PomodoroPhase>(pomodoroPhase);

  const [isAppLocked, setIsAppLocked] = useState(false);
  const [appPinState, setAppPinState] = useState<string | null>(HARDCODED_APP_PIN);


  useEffect(() => {
    if (typeof window === 'undefined' || isLoadingState) return; // Ensure not to run too early
    const timerId = setTimeout(() => { // Delay slightly to ensure CSS variables are applied
        const computedStyle = getComputedStyle(document.documentElement);
        const backgroundHslString = computedStyle.getPropertyValue('--background').trim();
        const hslValues = parseHslString(backgroundHslString);

        if (hslValues) {
          const hexColor = hslToHex(hslValues.h, hslValues.s, hslValues.l);
          let metaThemeColor = document.querySelector('meta[name="theme-color"]');
          if (!metaThemeColor) {
              metaThemeColor = document.createElement('meta');
              metaThemeColor.setAttribute('name', 'theme-color');
              document.getElementsByTagName('head')[0].appendChild(metaThemeColor);
          }
          metaThemeColor.setAttribute('content', hexColor);
        } else {
            console.warn("[AppProvider] Could not parse --background HSL string for theme-color:", backgroundHslString);
        }
    }, 0); // 0ms delay often pushes execution after current rendering cycle
    return () => clearTimeout(timerId);
  }, [theme, resolvedTheme, appModeState, isLoadingState]); // Re-run when theme or mode changes

  const getRawActivities = useCallback(() => {
    // This will eventually fetch from backend or use a more sophisticated cache
    return appModeState === 'work' ? workActivities : personalActivities;
  }, [appModeState, workActivities, personalActivities]);

  const currentActivitySetter = useMemo(() => {
    return appModeState === 'work' ? setWorkActivities : setPersonalActivities;
  }, [appModeState]);

 const filteredCategories = useMemo(() => {
    if (isCategoriesLoading) return []; // Return empty if categories are still loading
    return allCategories.filter(cat =>
      cat.mode === 'all' || cat.mode === appModeState
    );
  }, [allCategories, appModeState, isCategoriesLoading]);

  const assigneesForContext = useMemo(() => {
    if (isAssigneesLoading) return []; // Return empty if assignees are still loading
    // For now, assume assignees are global, not per-mode from backend unless specified otherwise
    return assignees;
    // If assignees were mode-specific:
    // return appModeState === 'personal' ? assignees : [];
  }, [assignees, appModeState, isAssigneesLoading]);


  const addHistoryLogEntry = useCallback((actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined>, scope: HistoryLogEntry['scope'] = 'account') => {
    const newEntry: HistoryLogEntry = {
      // id will be assigned by backend, for client-side only, use temporary
      id: Date.now() + Math.random(), // Temporary unique ID for list key
      timestamp: Date.now(),
      actionKey,
      details,
      scope,
    };
    // Add to local state for immediate UI update. Backend handles persistent storage.
    setHistoryLog(prevLog => [newEntry, ...prevLog.slice(0, 99)]);
  }, []);

  const stableAddUINotification = useCallback((data: Omit<UINotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: UINotification = {
      ...data,
      id: uuidv4(),
      timestamp: Date.now(),
      read: false,
    };
    setUINotifications(prev => {
        // Prevent duplicate notifications for the same event if rapidly triggered
        const existingNotification = prev.find(n => n.activityId === newNotification.activityId && n.instanceDate === newNotification.instanceDate && n.title === newNotification.title);
        if (existingNotification) return prev;
        return [newNotification, ...prev.slice(0, 49)]; // Keep last 50 notifications
    });
  }, []);

  const showSystemNotification = useCallback((title: string, description: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try { new Notification(title, { body: description, icon: '/icons/icon-192x192.png', lang: locale }); }
      catch (error) { console.error("[AppProvider] Error creating system notification:", error); }
    }
  }, [locale]);

  const requestSystemNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setSystemNotificationPermission('denied'); // Assume denied if API not available
      toast({ title: t('systemNotificationsBlocked'), description: t('enableSystemNotificationsDescription') as string });
      return;
    }
    if (Notification.permission === 'granted') { setSystemNotificationPermission('granted'); return; }
    if (Notification.permission === 'denied') {
      setSystemNotificationPermission('denied');
      toast({ title: t('systemNotificationsBlocked'), description: t('enableSystemNotificationsDescription') as string, duration: 7000 });
      return;
    }
    // 'default' state, request permission
    try {
      const permissionResult = await Notification.requestPermission();
      setSystemNotificationPermission(permissionResult);
      if (permissionResult === 'granted') {
        toast({ title: t('systemNotificationsEnabled'), description: t('systemNotificationsNowActive') as string });
        showSystemNotification(t('systemNotificationsEnabled') as string, t('systemNotificationsNowActive') as string);
      } else if (permissionResult === 'denied') {
        toast({ title: t('systemNotificationsBlocked'), description: t('systemNotificationsUserDenied') as string });
      } else { // 'default', user dismissed
         toast({ title: t('systemNotificationsNotYetEnabled') as string, description: t('systemNotificationsDismissed') as string });
      }
    } catch (err) {
      // Fallback if requestPermission itself errors
      setSystemNotificationPermission(Notification.permission); // Update with current permission
    }
  }, [t, toast, showSystemNotification]);

  const logout = useCallback(() => {
    addHistoryLogEntry('historyLogLogout', undefined, 'account');
    setIsAuthenticatedState(false);
    setLoginAttemptsState(0);
    setLockoutEndTimeState(null);
    setSessionExpiryTimestampState(null);
    // Clear history log from state on logout, will be re-fetched on next login
    setHistoryLog([]);
    setIsAppLocked(false); // Unlock app on logout

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'RESET_TIMER', payload: { locale } });
    }

    if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);
        localStorage.removeItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS);
        localStorage.removeItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME);
        localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY);
        // sessionStorage.removeItem(SESSION_STORAGE_KEY_HISTORY_LOG); // No longer primary source for history
    }
    if (logoutChannel) logoutChannel.postMessage('logout_event');
  }, [addHistoryLogEntry, locale]); // Added locale dependency for SW message

  // Combined initial data loading effect
 useEffect(() => {
    setIsLoadingState(true);
    setIsCategoriesLoading(true);
    setIsAssigneesLoading(true);
    setIsHistoryLoading(true); // History is fetched if authenticated
    let initialAuth = false; // To determine if history should be fetched

    const fetchInitialCategories = async () => {
      setIsCategoriesLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/categories`);
        if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to fetch categories: HTTP ${response.status}`);}
        const backendCategories: BackendCategory[] = await response.json();
        setAllCategories(backendCategories.map(cat => backendToFrontendCategory(cat)));
      } catch (err) {
        createApiErrorToast(err, toast, "toastCategoryDeletedTitle", "loading", t, `${API_BASE_URL}/categories`);
        setError(prev => prev ? `${prev} Categories failed. ` : "Categories failed. ");
        setAllCategories([]); // Fallback to empty or could load INITIAL_CATEGORIES here
      } finally {
        setIsCategoriesLoading(false);
      }
    };

    const fetchInitialAssignees = async () => {
      setIsAssigneesLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/users`);
        if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to fetch users: HTTP ${response.status}`);}
        const backendUsers: BackendUser[] = await response.json();
        setAllAssignees(backendUsers.map(user => backendToFrontendAssignee(user)));
      } catch (err) {
        createApiErrorToast(err, toast, "toastAssigneeDeletedTitle", "loading", t, `${API_BASE_URL}/users`);
        setError(prev => prev ? `${prev} Assignees failed. ` : "Assignees failed. ");
        setAllAssignees([]);
      } finally {
        setIsAssigneesLoading(false);
      }
    };

    const fetchInitialHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/history`);
        if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to fetch history: HTTP ${response.status}`);}
        const backendHistoryItems: BackendHistory[] = await response.json();
        setHistoryLog(backendHistoryItems.map(item => backendToFrontendHistory(item)));
      } catch (err) {
        createApiErrorToast(err, toast, "historyPageTitle", "loading", t, `${API_BASE_URL}/history`);
        setError(prev => prev ? `${prev} History failed. ` : "History failed. ");
        setHistoryLog([]);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    const loadClientSideData = () => {
      // Load client-side persistent states (auth, mode, etc.)
      try {
        const storedPersonalActivities = localStorage.getItem(LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES);
        if (storedPersonalActivities) setPersonalActivities(JSON.parse(storedPersonalActivities));
        const storedWorkActivities = localStorage.getItem(LOCAL_STORAGE_KEY_WORK_ACTIVITIES);
        if (storedWorkActivities) setWorkActivities(JSON.parse(storedWorkActivities));
      } catch (e) { console.error("[AppProvider] Failed to parse activities from localStorage.", e); setError(prev => prev ? `${prev} Local activities failed. ` : "Local activities failed. ");}

      const storedAppMode = localStorage.getItem(LOCAL_STORAGE_KEY_APP_MODE) as AppMode | null;
      if (storedAppMode && (storedAppMode === 'personal' || storedAppMode === 'work')) setAppModeState(storedAppMode);

      const storedAuth = localStorage.getItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);
      const storedExpiry = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY);
      if (storedAuth === 'true' && storedExpiry) {
          const expiryTime = parseInt(storedExpiry, 10);
          if (Date.now() > expiryTime) {
            initialAuth = false; // Session expired
            logout(); // Perform logout actions
          } else {
            initialAuth = true;
            setSessionExpiryTimestampState(expiryTime);
          }
      }
      setIsAuthenticatedState(initialAuth); // Set auth state based on localStorage check

      const storedAttempts = localStorage.getItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS);
      setLoginAttemptsState(storedAttempts ? parseInt(storedAttempts, 10) : 0);
      const storedLockoutTime = localStorage.getItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME);
      setLockoutEndTimeState(storedLockoutTime ? parseInt(storedLockoutTime, 10) : null);

      const storedUINotifications = localStorage.getItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS);
      if (storedUINotifications) setUINotifications(JSON.parse(storedUINotifications));

      if (typeof window !== 'undefined' && 'Notification' in window) setSystemNotificationPermission(Notification.permission);

      const storedPin = localStorage.getItem(LOCAL_STORAGE_KEY_APP_PIN);
      if (storedPin) setAppPinState(storedPin);
      else if (HARDCODED_APP_PIN) setAppPinState(HARDCODED_APP_PIN); // Fallback to hardcoded if any
    };

    const fetchAllData = async () => {
        loadClientSideData(); // Load local storage stuff first
        // Fetch data that doesn't depend on auth status or can be fetched regardless
        await Promise.all([fetchInitialCategories(), fetchInitialAssignees()]);

        if (initialAuth) { // Fetch history only if authenticated from localStorage
            await fetchInitialHistory();
        } else {
            setIsHistoryLoading(false); // Not authenticated, no history to load from backend
        }
        setIsLoadingState(false); // All initial loading attempts are done
    };
    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs once on mount


  useEffect(() => {
    if (!isLoadingState) { // Only save to localStorage after initial load is complete
      localStorage.setItem(LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES, JSON.stringify(personalActivities));
    }
  }, [personalActivities, isLoadingState]);

  useEffect(() => {
    if (!isLoadingState) {
      localStorage.setItem(LOCAL_STORAGE_KEY_WORK_ACTIVITIES, JSON.stringify(workActivities));
    }
  }, [workActivities, isLoadingState]);

  useEffect(() => {
    if (!isLoadingState) {
      localStorage.setItem(LOCAL_STORAGE_KEY_APP_MODE, appModeState);
      const root = document.documentElement;
      root.classList.remove('mode-personal', 'mode-work');
      root.classList.add(appModeState === 'work' ? 'mode-work' : 'mode-personal');
    }
  }, [appModeState, isLoadingState]);

  // Auth related localStorage updates
  useEffect(() => { if (!isLoadingState) { if (isAuthenticated) localStorage.setItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED, 'true'); else localStorage.removeItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);}}, [isAuthenticated, isLoadingState]);
  useEffect(() => { if (!isLoadingState) localStorage.setItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS, String(loginAttempts));}, [loginAttempts, isLoadingState]);
  useEffect(() => { if (!isLoadingState) { if (lockoutEndTime === null) localStorage.removeItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME); else localStorage.setItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME, String(lockoutEndTime));}}, [lockoutEndTime, isLoadingState]);
  useEffect(() => { if (!isLoadingState) { if (sessionExpiryTimestamp === null) localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY); else localStorage.setItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY, String(sessionExpiryTimestamp));}}, [sessionExpiryTimestamp, isLoadingState]);
  useEffect(() => { if(!isLoadingState) localStorage.setItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS, JSON.stringify(uiNotifications));}, [uiNotifications, isLoadingState]);
  // History log is not saved to sessionStorage anymore, fetched from backend.

  // Notifications logic
  useEffect(() => {
    if (isLoadingState || !isAuthenticated) return; // Don't run if loading or not authenticated

    const intervalId = setInterval(() => {
      const now = new Date();
      const today = getStartOfDayUtil(now);
      const currentDayOfMonthFromNow = now.getDate();

      if (lastNotificationCheckDay !== null && lastNotificationCheckDay !== currentDayOfMonthFromNow) {
        setNotifiedToday(new Set()); // Reset notified set for the new day
      }
      setLastNotificationCheckDay(currentDayOfMonthFromNow);

      const activitiesToScan = appModeState === 'work' ? workActivities : personalActivities;

      activitiesToScan.forEach(masterActivity => {
        const activityTitle = masterActivity.title;
        const masterId = masterActivity.id;

        // Time-based notifications for today's instances
        if (masterActivity.time) {
          const todayInstances = generateFutureInstancesForNotifications(masterActivity, today, dateFnsEndOfDay(today));
          todayInstances.forEach(instance => {
            const occurrenceDateKey = formatISO(instance.instanceDate, { representation: 'date' });
            const notificationKey5Min = `${masterId}:${occurrenceDateKey}:5min_soon`;
            const isInstanceCompleted = !!masterActivity.completedOccurrences?.[occurrenceDateKey];

            if (!isInstanceCompleted && !notifiedToday.has(notificationKey5Min)) {
              const [hours, minutes] = masterActivity.time!.split(':').map(Number);
              const activityDateTime = new Date(instance.instanceDate); // Use instance date
              activityDateTime.setHours(hours, minutes, 0, 0);

              const fiveMinutesInMs = 5 * 60 * 1000;
              const timeDiffMs = activityDateTime.getTime() - now.getTime();

              if (timeDiffMs >= 0 && timeDiffMs <= fiveMinutesInMs) {
                const toastTitle = t('toastActivityStartingSoonTitle');
                const toastDesc = t('toastActivityStartingSoonDescription', { activityTitle, activityTime: masterActivity.time! });
                showSystemNotification(toastTitle, toastDesc);
                stableAddUINotification({ title: toastTitle, description: toastDesc, activityId: masterId, instanceDate: instance.instanceDate.getTime() });
                toast({ title: toastTitle, description: toastDesc });
                setNotifiedToday(prev => new Set(prev).add(notificationKey5Min));
              }
            }
          });
        }

        // Reminder notifications for recurring activities
        if (masterActivity.recurrence && masterActivity.recurrence.type !== 'none') {
          const recurrenceType = masterActivity.recurrence.type;
          // Check for instances in the next 8 days (includes tomorrow up to a week from tomorrow)
          const futureCheckEndDate = addDays(today, 8);
          const upcomingInstances = generateFutureInstancesForNotifications(masterActivity, addDays(today,1), futureCheckEndDate); // Start from tomorrow

          upcomingInstances.forEach(instance => {
            const instanceDateKey = formatISO(instance.instanceDate, { representation: 'date' });
            const isOccurrenceCompleted = !!masterActivity.completedOccurrences?.[instanceDateKey];
            if(isOccurrenceCompleted) return; // Skip if already completed

            const notify = (typeKey: string, titleKey: keyof Translations, descKey: keyof Translations, params: { activityTitle: string }) => {
              const notificationFullKey = `${masterId}:${instanceDateKey}:${typeKey}`;
              if (!notifiedToday.has(notificationFullKey)) {
                const notifTitle = t(titleKey as any, params);
                const notifDesc = t(descKey as any, params);
                showSystemNotification(notifTitle, notifDesc);
                stableAddUINotification({ title: notifTitle, description: notifDesc, activityId: masterId, instanceDate: instance.instanceDate.getTime() });
                toast({ title: notifTitle, description: notifDesc });
                setNotifiedToday(prev => new Set(prev).add(notificationFullKey));
              }
            };

            // Determine reminder dates based on today
            const oneDayBeforeInstance = dateFnsStartOfDay(subDays(instance.instanceDate, 1));
            const twoDaysBeforeInstance = dateFnsStartOfDay(subDays(instance.instanceDate, 2));
            const oneWeekBeforeInstance = dateFnsStartOfDay(subWeeks(instance.instanceDate, 1));

            if (recurrenceType === 'weekly') { // For weekly, a simple "tomorrow" reminder
                if (isSameDay(today, oneDayBeforeInstance)) {
                    notify('1day_weekly', 'toastActivityTomorrowTitle', 'toastActivityTomorrowDescription', { activityTitle });
                }
            } else if (recurrenceType === 'monthly') { // For monthly, more granular reminders
                if (isSameDay(today, oneWeekBeforeInstance)) {
                    notify('1week_monthly', 'toastActivityInOneWeekTitle', 'toastActivityInOneWeekDescription', { activityTitle });
                }
                if (isSameDay(today, twoDaysBeforeInstance)) {
                     notify('2days_monthly', 'toastActivityInTwoDaysTitle', 'toastActivityInTwoDaysDescription', { activityTitle });
                }
                if (isSameDay(today, oneDayBeforeInstance)) {
                    notify('1day_monthly', 'toastActivityTomorrowTitle', 'toastActivityTomorrowDescription', { activityTitle });
                }
            }
            // Daily recurring activities don't typically need future reminders beyond "starting soon"
          });
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [personalActivities, workActivities, appModeState, isLoadingState, isAuthenticated, toast, t, lastNotificationCheckDay, notifiedToday, stableAddUINotification, dateFnsLocale, showSystemNotification, locale]);

  // Logout listener for multi-tab sync
  useEffect(() => {
    if (!logoutChannel) return;
    const handleLogoutMessage = (event: MessageEvent) => { if (event.data === 'logout_event' && isAuthenticated) logout();};
    logoutChannel.addEventListener('message', handleLogoutMessage);
    return () => { if (logoutChannel) logoutChannel.removeEventListener('message', handleLogoutMessage);};
  }, [isAuthenticated, logout]);


  // Service Worker Communication for Pomodoro
  const postToServiceWorker = useCallback((message: any) => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({...message, payload: { ...message.payload, locale } });
    } else {
      // Only show error if SW is not ready and it's not the initial state request
      if (message.type !== 'GET_INITIAL_STATE' && !isPomodoroReady) {
        toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: t('pomodoroSWNotReady') as string });
      }
      // console.warn("Service worker controller not available. Pomodoro command not sent:", message.type);
    }
  }, [locale, t, toast, isPomodoroReady]); // Added isPomodoroReady to dependencies

  const handleSWMessage = useCallback((event: MessageEvent) => {
        if (event.data && event.data.type) {
            // console.log("[AppProvider] Message from SW:", event.data);
            if (event.data.type === 'TIMER_STATE') {
                const { phase, timeRemaining, isRunning, cyclesCompleted } = event.data.payload;
                setPomodoroPhase(phase);
                setPomodoroTimeRemaining(timeRemaining);
                setPomodoroIsRunning(isRunning);
                setPomodoroCyclesCompleted(cyclesCompleted);
                if (!isPomodoroReady) setIsPomodoroReady(true); // Mark as ready once state is received
            } else if (event.data.type === 'SW_ERROR') {
                toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: `Service Worker: ${event.data.payload.message || 'Unknown SW Error'}`});
            }
        }
    }, [isPomodoroReady, toast, t]); // Added isPomodoroReady

  useEffect(() => {
    const registerAndInitializeSW = async () => {
        try {
            // console.log("[AppProvider] Attempting to register SW...");
            await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            // console.log("[AppProvider] SW registration successful or already registered.");
            await navigator.serviceWorker.ready; // Wait for SW to be ready (installed and activated)
            // console.log("[AppProvider] SW ready.");
            if (navigator.serviceWorker.controller) {
                // console.log("[AppProvider] SW controller active. Requesting initial state.");
                // Delay slightly to give SW time to fully initialize its listeners if it just activated
                setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
            } else {
                // console.warn("[AppProvider] SW controller not yet active after ready. Might need a page reload after first registration.");
                setIsPomodoroReady(false); // Not ready if no controller
            }
        } catch (error) {
            // console.error("[AppProvider] Service Worker registration failed:", error);
            setIsPomodoroReady(false);
            toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: `SW Reg Error: ${error instanceof Error ? error.message : String(error)}`});
        }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', handleSWMessage);
        // Listen for controller changes, which can happen if a new SW activates
        const handleControllerChange = () => {
            // console.log("[AppProvider] SW controller changed.");
            if (navigator.serviceWorker.controller) {
                // console.log("[AppProvider] New SW controller active. Requesting initial state.");
                setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
            } else {
                setIsPomodoroReady(false);
            }
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        // Attempt registration on load or if document is already complete
        if (document.readyState === 'complete') {
            registerAndInitializeSW();
        } else {
            window.addEventListener('load', registerAndInitializeSW, { once: true });
        }
        // If there's already an active controller, try to get initial state
        if (navigator.serviceWorker.controller) {
             setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
        }

    } else {
        // console.warn("[AppProvider] Service Worker not supported in this browser.");
        setIsPomodoroReady(false); // SW not supported
    }

    return () => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.removeEventListener('message', handleSWMessage);
            // Potentially remove controllerchange listener too if it was added
        }
    };
  }, [locale, postToServiceWorker, handleSWMessage, t, toast]); // Dependencies

  // Pomodoro phase change notifications
  useEffect(() => {
    if (isPomodoroReady && prevPomodoroPhaseRef.current !== pomodoroPhase && prevPomodoroPhaseRef.current !== 'off') {
        // console.log(`[AppProvider] Pomodoro phase changed from ${prevPomodoroPhaseRef.current} to ${pomodoroPhase}`);
        const phaseThatEnded = prevPomodoroPhaseRef.current;
        let titleKey: keyof Translations = 'pomodoroWorkSessionEnded';
        let descriptionKey: keyof Translations = 'pomodoroFocusOnTask'; // Default description

        if (phaseThatEnded === 'work') {
            titleKey = 'pomodoroWorkSessionEnded';
            descriptionKey = (pomodoroCyclesCompleted > 0 && pomodoroCyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0)
                             ? 'pomodoroTakeALongBreak'
                             : 'pomodoroTakeAShortBreak';
        } else if (phaseThatEnded === 'shortBreak') {
            titleKey = 'pomodoroShortBreakEnded';
            descriptionKey = 'pomodoroBackToWork';
        } else if (phaseThatEnded === 'longBreak') {
            titleKey = 'pomodoroLongBreakEnded';
            descriptionKey = 'pomodoroBackToWork';
        }
        const title = t(titleKey as any); // Type assertion for safety
        const description = t(descriptionKey as any);

        if (title && description) {
            stableAddUINotification({ title, description, activityId: `pomodoro_cycle_${pomodoroCyclesCompleted}_${phaseThatEnded}` });
            toast({ title, description });
            // Potentially add system notification here too if desired
            // showSystemNotification(title, description);
        }
    }
    prevPomodoroPhaseRef.current = pomodoroPhase;
  }, [pomodoroPhase, pomodoroCyclesCompleted, isPomodoroReady, stableAddUINotification, t, toast]); // Removed showSystemNotification to avoid double system notifs if SW also sends them

  // Pomodoro control functions
  const startPomodoroWork = useCallback(() => postToServiceWorker({ type: 'START_WORK', payload: { locale, cyclesCompleted: 0 } }), [postToServiceWorker, locale]);
  const startPomodoroShortBreak = useCallback(() => postToServiceWorker({ type: 'START_SHORT_BREAK', payload: { locale } }), [postToServiceWorker, locale]);
  const startPomodoroLongBreak = useCallback(() => postToServiceWorker({ type: 'START_LONG_BREAK', payload: { locale } }), [postToServiceWorker, locale]);
  const pausePomodoro = useCallback(() => postToServiceWorker({ type: 'PAUSE_TIMER', payload: { locale } }), [postToServiceWorker, locale]);
  const resumePomodoro = useCallback(() => postToServiceWorker({ type: 'RESUME_TIMER', payload: { locale } }), [postToServiceWorker, locale]);
  const resetPomodoro = useCallback(() => {
    // console.log("[AppProvider] Resetting Pomodoro. Setting isPomodoroReady to false temporarily.");
    setIsPomodoroReady(false); // Force re-sync of state from SW
    postToServiceWorker({ type: 'RESET_TIMER', payload: { locale } });
    // The SW will send back the new 'off' state, which will set isPomodoroReady back to true via handleSWMessage
  }, [postToServiceWorker, locale]);


  const setAppMode = useCallback((mode: AppMode) => {
    if (mode !== appModeState) {
      addHistoryLogEntry(mode === 'personal' ? 'historyLogSwitchToPersonalMode' : 'historyLogSwitchToWorkMode', undefined, 'account');
    }
    setAppModeState(mode);
  }, [appModeState, addHistoryLogEntry]);

  const setIsAuthenticated = useCallback((value: boolean, rememberMe: boolean = false) => {
    const wasAuthenticated = isAuthenticated; // Capture state before change
    setIsAuthenticatedState(value);
    if (value && !wasAuthenticated) { // If just became authenticated
        addHistoryLogEntry('historyLogLogin', undefined, 'account');
        // Clear locally managed history log from previous session if any, backend is source of truth
        setHistoryLog([]);
        // Fetch history log from backend now that user is authenticated
        // This assumes fetchInitialHistory is safe to call multiple times or handles its own loading state.
        // It's better to have a dedicated function or ensure fetchInitialHistory checks auth.
        // For simplicity, calling it here, but ideally this is part of initial load logic when auth changes.
        // (async () => { await fetchInitialHistory(); })(); // fetchInitialHistory is already called in main useEffect

        const title = t('loginSuccessNotificationTitle');
        const description = t('loginSuccessNotificationDescription');
        stableAddUINotification({ title, description });
        showSystemNotification(title, description);
    }
    if (value) { // Set session expiry if authenticating
        const newExpiryTimestamp = Date.now() + (rememberMe ? SESSION_DURATION_30_DAYS_MS : SESSION_DURATION_24_HOURS_MS);
        setSessionExpiryTimestampState(newExpiryTimestamp);
    } else { // Clear session expiry if logging out
        setSessionExpiryTimestampState(null);
    }
  }, [isAuthenticated, addHistoryLogEntry, t, stableAddUINotification, showSystemNotification]); // Removed fetchInitialHistory call as it's in main useEffect

  const logPasswordChange = useCallback(() => addHistoryLogEntry('historyLogPasswordChange', undefined, 'account'), [addHistoryLogEntry]);
  const setLoginAttempts = useCallback((attempts: number) => setLoginAttemptsState(attempts), []);
  const setLockoutEndTime = useCallback((timestamp: number | null) => setLockoutEndTimeState(timestamp), []);

  // --- Category API Methods ---
  const addCategory = useCallback(async (name: string, iconName: string, mode: AppMode | 'all') => {
    setError(null);
    const payload: BackendCategoryCreatePayload = { name, icon_name: iconName, mode: frontendToBackendCategoryMode(mode) };
    try {
      const response = await fetch(`${API_BASE_URL}/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to add category: HTTP ${response.status}`);}
      const newBackendCategory: BackendCategory = await response.json();
      setAllCategories(prev => [...prev, backendToFrontendCategory(newBackendCategory)]);
      toast({ title: t('toastCategoryAddedTitle'), description: t('toastCategoryAddedDescription', { categoryName: name }) });
      addHistoryLogEntry(mode === 'personal' ? 'historyLogAddCategoryPersonal' : mode === 'work' ? 'historyLogAddCategoryWork' : 'historyLogAddCategoryAll', { name }, 'category');
    } catch (err) { createApiErrorToast(err, toast, "toastCategoryAddedTitle", "adding", t, `${API_BASE_URL}/categories`); setError((err as Error).message); throw err; }
  }, [toast, t, addHistoryLogEntry]);

  const updateCategory = useCallback(async (categoryId: number, updates: Partial<Omit<Category, 'id' | 'icon'>>, oldCategoryData?: Category) => {
    setError(null);
    const payload: Partial<BackendCategoryCreatePayload> = {}; // Use BackendCategoryCreatePayload for update structure too
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.iconName !== undefined) payload.icon_name = updates.iconName;
    if (updates.mode !== undefined) payload.mode = frontendToBackendCategoryMode(updates.mode);

    try {
      const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to update category: HTTP ${response.status}`);}
      const updatedBackendCategory: BackendCategory = await response.json();
      const updatedFrontendCategory = backendToFrontendCategory(updatedBackendCategory);
      setAllCategories(prev => prev.map(cat => (cat.id === categoryId ? updatedFrontendCategory : cat)));
      toast({ title: t('toastCategoryUpdatedTitle'), description: t('toastCategoryUpdatedDescription', { categoryName: updatedFrontendCategory.name }) });
      let actionKey: HistoryLogActionKey = 'historyLogUpdateCategoryAll';
      if (updatedFrontendCategory.mode === 'personal') actionKey = 'historyLogUpdateCategoryPersonal';
      else if (updatedFrontendCategory.mode === 'work') actionKey = 'historyLogUpdateCategoryWork';
      addHistoryLogEntry(actionKey, { name: updatedFrontendCategory.name, oldName: oldCategoryData?.name !== updatedFrontendCategory.name ? oldCategoryData?.name : undefined , oldMode: oldCategoryData?.mode !== updatedFrontendCategory.mode ? oldCategoryData?.mode : undefined }, 'category');
    } catch (err) { createApiErrorToast(err, toast, "toastCategoryUpdatedTitle", "updating", t, `${API_BASE_URL}/categories/${categoryId}`); setError((err as Error).message); throw err; }
  }, [toast, t, addHistoryLogEntry]);

  const deleteCategory = useCallback(async (categoryId: number) => {
    setError(null);
    const categoryToDelete = allCategories.find(cat => cat.id === categoryId);
    if (!categoryToDelete) return; // Should not happen if UI is consistent
    try {
      const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to delete category: HTTP ${response.status}`);}
      setAllCategories(prev => prev.filter(cat => cat.id !== categoryId));
      // Also update activities that might reference this category (set categoryId to null or a default)
      // This is complex if activities are also synced; for now, just remove category locally.
      toast({ title: t('toastCategoryDeletedTitle'), description: t('toastCategoryDeletedDescription', { categoryName: categoryToDelete.name }) });
      addHistoryLogEntry('historyLogDeleteCategory', { name: categoryToDelete.name, mode: categoryToDelete.mode as string }, 'category');
    } catch (err) { createApiErrorToast(err, toast, "toastCategoryDeletedTitle", "deleting", t, `${API_BASE_URL}/categories/${categoryId}`); setError((err as Error).message); throw err; }
  }, [allCategories, toast, t, addHistoryLogEntry]);

  // --- Assignee (User) API Methods ---
  const addAssignee = useCallback(async (name: string, usernameFromForm?: string, password?: string) => {
    setError(null);
    // Ensure username is at least 3 characters, fallback if not provided from form
    let finalUsername = usernameFromForm?.trim() || '';
    if (finalUsername.length < 3) {
      finalUsername = name.toLowerCase().replace(/\s+/g, '').substring(0,10) + Math.floor(Math.random() * 1000);
    }
    const finalPassword = password || "P@ssword123"; // Default password for new users via this UI
    const payload: BackendUserCreatePayload = { name, username: finalUsername, password: finalPassword };

    try {
      const response = await fetch(`${API_BASE_URL}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to add assignee: HTTP ${response.status}`);}
      const newBackendUser: BackendUser = await response.json();
      setAllAssignees(prev => [...prev, backendToFrontendAssignee(newBackendUser)]);
      toast({ title: t('toastAssigneeAddedTitle'), description: t('toastAssigneeAddedDescription', { assigneeName: name }) });
      addHistoryLogEntry('historyLogAddAssignee', { name }, 'assignee');
    } catch (err) { createApiErrorToast(err, toast, "toastAssigneeAddedTitle", "adding", t, `${API_BASE_URL}/users`); setError((err as Error).message); throw err; }
  }, [toast, t, addHistoryLogEntry]);

  const updateAssignee = useCallback(async (assigneeId: number, updates: Partial<Omit<Assignee, 'id' | 'username'>>) => {
    setError(null);
    const currentAssignee = assignees.find(a => a.id === assigneeId);
    // Backend PUT /users expects Form data. Sending JSON with just name for now.
    // This will require backend adjustment or frontend using FormData.
    const payload: Partial<BackendUserUpdatePayload> = { name: updates.name };
     // Password and username updates are complex and typically handled separately or with more security.
     // For this prototype, we only update the name.
     // If your backend strictly requires username/password on update via Form, this will fail.
     // It's assumed backend might allow partial update with name if body is JSON.

    try {
      // Note: Backend's PUT /users/{user_id} expects Form data.
      // Attempting to send JSON. This might need adjustment on backend or frontend.
      const response = await fetch(`${API_BASE_URL}/users/${assigneeId}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' }, // Sending JSON
         body: JSON.stringify(payload) // Only sending name
      });

      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to update assignee: HTTP ${response.status}`);}
      const updatedBackendUser: BackendUser = await response.json();
      setAllAssignees(prev => prev.map(asg => (asg.id === assigneeId ? backendToFrontendAssignee(updatedBackendUser) : asg)));
      toast({ title: t('toastAssigneeUpdatedTitle'), description: t('toastAssigneeUpdatedDescription', { assigneeName: updatedBackendUser.name }) });
      addHistoryLogEntry('historyLogUpdateAssignee', { name: updatedBackendUser.name, oldName: currentAssignee?.name !== updatedBackendUser.name ? currentAssignee?.name : undefined }, 'assignee');
    } catch (err) { createApiErrorToast(err, toast, "toastAssigneeUpdatedTitle", "updating", t, `${API_BASE_URL}/users/${assigneeId}`); setError((err as Error).message); throw err; }
  }, [assignees, toast, t, addHistoryLogEntry]);

  const deleteAssignee = useCallback(async (assigneeId: number) => {
    setError(null);
    const assigneeToDelete = assignees.find(asg => asg.id === assigneeId);
    if (!assigneeToDelete) return;
    try {
      const response = await fetch(`${API_BASE_URL}/users/${assigneeId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to delete assignee: HTTP ${response.status}`);}
      setAllAssignees(prev => prev.filter(asg => asg.id !== assigneeId));
      // Remove assignee from responsiblePersonIds in activities (client-side update)
      setPersonalActivities(prevActs => prevActs.map(act => ({ ...act, responsiblePersonIds: act.responsiblePersonIds?.filter(id => id !== assigneeId) })));
      setWorkActivities(prevActs => prevActs.map(act => ({ ...act, responsiblePersonIds: act.responsiblePersonIds?.filter(id => id !== assigneeId) })));
      toast({ title: t('toastAssigneeDeletedTitle'), description: t('toastAssigneeDeletedDescription', { assigneeName: assigneeToDelete.name }) });
      addHistoryLogEntry('historyLogDeleteAssignee', { name: assigneeToDelete.name }, 'assignee');
    } catch (err) { createApiErrorToast(err, toast, "toastAssigneeDeletedTitle", "deleting", t, `${API_BASE_URL}/users/${assigneeId}`); setError((err as Error).message); throw err; }
  }, [assignees, toast, t, addHistoryLogEntry]);


  // --- Activity API Methods (using localStorage as primary source for GETs, backend for CUD) ---
  const addActivity = useCallback(async (
      activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'completedAt' | 'notes' | 'recurrence' | 'completedOccurrences' | 'responsiblePersonIds' | 'categoryId' | 'appMode' | 'masterActivityId' | 'isRecurringInstance' | 'originalInstanceDate'> & {
        todos?: Omit<Todo, 'id' | 'completed'>[]; time?: string; notes?: string; recurrence?: RecurrenceRule | null; responsiblePersonIds?: number[]; categoryId: number; appMode: AppMode;
      }, customCreatedAt?: number
    ) => {
    setError(null);
    const frontendActivityShell: Activity = {
      id: Date.now(), // Temporary ID for local state before backend ID is known
      title: activityData.title,
      categoryId: activityData.categoryId,
      // Ensure todos are correctly structured for shell before payload creation
      todos: (activityData.todos || []).map(t => ({ id: Date.now() + Math.random(), text: t.text, completed: false })),
      createdAt: customCreatedAt !== undefined ? customCreatedAt : Date.now(),
      time: activityData.time,
      notes: activityData.notes,
      recurrence: activityData.recurrence,
      responsiblePersonIds: activityData.responsiblePersonIds,
      appMode: activityData.appMode, // This is crucial for the payload
      completedOccurrences: {},
      // completed, completedAt will be handled client-side or derived.
    };

    const payload = frontendToBackendActivityPayload(frontendActivityShell) as BackendActivityCreatePayload;

    try {
      const response = await fetch(`${API_BASE_URL}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to add activity: HTTP ${response.status}`);}
      const newBackendActivity: BackendActivity = await response.json();
      const newFrontendActivity = backendToFrontendActivity(newBackendActivity, appModeState); // Use appModeState here
      
      currentActivitySetter(prev => [...prev, newFrontendActivity]);
      toast({ title: t('toastActivityAddedTitle'), description: t('toastActivityAddedDescription') });
      addHistoryLogEntry(appModeState === 'personal' ? 'historyLogAddActivityPersonal' : 'historyLogAddActivityWork', { title: newFrontendActivity.title }, appModeState);
    } catch (err) { createApiErrorToast(err, toast, "toastActivityAddedTitle", "adding", t, `${API_BASE_URL}/activities`); setError((err as Error).message); throw err; }
  }, [currentActivitySetter, appModeState, toast, t, addHistoryLogEntry]);

  const updateActivity = useCallback(async (activityId: number, updates: Partial<Omit<Activity, 'id'>>, originalActivity?: Activity) => {
    setError(null);
    const currentActivitiesList = appModeState === 'work' ? workActivities : personalActivities;
    const activityToUpdate = currentActivitiesList.find(a => a.id === activityId);

    if (!activityToUpdate) {
      console.error("Activity not found for update:", activityId);
      toast({variant: "destructive", title: "Error", description: "Activity not found for update."});
      return;
    }
    // Create a shell of the updated activity for payload generation
    const updatedFrontendShell: Activity = { ...activityToUpdate, ...updates, appMode: activityToUpdate.appMode };
    const payload = frontendToBackendActivityPayload(updatedFrontendShell, true) as BackendActivityUpdatePayload;

    try {
      const response = await fetch(`${API_BASE_URL}/activities/${activityId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to update activity: HTTP ${response.status}`);}
      const updatedBackendActivity: BackendActivity = await response.json();
      // Transform back, ensuring client-managed state (like completedOccurrences) is preserved
      const finalFrontendActivity = {
        ...backendToFrontendActivity(updatedBackendActivity, appModeState), // Use appModeState
        completedOccurrences: activityToUpdate.completedOccurrences, // Preserve existing client-side occurrences
      };
      // If updates included completedOccurrences, merge them
      if (updates.completedOccurrences) {
        finalFrontendActivity.completedOccurrences = { ...finalFrontendActivity.completedOccurrences, ...updates.completedOccurrences };
      }
      // Preserve client-side main completion status if backend doesn't manage it
      if (updates.completed !== undefined) finalFrontendActivity.completed = updates.completed;
      if (updates.completedAt !== undefined) finalFrontendActivity.completedAt = updates.completedAt;


      currentActivitySetter(prev => prev.map(act => (act.id === activityId ? finalFrontendActivity : act)));
      toast({ title: t('toastActivityUpdatedTitle'), description: t('toastActivityUpdatedDescription') });
      addHistoryLogEntry(appModeState === 'personal' ? 'historyLogUpdateActivityPersonal' : 'historyLogUpdateActivityWork', { title: finalFrontendActivity.title }, appModeState);
    } catch (err) { createApiErrorToast(err, toast, "toastActivityUpdatedTitle", "updating", t, `${API_BASE_URL}/activities/${activityId}`); setError((err as Error).message); throw err; }
  }, [currentActivitySetter, appModeState, personalActivities, workActivities, toast, t, addHistoryLogEntry]);

  const deleteActivity = useCallback(async (activityId: number) => {
    setError(null);
    const currentActivitiesList = appModeState === 'work' ? workActivities : personalActivities;
    const activityToDelete = currentActivitiesList.find(a => a.id === activityId);
    if (!activityToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/activities/${activityId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to delete activity: HTTP ${response.status}`);}
      currentActivitySetter(prev => prev.filter(act => act.id !== activityId));
      toast({ title: t('toastActivityDeletedTitle'), description: t('toastActivityDeletedDescription', { activityTitle: activityToDelete.title }) });
      addHistoryLogEntry(appModeState === 'personal' ? 'historyLogDeleteActivityPersonal' : 'historyLogDeleteActivityWork', { title: activityToDelete.title }, appModeState);
    } catch (err) { createApiErrorToast(err, toast, "toastActivityDeletedTitle", "deleting", t, `${API_BASE_URL}/activities/${activityId}`); setError((err as Error).message); throw err; }
  }, [currentActivitySetter, appModeState, personalActivities, workActivities, toast, t, addHistoryLogEntry]);


  // Client-side Todo management (no direct backend sync for individual todo CUD yet)
  const addTodoToActivity = useCallback((activityId: number, todoText: string) => {
    // This remains client-side as backend doesn't have POST /activities/{id}/todos
    const newTodo: Todo = { id: Date.now() + Math.random(), text: todoText, completed: false };
    currentActivitySetter(prev =>
      prev.map(act =>
        act.id === activityId ? { ...act, todos: [...act.todos, newTodo] } : act
      )
    );
    // To sync with backend, would need to call updateActivity with all todos, or have dedicated todo endpoints
  }, [currentActivitySetter]);

  const updateTodoInActivity = useCallback((activityId: number, todoId: number, updates: Partial<Todo>) => {
    currentActivitySetter(prev =>
      prev.map(act =>
        act.id === activityId
          ? { ...act, todos: act.todos.map(todo => todo.id === todoId ? { ...todo, ...updates } : todo) }
          : act
      )
    );
  }, [currentActivitySetter]);

  const deleteTodoFromActivity = useCallback((activityId: number, todoId: number) => {
    currentActivitySetter(prev =>
      prev.map(act =>
        act.id === activityId
          ? { ...act, todos: act.todos.filter(todo => todo.id !== todoId) }
          : act
      )
    );
  }, [currentActivitySetter]);

  const toggleOccurrenceCompletion = useCallback((masterActivityId: number, occurrenceDateTimestamp: number, completedState: boolean) => {
    // This is purely client-side state management for completedOccurrences
    let activityTitleForLog = 'Unknown Activity';
    const masterActivity = getRawActivities().find(act => act.id === masterActivityId);
    if (masterActivity) activityTitleForLog = masterActivity.title;

    const occurrenceDateKey = formatDateFns(new Date(occurrenceDateTimestamp), 'yyyy-MM-dd');

    currentActivitySetter(prevActivities =>
      prevActivities.map(act => {
        if (act.id === masterActivityId) {
          const updatedOccurrences = { ...act.completedOccurrences };
          if (completedState) {
            updatedOccurrences[occurrenceDateKey] = true;
          } else {
            delete updatedOccurrences[occurrenceDateKey];
          }
          return { ...act, completedOccurrences: updatedOccurrences };
        }
        return act;
      })
    );
    addHistoryLogEntry(appModeState === 'personal' ? 'historyLogToggleActivityCompletionPersonal' : 'historyLogToggleActivityCompletionWork', { title: activityTitleForLog, completed: completedState ? 1 : 0 }, appModeState);
  }, [currentActivitySetter, appModeState, addHistoryLogEntry, getRawActivities]);


  const getCategoryById = useCallback((categoryId: number) => allCategories.find(cat => cat.id === categoryId), [allCategories]);
  const getAssigneeById = useCallback((assigneeId: number) => assignees.find(asg => asg.id === assigneeId), [assignees]);

  const markUINotificationAsRead = useCallback((notificationId: string) => setUINotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n)), []);
  const markAllUINotificationsAsRead = useCallback(() => setUINotifications(prev => prev.map(n => ({ ...n, read: true }))), []);
  const clearAllUINotifications = useCallback(() => setUINotifications([]), []);
  const unlockApp = useCallback((pinAttempt: string): boolean => { if (appPinState && pinAttempt === appPinState) { setIsAppLocked(false); return true; } return false; }, [appPinState]);
  const setAppPin = useCallback((pin: string | null) => {
    setAppPinState(pin);
    if (typeof window !== 'undefined') { if (pin) localStorage.setItem(LOCAL_STORAGE_KEY_APP_PIN, pin); else { localStorage.removeItem(LOCAL_STORAGE_KEY_APP_PIN); setIsAppLocked(false);}}
  }, []);

   useEffect(() => {
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible' && isAuthenticated && appPinState) setIsAppLocked(true);};
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, appPinState]);

  const combinedIsLoading = isLoadingState || isCategoriesLoading || isAssigneesLoading || (isAuthenticated && isHistoryLoading);

  return (
    <AppContext.Provider
      value={{
        activities: getRawActivities(), getRawActivities, categories: filteredCategories, assignees: assigneesForContext, appMode: appModeState, setAppMode,
        addActivity, updateActivity, deleteActivity, toggleOccurrenceCompletion,
        addTodoToActivity, updateTodoInActivity, deleteTodoFromActivity,
        getCategoryById, addCategory, updateCategory, deleteCategory,
        addAssignee, updateAssignee, deleteAssignee, getAssigneeById,
        isLoading: combinedIsLoading, error,
        isAuthenticated, setIsAuthenticated, loginAttempts, setLoginAttempts, lockoutEndTime, setLockoutEndTime, sessionExpiryTimestamp, logout, logPasswordChange,
        uiNotifications, addUINotification: stableAddUINotification, markUINotificationAsRead, markAllUINotificationsAsRead, clearAllUINotifications,
        historyLog, addHistoryLogEntry,
        systemNotificationPermission, requestSystemNotificationPermission,
        pomodoroPhase, pomodoroTimeRemaining, pomodoroIsRunning, pomodoroCyclesCompleted,
        startPomodoroWork, startPomodoroShortBreak, startPomodoroLongBreak, pausePomodoro, resumePomodoro, resetPomodoro, isPomodoroReady,
        isAppLocked, appPinState, unlockApp, setAppPin,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

    
