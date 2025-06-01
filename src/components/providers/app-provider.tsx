
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  Activity, Todo, Category, AppMode, RecurrenceRule, UINotification, HistoryLogEntry, HistoryLogActionKey, Translations, Assignee, PomodoroPhase,
  BackendCategoryCreatePayload, BackendCategory, BackendUser, BackendUserCreatePayload, BackendUserUpdatePayload, BackendActivityCreatePayload, BackendActivityUpdatePayload, BackendActivity, BackendTodoCreate, BackendHistory, RecurrenceType, BackendCategoryMode, BackendRepeatMode
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

const API_BASE_URL = 'http://localhost:10242';


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
  updateAssignee: (assigneeId: number, updates: Partial<Omit<Assignee, 'id'>>) => Promise<void>; // Now async
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

const LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES = 'todoFlowPersonalActivities_v3_api'; // Incremented version
const LOCAL_STORAGE_KEY_WORK_ACTIVITIES = 'todoFlowWorkActivities_v3_api'; // Incremented version
const LOCAL_STORAGE_KEY_APP_MODE = 'todoFlowAppMode';
const LOCAL_STORAGE_KEY_IS_AUTHENTICATED = 'todoFlowIsAuthenticated';
const LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS = 'todoFlowLoginAttempts';
const LOCAL_STORAGE_KEY_LOCKOUT_END_TIME = 'todoFlowLockoutEndTime';
const LOCAL_STORAGE_KEY_SESSION_EXPIRY = 'todoFlowSessionExpiry';
const LOCAL_STORAGE_KEY_UI_NOTIFICATIONS = 'todoFlowUINotifications_v1';
const SESSION_STORAGE_KEY_HISTORY_LOG = 'todoFlowHistoryLog_v2_api'; // Incremented version
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
  const maxIterations = 366 * 1;

  while (iterations < maxIterations && !isAfter(currentDate, rangeEndDate)) {
    iterations++;
    if (seriesEndDate && isAfter(currentDate, seriesEndDate)) break;
    if (isBefore(currentDate, new Date(masterActivity.createdAt))) {
        if (recurrence.type === 'daily') currentDate = addDays(currentDate, 1);
        else if (recurrence.type === 'weekly') currentDate = addDays(currentDate, 1);
        else if (recurrence.type === 'monthly') {
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
            instanceDate: new Date(currentDate.getTime()),
            masterActivityId: masterActivity.id,
          });
      }
    }

    if (recurrence.type === 'daily') {
        currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'weekly') {
        currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'monthly') {
        if (recurrence.dayOfMonth) {
            let nextIterationDate;
            const currentMonthTargetDay = setDayOfMonthFn(currentDate, recurrence.dayOfMonth);
            if(isAfter(currentMonthTargetDay, currentDate) && getDate(currentMonthTargetDay) === recurrence.dayOfMonth){
                 nextIterationDate = currentMonthTargetDay;
            } else {
                 let nextMonthDate = addMonths(currentDate, 1);
                 nextIterationDate = setDayOfMonthFn(nextMonthDate, recurrence.dayOfMonth);
            }
            currentDate = nextIterationDate;
        } else {
            currentDate = addDays(currentDate, 1);
        }
    } else {
      break;
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
  const recurrence: RecurrenceRule = {
    type: backendActivity.repeat_mode as RecurrenceType, // Assuming direct mapping
    endDate: backendActivity.end_date ? parseISO(backendActivity.end_date).getTime() : null,
    daysOfWeek: backendActivity.days_of_week ? backendActivity.days_of_week.split(',').map(Number) : [],
    dayOfMonth: backendActivity.day_of_month ?? undefined,
  };

  return {
    id: backendActivity.id,
    title: backendActivity.title,
    categoryId: backendActivity.category_id,
    todos: backendActivity.todos.map(bt => ({
      id: bt.id,
      text: bt.text,
      completed: false, // Backend doesn't store completion; default to false
    })),
    createdAt: parseISO(backendActivity.start_date).getTime(),
    time: backendActivity.time,
    // completed & completedAt are client-side or derived for non-recurring
    notes: backendActivity.notes ?? undefined,
    recurrence: recurrence.type === 'none' ? { type: 'none' } : recurrence,
    completedOccurrences: {}, // To be managed client-side
    responsiblePersonIds: backendActivity.responsibles.map(r => r.id),
    appMode: backendActivity.mode === 'both' ? currentAppMode : backendActivity.mode, // If 'both', use current appMode, else specific
  };
};

const frontendToBackendActivityPayload = (
  activity: Omit<Activity, 'id' | 'todos' | 'completedOccurrences' | 'isRecurringInstance' | 'originalInstanceDate' | 'masterActivityId'> & { todos?: Omit<Todo, 'id' | 'completed'>[] },
  isUpdate: boolean = false
): BackendActivityCreatePayload | BackendActivityUpdatePayload => {
  const payload: Partial<BackendActivityCreatePayload & BackendActivityUpdatePayload> = {
    title: activity.title,
    start_date: formatISO(new Date(activity.createdAt)),
    time: activity.time || "00:00", // Backend requires time
    category_id: activity.categoryId,
    notes: activity.notes,
    mode: activity.appMode === 'personal' ? 'personal' : 'work', // Map AppMode to CategoryMode
    responsible_ids: activity.responsiblePersonIds || [],
  };

  if (activity.recurrence && activity.recurrence.type !== 'none') {
    payload.repeat_mode = activity.recurrence.type as BackendRepeatMode;
    if (activity.recurrence.endDate) {
      payload.end_date = formatISO(new Date(activity.recurrence.endDate));
    }
    if (activity.recurrence.type === 'weekly' && activity.recurrence.daysOfWeek) {
      payload.days_of_week = activity.recurrence.daysOfWeek.map(String);
    }
    if (activity.recurrence.type === 'monthly' && activity.recurrence.dayOfMonth) {
      payload.day_of_month = activity.recurrence.dayOfMonth;
    }
  } else {
    payload.repeat_mode = 'none';
  }

  if (!isUpdate) { // For create
    (payload as BackendActivityCreatePayload).todos = (activity.todos || []).map(t => ({ text: t.text }));
  }
  // For updates, todos are handled differently by the backend (not simple field update).
  // The current backend PUT /activities doesn't seem to update todos.

  return payload as BackendActivityCreatePayload | BackendActivityUpdatePayload;
};

const backendToFrontendHistory = (backendHistory: BackendHistory): HistoryLogEntry => ({
  id: backendHistory.id,
  timestamp: parseISO(backendHistory.timestamp).getTime(),
  actionKey: 'historyLogLogin', // Placeholder, needs mapping from backendHistory.action
  backendAction: backendHistory.action,
  backendUserId: backendHistory.user_id,
  scope: 'account', // Default, may need more logic based on action
});


const createApiErrorToast = (
    err: unknown,
    toastFn: (options: any) => void,
    defaultTitle: string,
    operationType: 'loading' | 'adding' | 'updating' | 'deleting'
  ) => {
    const error = err as Error;
    console.error(`[AppProvider] Failed ${operationType}. API: ${API_BASE_URL}. Error:`, error);
    let description = error.message || `An unknown error occurred while ${operationType}.`;
    if (error.message.toLowerCase().includes('failed to fetch')) {
      description = `Could not connect to the server (${API_BASE_URL}). Please check your network connection, ensure the backend server is running and accessible, and verify CORS configuration on the server.`;
    } else if (error.message.includes("Unexpected token '<'")) {
      description = `The server returned HTML instead of JSON, indicating a server-side error or incorrect endpoint. Check the server logs. API: ${API_BASE_URL}`;
    }
    toastFn({ variant: "destructive", title: defaultTitle, description });
};


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [personalActivities, setPersonalActivities] = useState<Activity[]>([]);
  const [workActivities, setWorkActivities] = useState<Activity[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [assignees, setAllAssignees] = useState<Assignee[]>([]);
  const [appModeState, setAppModeState] = useState<AppMode>('personal');
  const [isLoading, setIsLoading] = useState<boolean>(true); // Combined loading state
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isAssigneesLoading, setIsAssigneesLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  // Activities are loaded from localStorage primarily, so no specific loading state for them yet
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
    if (typeof window === 'undefined' || isLoading) return;
    const timerId = setTimeout(() => {
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
    }, 0);
    return () => clearTimeout(timerId);
  }, [theme, resolvedTheme, appModeState, isLoading]);

  const getRawActivities = useCallback(() => {
    return appModeState === 'work' ? workActivities : personalActivities;
  }, [appModeState, workActivities, personalActivities]);

  const currentActivitySetter = useMemo(() => {
    return appModeState === 'work' ? setWorkActivities : setPersonalActivities;
  }, [appModeState]);

 const filteredCategories = useMemo(() => {
    if (isCategoriesLoading) return [];
    return allCategories.filter(cat =>
      cat.mode === 'all' || cat.mode === appModeState
    );
  }, [allCategories, appModeState, isCategoriesLoading]);

  const assigneesForContext = useMemo(() => {
    if (isAssigneesLoading) return [];
    return appModeState === 'personal' ? assignees : [];
  }, [assignees, appModeState, isAssigneesLoading]);

  const addHistoryLogEntry = useCallback((actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined>, scope: HistoryLogEntry['scope'] = 'account') => {
    // This will mostly add to client-side history log.
    // True backend history is through GET /history or server-side triggers.
    const newEntry: HistoryLogEntry = {
      id: Math.random(), // Temporary ID for client-side display if not synced
      timestamp: Date.now(),
      actionKey,
      details,
      scope,
    };
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
        const existingNotification = prev.find(n => n.activityId === newNotification.activityId && n.instanceDate === newNotification.instanceDate && n.title === newNotification.title);
        if (existingNotification) return prev;
        return [newNotification, ...prev.slice(0, 49)];
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
      setSystemNotificationPermission('denied');
      toast({ title: t('systemNotificationsBlocked'), description: t('enableSystemNotificationsDescription') as string });
      return;
    }
    if (Notification.permission === 'granted') { setSystemNotificationPermission('granted'); return; }
    if (Notification.permission === 'denied') {
      setSystemNotificationPermission('denied');
      toast({ title: t('systemNotificationsBlocked'), description: t('enableSystemNotificationsDescription') as string, duration: 7000 });
      return;
    }
    try {
      const permissionResult = await Notification.requestPermission();
      setSystemNotificationPermission(permissionResult);
      if (permissionResult === 'granted') {
        toast({ title: t('systemNotificationsEnabled'), description: t('systemNotificationsNowActive') as string });
        showSystemNotification(t('systemNotificationsEnabled') as string, t('systemNotificationsNowActive') as string);
      } else if (permissionResult === 'denied') {
        toast({ title: t('systemNotificationsBlocked'), description: t('systemNotificationsUserDenied') as string });
      } else {
         toast({ title: t('systemNotificationsNotYetEnabled') as string, description: t('systemNotificationsDismissed') as string });
      }
    } catch (err) { setSystemNotificationPermission(Notification.permission); }
  }, [t, toast, showSystemNotification]);

  const logout = useCallback(() => {
    addHistoryLogEntry('historyLogLogout', undefined, 'account');
    setIsAuthenticatedState(false);
    setLoginAttemptsState(0);
    setLockoutEndTimeState(null);
    setSessionExpiryTimestampState(null);
    setHistoryLog([]); // Clear client-side history log on logout
    setIsAppLocked(false);
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'RESET_TIMER', payload: { locale } });
    }
    if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);
        localStorage.removeItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS);
        localStorage.removeItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME);
        localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY);
        sessionStorage.removeItem(SESSION_STORAGE_KEY_HISTORY_LOG);
    }
    if (logoutChannel) logoutChannel.postMessage('logout_event');
  }, [addHistoryLogEntry, locale]);

 useEffect(() => {
    setIsLoading(true); // Overall loading
    setIsCategoriesLoading(true);
    setIsAssigneesLoading(true);
    setIsHistoryLoading(true);
    let initialAuth = false;

    const fetchInitialData = async () => {
      try {
        // Fetch Categories
        const catResponse = await fetch(`${API_BASE_URL}/categories`);
        if (!catResponse.ok) throw new Error(`Failed to fetch categories: ${catResponse.status} ${catResponse.statusText}`);
        const backendCategories: BackendCategory[] = await catResponse.json();
        setAllCategories(backendCategories.map(backendToFrontendCategory));
      } catch (err) {
        createApiErrorToast(err, toast, "Error Loading Categories", "loading");
        setError(prev => prev ? `${prev} Categories failed. ` : "Categories failed. ");
        setAllCategories([]);
      } finally {
        setIsCategoriesLoading(false);
      }

      try {
        // Fetch Assignees (Users)
        const userResponse = await fetch(`${API_BASE_URL}/users`);
        if (!userResponse.ok) throw new Error(`Failed to fetch users: ${userResponse.status} ${userResponse.statusText}`);
        const backendUsers: BackendUser[] = await userResponse.json();
        setAllAssignees(backendUsers.map(backendToFrontendAssignee));
      } catch (err) {
        createApiErrorToast(err, toast, "Error Loading Assignees", "loading");
        setError(prev => prev ? `${prev} Assignees failed. ` : "Assignees failed. ");
        setAllAssignees([]);
      } finally {
        setIsAssigneesLoading(false);
      }
      
      try {
        // Load Activities (from localStorage, as no GET /activities endpoint)
        const storedPersonalActivities = localStorage.getItem(LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES);
        if (storedPersonalActivities) setPersonalActivities(JSON.parse(storedPersonalActivities));
        const storedWorkActivities = localStorage.getItem(LOCAL_STORAGE_KEY_WORK_ACTIVITIES);
        if (storedWorkActivities) setWorkActivities(JSON.parse(storedWorkActivities));
      } catch (e) {
        console.error("[AppProvider] Failed to parse activities from localStorage.", e);
        setError(prev => prev ? `${prev} Local activities failed. ` : "Local activities failed. ");
      }


      // Load other local storage items (auth, settings, etc.)
      const storedAppMode = localStorage.getItem(LOCAL_STORAGE_KEY_APP_MODE) as AppMode | null;
      if (storedAppMode && (storedAppMode === 'personal' || storedAppMode === 'work')) setAppModeState(storedAppMode);
      const storedAuth = localStorage.getItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);
      const storedExpiry = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY);
      if (storedAuth === 'true' && storedExpiry) {
          const expiryTime = parseInt(storedExpiry, 10);
          if (Date.now() > expiryTime) { initialAuth = false; logout(); }
          else { initialAuth = true; setSessionExpiryTimestampState(expiryTime); }
      }
      setIsAuthenticatedState(initialAuth);

      if (initialAuth) {
        try {
          const historyResponse = await fetch(`${API_BASE_URL}/history`);
          if (!historyResponse.ok) throw new Error(`Failed to fetch history: ${historyResponse.status} ${historyResponse.statusText}`);
          const backendHistoryItems: BackendHistory[] = await historyResponse.json();
          setHistoryLog(backendHistoryItems.map(backendToFrontendHistory));
        } catch (err) {
          createApiErrorToast(err, toast, "Error Loading History", "loading");
          setError(prev => prev ? `${prev} History failed. ` : "History failed. ");
          setHistoryLog([]); // Fallback to empty or try session storage if needed
        } finally {
          setIsHistoryLoading(false);
        }
        const storedPin = localStorage.getItem(LOCAL_STORAGE_KEY_APP_PIN);
        if (storedPin) setAppPinState(storedPin);
        else if (HARDCODED_APP_PIN) setAppPinState(HARDCODED_APP_PIN);
      } else {
        setIsHistoryLoading(false); // No auth, no history to load from backend
      }

      const storedAttempts = localStorage.getItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS);
      setLoginAttemptsState(storedAttempts ? parseInt(storedAttempts, 10) : 0);
      const storedLockoutTime = localStorage.getItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME);
      setLockoutEndTimeState(storedLockoutTime ? parseInt(storedLockoutTime, 10) : null);
      const storedUINotifications = localStorage.getItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS);
      if (storedUINotifications) setUINotifications(JSON.parse(storedUINotifications));
      if (typeof window !== 'undefined' && 'Notification' in window) setSystemNotificationPermission(Notification.permission);

      setIsLoading(false); // Overall loading finished
    };

    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (!isLoading) { // Persist activities to localStorage as primary display source
      localStorage.setItem(LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES, JSON.stringify(personalActivities));
    }
  }, [personalActivities, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(LOCAL_STORAGE_KEY_WORK_ACTIVITIES, JSON.stringify(workActivities));
    }
  }, [workActivities, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(LOCAL_STORAGE_KEY_APP_MODE, appModeState);
      const root = document.documentElement;
      root.classList.remove('mode-personal', 'mode-work');
      root.classList.add(appModeState === 'work' ? 'mode-work' : 'mode-personal');
    }
  }, [appModeState, isLoading]);

  // Other useEffects for localStorage (auth, login attempts, etc.) remain similar
  useEffect(() => { if (!isLoading) { if (isAuthenticated) localStorage.setItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED, 'true'); else localStorage.removeItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);}}, [isAuthenticated, isLoading]);
  useEffect(() => { if (!isLoading) localStorage.setItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS, String(loginAttempts));}, [loginAttempts, isLoading]);
  useEffect(() => { if (!isLoading) { if (lockoutEndTime === null) localStorage.removeItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME); else localStorage.setItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME, String(lockoutEndTime));}}, [lockoutEndTime, isLoading]);
  useEffect(() => { if (!isLoading) { if (sessionExpiryTimestamp === null) localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY); else localStorage.setItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY, String(sessionExpiryTimestamp));}}, [sessionExpiryTimestamp, isLoading]);
  useEffect(() => { if(!isLoading) localStorage.setItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS, JSON.stringify(uiNotifications));}, [uiNotifications, isLoading]);
  // History log is primarily from backend if authenticated, or sessionStorage for client-side only actions
  // useEffect(() => { if (!isLoading && isAuthenticated) { /* sessionStorage.setItem(SESSION_STORAGE_KEY_HISTORY_LOG, JSON.stringify(historyLog)); */ }}, [historyLog, isLoading, isAuthenticated]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const intervalId = setInterval(() => {
      const now = new Date();
      const today = getStartOfDayUtil(now);
      const currentDayOfMonthFromNow = now.getDate();
      if (lastNotificationCheckDay !== null && lastNotificationCheckDay !== currentDayOfMonthFromNow) setNotifiedToday(new Set());
      setLastNotificationCheckDay(currentDayOfMonthFromNow);
      const activitiesToScan = appModeState === 'work' ? workActivities : personalActivities;
      activitiesToScan.forEach(masterActivity => {
        const activityTitle = masterActivity.title;
        const masterId = masterActivity.id;
        if (masterActivity.time) {
          const todayInstances = generateFutureInstancesForNotifications(masterActivity, today, dateFnsEndOfDay(today));
          todayInstances.forEach(instance => {
            const occurrenceDateKey = formatISO(instance.instanceDate, { representation: 'date' });
            const notificationKey5Min = `${masterId}:${occurrenceDateKey}:5min_soon`;
            const isInstanceCompleted = !!masterActivity.completedOccurrences?.[occurrenceDateKey];
            if (!isInstanceCompleted && !notifiedToday.has(notificationKey5Min)) {
              const [hours, minutes] = masterActivity.time!.split(':').map(Number);
              const activityDateTime = new Date(instance.instanceDate);
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
        if (masterActivity.recurrence && masterActivity.recurrence.type !== 'none') {
          const recurrenceType = masterActivity.recurrence.type;
          const futureCheckEndDate = addDays(today, 8);
          const upcomingInstances = generateFutureInstancesForNotifications(masterActivity, addDays(today,1), futureCheckEndDate);
          upcomingInstances.forEach(instance => {
            const instanceDateKey = formatISO(instance.instanceDate, { representation: 'date' });
            const isOccurrenceCompleted = !!masterActivity.completedOccurrences?.[instanceDateKey];
            if(isOccurrenceCompleted) return;
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
            const oneDayBeforeInstance = dateFnsStartOfDay(subDays(instance.instanceDate, 1));
            const twoDaysBeforeInstance = dateFnsStartOfDay(subDays(instance.instanceDate, 2));
            const oneWeekBeforeInstance = dateFnsStartOfDay(subWeeks(instance.instanceDate, 1));
            if (recurrenceType === 'weekly') { if (isSameDay(today, oneDayBeforeInstance)) notify('1day_weekly', 'toastActivityTomorrowTitle', 'toastActivityTomorrowDescription', { activityTitle });}
            else if (recurrenceType === 'monthly') {
              if (isSameDay(today, oneWeekBeforeInstance)) notify('1week_monthly', 'toastActivityInOneWeekTitle', 'toastActivityInOneWeekDescription', { activityTitle });
              if (isSameDay(today, twoDaysBeforeInstance)) notify('2days_monthly', 'toastActivityInTwoDaysTitle', 'toastActivityInTwoDaysDescription', { activityTitle });
              if (isSameDay(today, oneDayBeforeInstance)) notify('1day_monthly', 'toastActivityTomorrowTitle', 'toastActivityTomorrowDescription', { activityTitle });
            }
          });
        }
      });
    }, 60000);
    return () => clearInterval(intervalId);
  }, [personalActivities, workActivities, appModeState, isLoading, isAuthenticated, toast, t, lastNotificationCheckDay, notifiedToday, stableAddUINotification, dateFnsLocale, showSystemNotification, locale]);

  useEffect(() => {
    if (!logoutChannel) return;
    const handleLogoutMessage = (event: MessageEvent) => { if (event.data === 'logout_event' && isAuthenticated) logout();};
    logoutChannel.addEventListener('message', handleLogoutMessage);
    return () => { if (logoutChannel) logoutChannel.removeEventListener('message', handleLogoutMessage);};
  }, [isAuthenticated, logout]);

  const postToServiceWorker = useCallback((message: any) => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({...message, payload: { ...message.payload, locale } });
    } else {
      if (message.type !== 'GET_INITIAL_STATE' && !isPomodoroReady) {
        toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: t('pomodoroSWNotReady') as string });
      }
    }
  }, [locale, t, toast, isPomodoroReady]);

  const handleSWMessage = useCallback((event: MessageEvent) => {
        if (event.data && event.data.type) {
            if (event.data.type === 'TIMER_STATE') {
                const { phase, timeRemaining, isRunning, cyclesCompleted } = event.data.payload;
                setPomodoroPhase(phase); setPomodoroTimeRemaining(timeRemaining); setPomodoroIsRunning(isRunning); setPomodoroCyclesCompleted(cyclesCompleted);
                if (!isPomodoroReady) setIsPomodoroReady(true);
            } else if (event.data.type === 'SW_ERROR') {
                toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: `Service Worker: ${event.data.payload.message || 'Unknown SW Error'}`});
            }
        }
    }, [isPomodoroReady, toast, t]);

  useEffect(() => {
    const registerAndInitializeSW = async () => {
        try {
            await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;
            if (navigator.serviceWorker.controller) setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
        } catch (error) { setIsPomodoroReady(false); toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: `SW Reg Error: ${error instanceof Error ? error.message : String(error)}`});}
    };
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', handleSWMessage);
        const handleControllerChange = () => { if (navigator.serviceWorker.controller) setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200); else setIsPomodoroReady(false);};
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
        if (document.readyState === 'complete') registerAndInitializeSW(); else window.addEventListener('load', registerAndInitializeSW, { once: true });
        if (navigator.serviceWorker.controller) setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
    } else { setIsPomodoroReady(false); }
    return () => { if (typeof window !== 'undefined' && 'serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', handleSWMessage);};
  }, [locale, postToServiceWorker, handleSWMessage, t, toast]);

  useEffect(() => {
    if (isPomodoroReady && prevPomodoroPhaseRef.current !== pomodoroPhase && prevPomodoroPhaseRef.current !== 'off') {
        const phaseThatEnded = prevPomodoroPhaseRef.current;
        let titleKey: keyof Translations = 'pomodoroWorkSessionEnded';
        let descriptionKey: keyof Translations = 'pomodoroFocusOnTask';
        if (phaseThatEnded === 'work') { titleKey = 'pomodoroWorkSessionEnded'; descriptionKey = (pomodoroCyclesCompleted > 0 && pomodoroCyclesCompleted % POMODORO_CYCLES_BEFORE_LONG_BREAK === 0) ? 'pomodoroTakeALongBreak' : 'pomodoroTakeAShortBreak';}
        else if (phaseThatEnded === 'shortBreak') { titleKey = 'pomodoroShortBreakEnded'; descriptionKey = 'pomodoroBackToWork';}
        else if (phaseThatEnded === 'longBreak') { titleKey = 'pomodoroLongBreakEnded'; descriptionKey = 'pomodoroBackToWork';}
        const title = t(titleKey as any); const description = t(descriptionKey as any);
        if (title && description) { stableAddUINotification({ title, description, activityId: `pomodoro_cycle_${pomodoroCyclesCompleted}_${phaseThatEnded}` }); toast({ title, description });}
    }
    prevPomodoroPhaseRef.current = pomodoroPhase;
  }, [pomodoroPhase, pomodoroCyclesCompleted, isPomodoroReady, stableAddUINotification, t, toast]);

  const startPomodoroWork = useCallback(() => postToServiceWorker({ type: 'START_WORK', payload: { locale, cyclesCompleted: 0 } }), [postToServiceWorker, locale]);
  const startPomodoroShortBreak = useCallback(() => postToServiceWorker({ type: 'START_SHORT_BREAK', payload: { locale } }), [postToServiceWorker, locale]);
  const startPomodoroLongBreak = useCallback(() => postToServiceWorker({ type: 'START_LONG_BREAK', payload: { locale } }), [postToServiceWorker, locale]);
  const pausePomodoro = useCallback(() => postToServiceWorker({ type: 'PAUSE_TIMER', payload: { locale } }), [postToServiceWorker, locale]);
  const resumePomodoro = useCallback(() => postToServiceWorker({ type: 'RESUME_TIMER', payload: { locale } }), [postToServiceWorker, locale]);
  const resetPomodoro = useCallback(() => { setIsPomodoroReady(false); postToServiceWorker({ type: 'RESET_TIMER', payload: { locale } });}, [postToServiceWorker, locale]);
  const setAppMode = useCallback((mode: AppMode) => { if (mode !== appModeState) addHistoryLogEntry(mode === 'personal' ? 'historyLogSwitchToPersonalMode' : 'historyLogSwitchToWorkMode', undefined, 'account'); setAppModeState(mode);}, [appModeState, addHistoryLogEntry]);
  const setIsAuthenticated = useCallback((value: boolean, rememberMe: boolean = false) => {
    const wasAuthenticated = isAuthenticated; setIsAuthenticatedState(value);
    if (value && !wasAuthenticated) {
        addHistoryLogEntry('historyLogLogin', undefined, 'account');
        if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_STORAGE_KEY_HISTORY_LOG);
        setHistoryLog([]);
        const title = t('loginSuccessNotificationTitle'); const description = t('loginSuccessNotificationDescription');
        stableAddUINotification({ title, description }); showSystemNotification(title, description);
    }
    if (value) { const newExpiryTimestamp = Date.now() + (rememberMe ? SESSION_DURATION_30_DAYS_MS : SESSION_DURATION_24_HOURS_MS); setSessionExpiryTimestampState(newExpiryTimestamp);}
    else setSessionExpiryTimestampState(null);
  }, [isAuthenticated, addHistoryLogEntry, t, stableAddUINotification, showSystemNotification]);

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
    } catch (err) { createApiErrorToast(err, toast, "Error Adding Category", "adding"); setError((err as Error).message); throw err; }
  }, [toast, t, addHistoryLogEntry]);

  const updateCategory = useCallback(async (categoryId: number, updates: Partial<Omit<Category, 'id' | 'icon'>>, oldCategoryData?: Category) => {
    setError(null);
    const payload: Partial<BackendCategoryCreatePayload> = {};
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
    } catch (err) { createApiErrorToast(err, toast, "Error Updating Category", "updating"); setError((err as Error).message); throw err; }
  }, [toast, t, addHistoryLogEntry]);

  const deleteCategory = useCallback(async (categoryId: number) => {
    setError(null);
    const categoryToDelete = allCategories.find(cat => cat.id === categoryId);
    if (!categoryToDelete) return;
    try {
      const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to delete category: HTTP ${response.status}`);}
      setAllCategories(prev => prev.filter(cat => cat.id !== categoryId));
      toast({ title: t('toastCategoryDeletedTitle'), description: t('toastCategoryDeletedDescription', { categoryName: categoryToDelete.name }) });
      addHistoryLogEntry('historyLogDeleteCategory', { name: categoryToDelete.name, mode: categoryToDelete.mode as string }, 'category');
    } catch (err) { createApiErrorToast(err, toast, "Error Deleting Category", "deleting"); setError((err as Error).message); throw err; }
  }, [allCategories, toast, t, addHistoryLogEntry]);

  // --- Assignee (User) API Methods ---
  const addAssignee = useCallback(async (name: string, username?: string, password?: string) => {
    setError(null);
    const finalUsername = username || name.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 1000);
    const finalPassword = password || "P@ssword123"; // Placeholder
    const payload: BackendUserCreatePayload = { name, username: finalUsername, password: finalPassword };
    try {
      const response = await fetch(`${API_BASE_URL}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to add assignee: HTTP ${response.status}`);}
      const newBackendUser: BackendUser = await response.json();
      setAllAssignees(prev => [...prev, backendToFrontendAssignee(newBackendUser)]);
      toast({ title: t('toastAssigneeAddedTitle'), description: t('toastAssigneeAddedDescription', { assigneeName: name }) });
      addHistoryLogEntry('historyLogAddAssignee', { name }, 'assignee');
    } catch (err) { createApiErrorToast(err, toast, "Error Adding Assignee", "adding"); setError((err as Error).message); throw err; }
  }, [toast, t, addHistoryLogEntry]);

  const updateAssignee = useCallback(async (assigneeId: number, updates: Partial<Omit<Assignee, 'id'>>) => {
    setError(null);
    const currentAssignee = assignees.find(a => a.id === assigneeId);
    // Backend PUT /users requires name, username, password as Form data.
    // This is a mismatch with frontend's partial JSON update intention.
    // For now, sending only name if provided. This might require backend adjustment.
    const payload: BackendUserUpdatePayload = { name: updates.name };
    // If you need to update username/password, the frontend form and this payload need to be more complex.
    // And use FormData for the request.
    try {
      // Simulating JSON PUT, which might fail if backend strictly expects Form.
      const response = await fetch(`${API_BASE_URL}/users/${assigneeId}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' }, // Sending as JSON
         body: JSON.stringify(payload)
      });
      // If using FormData:
      // const formData = new FormData();
      // if (updates.name) formData.append('name', updates.name);
      // if (currentAssignee?.username) formData.append('username', currentAssignee.username); // Or new username
      // formData.append('password', 'newPlaceholderPassword'); // Required by backend Form
      // const response = await fetch(`${API_BASE_URL}/users/${assigneeId}`, { method: 'PUT', body: formData });

      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to update assignee: HTTP ${response.status}`);}
      const updatedBackendUser: BackendUser = await response.json();
      setAllAssignees(prev => prev.map(asg => (asg.id === assigneeId ? backendToFrontendAssignee(updatedBackendUser) : asg)));
      toast({ title: t('toastAssigneeUpdatedTitle'), description: t('toastAssigneeUpdatedDescription', { assigneeName: updatedBackendUser.name }) });
      addHistoryLogEntry('historyLogUpdateAssignee', { name: updatedBackendUser.name, oldName: currentAssignee?.name !== updatedBackendUser.name ? currentAssignee?.name : undefined }, 'assignee');
    } catch (err) { createApiErrorToast(err, toast, "Error Updating Assignee", "updating"); setError((err as Error).message); throw err; }
  }, [assignees, toast, t, addHistoryLogEntry]);

  const deleteAssignee = useCallback(async (assigneeId: number) => {
    setError(null);
    const assigneeToDelete = assignees.find(asg => asg.id === assigneeId);
    if (!assigneeToDelete) return;
    try {
      const response = await fetch(`${API_BASE_URL}/users/${assigneeId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to delete assignee: HTTP ${response.status}`);}
      setAllAssignees(prev => prev.filter(asg => asg.id !== assigneeId));
      // Also remove from activities' responsiblePersonIds (client-side update)
      setPersonalActivities(prevActs => prevActs.map(act => ({ ...act, responsiblePersonIds: act.responsiblePersonIds?.filter(id => id !== assigneeId) })));
      setWorkActivities(prevActs => prevActs.map(act => ({ ...act, responsiblePersonIds: act.responsiblePersonIds?.filter(id => id !== assigneeId) })));
      toast({ title: t('toastAssigneeDeletedTitle'), description: t('toastAssigneeDeletedDescription', { assigneeName: assigneeToDelete.name }) });
      addHistoryLogEntry('historyLogDeleteAssignee', { name: assigneeToDelete.name }, 'assignee');
    } catch (err) { createApiErrorToast(err, toast, "Error Deleting Assignee", "deleting"); setError((err as Error).message); throw err; }
  }, [assignees, toast, t, addHistoryLogEntry]);


  // --- Activity API Methods (using localStorage as primary source for GETs) ---
  const addActivity = useCallback(async (
      activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'completedAt' | 'notes' | 'recurrence' | 'completedOccurrences' | 'responsiblePersonIds' | 'categoryId' | 'appMode' | 'masterActivityId' | 'isRecurringInstance' | 'originalInstanceDate'> & {
        todos?: Omit<Todo, 'id' | 'completed'>[]; time?: string; notes?: string; recurrence?: RecurrenceRule | null; responsiblePersonIds?: number[]; categoryId: number; appMode: AppMode;
      }, customCreatedAt?: number
    ) => {
    setError(null);
    const frontendActivityShell: Activity = {
      // Temporary ID for optimistic update, will be replaced by backend ID
      // However, since we're using localStorage as primary GET, we might just keep client ID.
      // For now, let's assume backend ID becomes the source of truth if call succeeds.
      id: Date.now(), // Placeholder, will be replaced by backend
      title: activityData.title,
      categoryId: activityData.categoryId,
      todos: (activityData.todos || []).map(t => ({ ...t, id: Date.now() + Math.random(), completed: false })), // Placeholder IDs
      createdAt: customCreatedAt !== undefined ? customCreatedAt : Date.now(),
      time: activityData.time,
      notes: activityData.notes,
      recurrence: activityData.recurrence,
      responsiblePersonIds: activityData.responsiblePersonIds,
      appMode: activityData.appMode,
      completedOccurrences: {},
    };

    const payload = frontendToBackendActivityPayload(frontendActivityShell) as BackendActivityCreatePayload;

    try {
      const response = await fetch(`${API_BASE_URL}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to add activity: HTTP ${response.status}`);}
      const newBackendActivity: BackendActivity = await response.json();
      const newFrontendActivity = backendToFrontendActivity(newBackendActivity, appModeState);
      
      currentActivitySetter(prev => [...prev, newFrontendActivity]); // Add to localStorage-backed state
      toast({ title: t('toastActivityAddedTitle'), description: t('toastActivityAddedDescription') });
      addHistoryLogEntry(appModeState === 'personal' ? 'historyLogAddActivityPersonal' : 'historyLogAddActivityWork', { title: newFrontendActivity.title }, appModeState);
    } catch (err) { createApiErrorToast(err, toast, "Error Adding Activity", "adding"); setError((err as Error).message); throw err; }
  }, [currentActivitySetter, appModeState, toast, t, addHistoryLogEntry]);

  const updateActivity = useCallback(async (activityId: number, updates: Partial<Omit<Activity, 'id'>>, originalActivity?: Activity) => {
    setError(null);
    const activityToUpdate = (appModeState === 'work' ? workActivities : personalActivities).find(a => a.id === activityId);
    if (!activityToUpdate) {
      console.error("Activity not found for update:", activityId);
      toast({variant: "destructive", title: "Error", description: "Activity not found for update."});
      return;
    }

    // Merge updates with existing activity to form a complete frontend shell
    const updatedFrontendShell: Activity = { ...activityToUpdate, ...updates };
    const payload = frontendToBackendActivityPayload(updatedFrontendShell, true) as BackendActivityUpdatePayload;

    try {
      const response = await fetch(`${API_BASE_URL}/activities/${activityId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to update activity: HTTP ${response.status}`);}
      const updatedBackendActivity: BackendActivity = await response.json();
      const finalFrontendActivity = backendToFrontendActivity(updatedBackendActivity, appModeState);

      // Client-side only properties need to be preserved if not part of backend response
      finalFrontendActivity.completedOccurrences = activityToUpdate.completedOccurrences;
      if (updates.completedOccurrences) finalFrontendActivity.completedOccurrences = updates.completedOccurrences;
      if (updates.completed !== undefined) finalFrontendActivity.completed = updates.completed;
      if (updates.completedAt !== undefined) finalFrontendActivity.completedAt = updates.completedAt;


      currentActivitySetter(prev => prev.map(act => (act.id === activityId ? finalFrontendActivity : act)));
      toast({ title: t('toastActivityUpdatedTitle'), description: t('toastActivityUpdatedDescription') });
      addHistoryLogEntry(appModeState === 'personal' ? 'historyLogUpdateActivityPersonal' : 'historyLogUpdateActivityWork', { title: finalFrontendActivity.title }, appModeState);
    } catch (err) { createApiErrorToast(err, toast, "Error Updating Activity", "updating"); setError((err as Error).message); throw err; }
  }, [currentActivitySetter, appModeState, personalActivities, workActivities, toast, t, addHistoryLogEntry]);

  const deleteActivity = useCallback(async (activityId: number) => {
    setError(null);
    const activityToDelete = (appModeState === 'work' ? workActivities : personalActivities).find(a => a.id === activityId);
    if (!activityToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/activities/${activityId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(errorData.detail || `Failed to delete activity: HTTP ${response.status}`);}
      currentActivitySetter(prev => prev.filter(act => act.id !== activityId));
      toast({ title: t('toastActivityDeletedTitle'), description: t('toastActivityDeletedDescription', { activityTitle: activityToDelete.title }) });
      addHistoryLogEntry(appModeState === 'personal' ? 'historyLogDeleteActivityPersonal' : 'historyLogDeleteActivityWork', { title: activityToDelete.title }, appModeState);
    } catch (err) { createApiErrorToast(err, toast, "Error Deleting Activity", "deleting"); setError((err as Error).message); throw err; }
  }, [currentActivitySetter, appModeState, personalActivities, workActivities, toast, t, addHistoryLogEntry]);


  // Todo operations remain largely client-side, but should mark activity as 'dirty' for potential sync
  const addTodoToActivity = useCallback((activityId: number, todoText: string) => {
    const newTodo: Todo = { id: Date.now() + Math.random(), text: todoText, completed: false };
    currentActivitySetter(prev =>
      prev.map(act =>
        act.id === activityId ? { ...act, todos: [...act.todos, newTodo] } : act
      )
    );
    // Consider triggering updateActivity if backend supports full todo list updates
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
    let activityTitleForLog = 'Unknown Activity';
    const masterActivity = getRawActivities().find(act => act.id === masterActivityId);
    if (masterActivity) activityTitleForLog = masterActivity.title;
    const occurrenceDateKey = formatDateFns(new Date(occurrenceDateTimestamp), 'yyyy-MM-dd'); // Use date-fns format
    currentActivitySetter(prevActivities =>
      prevActivities.map(act => {
        if (act.id === masterActivityId) {
          const updatedOccurrences = { ...act.completedOccurrences };
          if (completedState) updatedOccurrences[occurrenceDateKey] = true;
          else delete updatedOccurrences[occurrenceDateKey];
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

  const combinedIsLoading = isLoading || isCategoriesLoading || isAssigneesLoading || (isAuthenticated && isHistoryLoading);

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
