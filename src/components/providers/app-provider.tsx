
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

const API_BASE_URL = 'https://afaire.is-cool.dev/api';

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
  addTodoToActivity: (activityId: number, todoText: string) => Promise<void>;
  updateTodoInActivity: (activityId: number, todoId: number, updates: Partial<Todo>) => void; // IDs are numbers
  deleteTodoFromActivity: (activityId: number, todoId: number) => Promise<void>; // IDs are numbers
  getCategoryById: (categoryId: number) => Category | undefined;
  addCategory: (name: string, iconName: string, mode: AppMode | 'all') => Promise<void>;
  updateCategory: (categoryId: number, updates: Partial<Omit<Category, 'id' | 'icon'>>, oldCategoryData?: Category) => Promise<void>;
  deleteCategory: (categoryId: number) => Promise<void>;
  addAssignee: (name: string, username?: string, password?: string) => Promise<void>;
  updateAssignee: (assigneeId: number, updates: Partial<Pick<Assignee, 'name' | 'username'>>) => Promise<void>;
  deleteAssignee: (assigneeId: number) => Promise<void>;
  getAssigneeById: (assigneeId: number) => Assignee | undefined;
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

const LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES = 'todoFlowPersonalActivities_v3_api_backend_driven';
const LOCAL_STORAGE_KEY_WORK_ACTIVITIES = 'todoFlowWorkActivities_v3_api_backend_driven';
const LOCAL_STORAGE_KEY_APP_MODE = 'todoFlowAppMode';
const LOCAL_STORAGE_KEY_IS_AUTHENTICATED = 'todoFlowIsAuthenticated';
const LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS = 'todoFlowLoginAttempts';
const LOCAL_STORAGE_KEY_LOCKOUT_END_TIME = 'todoFlowLockoutEndTime';
const LOCAL_STORAGE_KEY_SESSION_EXPIRY = 'todoFlowSessionExpiry';
const LOCAL_STORAGE_KEY_UI_NOTIFICATIONS = 'todoFlowUINotifications_v1';
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

const backendToFrontendCategory = (backendCat: BackendCategory): Category => ({
  id: backendCat.id,
  name: backendCat.name,
  iconName: backendCat.icon_name,
  icon: getIconComponent(backendCat.icon_name || 'Package'),
  mode: backendCat.mode === 'both' ? 'all' : backendCat.mode,
});

const frontendToBackendCategoryMode = (frontendMode: AppMode | 'all'): BackendCategoryMode => {
  if (frontendMode === 'all') return 'both';
  return frontendMode;
};

const backendToFrontendAssignee = (backendUser: BackendUser): Assignee => ({
  id: backendUser.id,
  name: backendUser.name,
  username: backendUser.username,
});

const backendToFrontendActivity = (backendActivity: BackendActivity | null | undefined, currentAppMode: AppMode): Activity => {
  if (!backendActivity || typeof backendActivity !== 'object') {
    console.error(`[AppProvider] CRITICAL: backendToFrontendActivity received invalid backendActivity object. Received:`, typeof backendActivity === 'object' ? JSON.stringify(backendActivity) : backendActivity);
    return {
      id: Date.now() + Math.random(),
      title: 'Error: Invalid Activity Data from Backend',
      categoryId: 0,
      todos: [],
      createdAt: Date.now(),
      appMode: currentAppMode,
      completedOccurrences: {},
    };
  }

  let daysOfWeekArray: number[] = [];
  if (backendActivity.days_of_week && typeof backendActivity.days_of_week === 'string') {
    daysOfWeekArray = backendActivity.days_of_week.split(',').map(dayStr => parseInt(dayStr.trim(), 10)).filter(num => !isNaN(num));
  } else if (Array.isArray(backendActivity.days_of_week)) {
    daysOfWeekArray = backendActivity.days_of_week.map(dayStr => parseInt(String(dayStr).trim(), 10)).filter(num => !isNaN(num));
  }

  const recurrenceRule: RecurrenceRule = {
    type: backendActivity.repeat_mode as RecurrenceType,
    endDate: backendActivity.end_date ? parseISO(backendActivity.end_date).getTime() : null,
    daysOfWeek: daysOfWeekArray,
    dayOfMonth: backendActivity.day_of_month ?? undefined,
  };

  let createdAtTimestamp: number;
  const activityIdForLog = (backendActivity && typeof backendActivity.id === 'number')
    ? backendActivity.id
    : 'ID_MISSING_OR_INVALID_IN_BACKEND_RESPONSE';
  const startDateFromBackend = backendActivity ? backendActivity.start_date : undefined;

  if (typeof startDateFromBackend === 'string' && startDateFromBackend.trim() !== '') {
    try {
      createdAtTimestamp = parseISO(startDateFromBackend).getTime();
      if (isNaN(createdAtTimestamp)) throw new Error("Parsed timestamp is NaN");
    } catch (e) {
      console.warn(`[AppProvider] Warning: Failed to parse start_date "${startDateFromBackend}" from backend for activity ID ${activityIdForLog}. Error:`, e instanceof Error ? e.message : String(e), ". Using fallback createdAt to Date.now().");
      createdAtTimestamp = Date.now(); // Fallback
    }
  } else {
    console.warn(`[AppProvider] Warning: backendActivity.start_date is missing, null, or invalid in response for activity ID ${activityIdForLog}:`, startDateFromBackend === undefined ? 'FIELD_MISSING' : startDateFromBackend, ". Using fallback createdAt to Date.now().");
    createdAtTimestamp = Date.now(); // Fallback
  }
  
  const todos: Todo[] = (backendActivity && Array.isArray(backendActivity.todos))
    ? backendActivity.todos.map((bt: BackendTodo) => ({
        id: typeof bt?.id === 'number' ? bt.id : Date.now() + Math.random(),
        text: bt?.text || 'Untitled Todo from Backend',
        completed: false, // Initialize all backend todos as not completed
      }))
    : [];

  if (!(backendActivity && Array.isArray(backendActivity.todos))) {
     console.warn(`[AppProvider] Warning: backendActivity.todos is missing or not an array for activity ID ${activityIdForLog}. Defaulting to empty array. Received:`, backendActivity ? backendActivity.todos : 'backendActivity_is_undefined_or_null');
  }
  if (backendActivity && Array.isArray(backendActivity.todos)) {
      backendActivity.todos.forEach((bt, index) => {
          if (typeof bt?.id !== 'number') {
              console.warn(`[AppProvider] Warning: Todo at index ${index} for activity ID ${activityIdForLog} is missing 'id'.`);
          }
          if (typeof bt?.text !== 'string') {
              console.warn(`[AppProvider] Warning: Todo at index ${index} for activity ID ${activityIdForLog} is missing 'text'.`);
          }
      });
  }
  
 const responsiblePersonIds = (backendActivity && Array.isArray(backendActivity.responsibles))
    ? backendActivity.responsibles.map(r => r.id)
    : [];
  if (!(backendActivity && Array.isArray(backendActivity.responsibles))) {
    console.warn(`[AppProvider] Warning: backendActivity.responsibles is missing or not an array for activity ID ${activityIdForLog}. Defaulting to empty array. Received:`, backendActivity ? (typeof backendActivity.responsibles === 'object' ? JSON.stringify(backendActivity.responsibles) : backendActivity.responsibles) : 'FIELD_MISSING');
  }


  const idToUse = typeof backendActivity?.id === 'number' ? backendActivity.id : Date.now() + Math.random();
  if (typeof backendActivity?.id !== 'number') {
      console.error(`[AppProvider] CRITICAL: Backend activity response did not contain a valid 'id'. Using fallback ID ${idToUse}. Received:`, typeof backendActivity === 'object' ? JSON.stringify(backendActivity) : backendActivity);
  }

  return {
    id: idToUse,
    title: backendActivity?.title || 'Untitled Activity',
    categoryId: typeof backendActivity?.category_id === 'number' ? backendActivity.category_id : 0,
    todos: todos,
    createdAt: createdAtTimestamp,
    time: backendActivity?.time || "00:00",
    notes: backendActivity?.notes ?? undefined,
    recurrence: recurrenceRule.type === 'none' ? { type: 'none' } : recurrenceRule,
    completedOccurrences: {},
    responsiblePersonIds: responsiblePersonIds,
    appMode: (backendActivity?.mode === 'both' ? currentAppMode : (backendActivity?.mode || currentAppMode)) as AppMode,
  };
};

const frontendToBackendActivityPayload = (
  activity: Omit<Activity, 'id' | 'todos' | 'completedOccurrences' | 'isRecurringInstance' | 'originalInstanceDate' | 'masterActivityId'> & { todos?: Omit<Todo, 'id' | 'completed'>[] },
  isUpdate: boolean = false
): BackendActivityCreatePayload | BackendActivityUpdatePayload => {
  const payload: Partial<BackendActivityCreatePayload & BackendActivityUpdatePayload> = {
    title: activity.title,
    start_date: new Date(activity.createdAt).toISOString(),
    time: activity.time || "00:00",
    category_id: activity.categoryId,
    notes: activity.notes,
    mode: activity.appMode === 'all' ? 'both' : activity.appMode,
    responsible_ids: activity.responsiblePersonIds || [],
  };

  if (activity.recurrence && activity.recurrence.type !== 'none') {
    payload.repeat_mode = activity.recurrence.type as BackendRepeatMode;
    payload.end_date = activity.recurrence.endDate ? new Date(activity.recurrence.endDate).toISOString() : null;
    payload.days_of_week = activity.recurrence.type === 'weekly' ? (activity.recurrence.daysOfWeek || []).map(String) : null;
    payload.day_of_month = activity.recurrence.type === 'monthly' ? (activity.recurrence.dayOfMonth ?? null) : null;
  } else {
    payload.repeat_mode = 'none';
    payload.end_date = null;
    payload.days_of_week = null;
    payload.day_of_month = null;
  }


  if (!isUpdate && activity.todos) {
    (payload as BackendActivityCreatePayload).todos = activity.todos.map(t => ({ text: t.text }));
  }

  return payload as BackendActivityCreatePayload | BackendActivityUpdatePayload;
};

const backendToFrontendHistory = (backendHistory: BackendHistory): HistoryLogEntry => ({
  id: backendHistory.id,
  timestamp: parseISO(backendHistory.timestamp).getTime(),
  actionKey: backendHistory.action as HistoryLogActionKey,
  backendAction: backendHistory.action,
  backendUserId: backendHistory.user_id,
  scope: 'account',
  details: { rawBackendAction: backendHistory.action }
});

const formatBackendError = (errorData: any, defaultMessage: string): string => {
  if (errorData && errorData.detail) {
    if (Array.isArray(errorData.detail)) {
      return errorData.detail
        .map((validationError: any) => {
          // Filter out 'body' from the location array for better readability
          const loc = validationError.loc && Array.isArray(validationError.loc) 
            ? validationError.loc.filter((item: any) => item !== 'body').join(' > ') 
            : 'Field';
          return `${loc}: ${validationError.msg}`;
        })
        .join('; ');
    } else if (typeof errorData.detail === 'string') {
      return errorData.detail;
    }
  }
  return defaultMessage;
};


const createApiErrorToast = (
    err: unknown,
    toastFn: (options: any) => void,
    defaultTitleKey: keyof Translations,
    operationType: 'loading' | 'adding' | 'updating' | 'deleting',
    translationFn: (key: keyof Translations, params?: any) => string,
    endpoint?: string
  ) => {
    const error = err as Error & { cause?: unknown, name?: string };
    let consoleMessage = `[AppProvider] Failed ${operationType} for endpoint: ${endpoint || 'N/A'}. 
Error Name: ${error.name || 'UnknownError'}
Error Message: ${error.message || 'No message'}.`;
    if (error.stack) consoleMessage += `\nStack: ${error.stack}`;
    if (error.cause && typeof error.cause === 'object' && error.cause !== null) {
        consoleMessage += `\nCause: ${JSON.stringify(error.cause)}`;
    } else if (error.cause) {
        consoleMessage += `\nCause: ${String(error.cause)}`;
    }


    console.error(consoleMessage);

    let descriptionKey: keyof Translations = 'toastDefaultErrorDescription';
    let descriptionParams: any = {};
    let customDescription: string | null = null;

    if (error.name === 'TypeError' && error.message.toLowerCase().includes('failed to fetch')) {
      descriptionKey = 'toastFailedToFetchErrorDescription';
      descriptionParams = { endpoint: endpoint || API_BASE_URL };
    } else if (error.message && error.message.toLowerCase().includes("unexpected token '<'")) {
      descriptionKey = 'toastInvalidJsonErrorDescription';
      descriptionParams = { endpoint: endpoint || API_BASE_URL };
    } else if (error.message) {
        customDescription = error.message;
    }
    
    toastFn({
        variant: "destructive",
        title: translationFn(defaultTitleKey),
        description: customDescription || translationFn(descriptionKey, descriptionParams)
    });
};


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [personalActivities, setPersonalActivities] = useState<Activity[]>([]);
  const [workActivities, setWorkActivities] = useState<Activity[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [assignees, setAllAssignees] = useState<Assignee[]>([]);
  const [appModeState, setAppModeState] = useState<AppMode>('personal');

  const [isLoadingState, setIsLoadingState] = useState<boolean>(true);
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(true);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isAssigneesLoading, setIsAssigneesLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

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
    if (typeof window === 'undefined' || isLoadingState) return;
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
  }, [theme, resolvedTheme, appModeState, isLoadingState]);

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
    return assignees;
  }, [assignees, isAssigneesLoading]);


  const addHistoryLogEntry = useCallback((actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined>, scope: HistoryLogEntry['scope'] = 'account') => {
    const newEntry: HistoryLogEntry = {
      id: Date.now() + Math.random(),
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
    } catch (err) {
      setSystemNotificationPermission(Notification.permission);
    }
  }, [t, toast, showSystemNotification]);

  const logout = useCallback(() => {
    addHistoryLogEntry('historyLogLogout', undefined, 'account');
    setIsAuthenticatedState(false);
    setLoginAttemptsState(0);
    setLockoutEndTimeState(null);
    setSessionExpiryTimestampState(null);
    setIsAppLocked(false);

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'RESET_TIMER', payload: { locale } });
    }

    if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);
        localStorage.removeItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS);
        localStorage.removeItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME);
        localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY);
    }
    if (logoutChannel) logoutChannel.postMessage('logout_event');
  }, [addHistoryLogEntry, locale]);

 useEffect(() => {
    let initialAuth = false;
    const loadClientSideData = () => {
      try {
        // Load from local storage as a fallback or initial quick display
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
            initialAuth = false;
            logout();
          } else {
            initialAuth = true;
            setSessionExpiryTimestampState(expiryTime);
          }
      } else {
        initialAuth = false;
      }
      setIsAuthenticatedState(initialAuth);

      const storedAttempts = localStorage.getItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS);
      setLoginAttemptsState(storedAttempts ? parseInt(storedAttempts, 10) : 0);
      const storedLockoutTime = localStorage.getItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME);
      setLockoutEndTimeState(storedLockoutTime ? parseInt(storedLockoutTime, 10) : null);

      const storedUINotifications = localStorage.getItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS);
      if (storedUINotifications) setUINotifications(JSON.parse(storedUINotifications));

      if (typeof window !== 'undefined' && 'Notification' in window) setSystemNotificationPermission(Notification.permission);

      const storedPin = localStorage.getItem(LOCAL_STORAGE_KEY_APP_PIN);
      if (storedPin) setAppPinState(storedPin);
      else if (HARDCODED_APP_PIN) setAppPinState(HARDCODED_APP_PIN);
    };
    
    const fetchInitialActivities = async () => {
      setIsActivitiesLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/activities`);
        if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to fetch activities: HTTP ${response.status}`));}
        const backendActivities: BackendActivity[] = await response.json();
        
        const newPersonalActivities: Activity[] = [];
        const newWorkActivities: Activity[] = [];
        
        backendActivities.forEach(beAct => {
          if (!beAct) {
            console.warn("[AppProvider] Encountered a null or undefined activity object from backend GET /activities.");
            return;
          }
          const feAct = backendToFrontendActivity(beAct, beAct.mode as AppMode);
          if (feAct.appMode === 'personal') newPersonalActivities.push(feAct);
          else if (feAct.appMode === 'work') newWorkActivities.push(feAct);
        });
        setPersonalActivities(newPersonalActivities);
        setWorkActivities(newWorkActivities);

      } catch (err) {
        createApiErrorToast(err, toast, "toastActivityLoadErrorTitle", "loading", t, `${API_BASE_URL}/activities`);
        setError(prev => prev ? `${prev} Activities failed. ` : "Activities failed. ");
        // Keep existing localStorage activities if API fails
      } finally {
        setIsActivitiesLoading(false);
      }
    };


    const fetchInitialCategories = async () => {
      setIsCategoriesLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/categories`);
        if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to fetch categories: HTTP ${response.status}`));}
        const backendCategories: BackendCategory[] = await response.json();
        setAllCategories(backendCategories.map(cat => backendToFrontendCategory(cat)));
      } catch (err) { createApiErrorToast(err, toast, "toastCategoryLoadErrorTitle", "loading", t, `${API_BASE_URL}/categories`); setError(prev => prev ? `${prev} Categories failed. ` : "Categories failed. "); setAllCategories([]); }
      finally { setIsCategoriesLoading(false); }
    };

    const fetchInitialAssignees = async () => {
      setIsAssigneesLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/users`);
        if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to fetch users: HTTP ${response.status}`));}
        const backendUsers: BackendUser[] = await response.json();
        setAllAssignees(backendUsers.map(user => backendToFrontendAssignee(user)));
      } catch (err) { createApiErrorToast(err, toast, "toastAssigneeLoadErrorTitle", "loading", t, `${API_BASE_URL}/users`); setError(prev => prev ? `${prev} Assignees failed. ` : "Assignees failed. "); setAllAssignees([]); }
      finally { setIsAssigneesLoading(false); }
    };

    const fetchInitialHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/history`);
        if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to fetch history: HTTP ${response.status}`));}
        const backendHistoryItems: BackendHistory[] = await response.json();
        setHistoryLog(backendHistoryItems.map(item => backendToFrontendHistory(item)));
      } catch (err) { createApiErrorToast(err, toast, "historyLoadErrorTitle", "loading", t, `${API_BASE_URL}/history`); setError(prev => prev ? `${prev} History failed. ` : "History failed. "); setHistoryLog([]);}
      finally { setIsHistoryLoading(false); }
    };
    
    const fetchAllData = async () => {
        loadClientSideData();
        await Promise.all([fetchInitialActivities(), fetchInitialCategories(), fetchInitialAssignees()]);
        if (initialAuth) {
            await fetchInitialHistory();
        } else {
            setIsHistoryLoading(false);
        }
        setIsLoadingState(false);
    };
    fetchAllData();
  }, [logout, t, toast]);


  useEffect(() => {
    if (!isLoadingState && !isActivitiesLoading) {
      localStorage.setItem(LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES, JSON.stringify(personalActivities));
    }
  }, [personalActivities, isLoadingState, isActivitiesLoading]);

  useEffect(() => {
    if (!isLoadingState && !isActivitiesLoading) {
      localStorage.setItem(LOCAL_STORAGE_KEY_WORK_ACTIVITIES, JSON.stringify(workActivities));
    }
  }, [workActivities, isLoadingState, isActivitiesLoading]);

  useEffect(() => {
    if (!isLoadingState) {
      localStorage.setItem(LOCAL_STORAGE_KEY_APP_MODE, appModeState);
      const root = document.documentElement;
      root.classList.remove('mode-personal', 'mode-work');
      root.classList.add(appModeState === 'work' ? 'mode-work' : 'mode-personal');
    }
  }, [appModeState, isLoadingState]);

  useEffect(() => { if (!isLoadingState) { if (isAuthenticated) localStorage.setItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED, 'true'); else localStorage.removeItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);}}, [isAuthenticated, isLoadingState]);
  useEffect(() => { if (!isLoadingState) localStorage.setItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS, String(loginAttempts));}, [loginAttempts, isLoadingState]);
  useEffect(() => { if (!isLoadingState) { if (lockoutEndTime === null) localStorage.removeItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME); else localStorage.setItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME, String(lockoutEndTime));}}, [lockoutEndTime, isLoadingState]);
  useEffect(() => { if (!isLoadingState) { if (sessionExpiryTimestamp === null) localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY); else localStorage.setItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY, String(sessionExpiryTimestamp));}}, [sessionExpiryTimestamp, isLoadingState]);
  useEffect(() => { if(!isLoadingState) localStorage.setItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS, JSON.stringify(uiNotifications));}, [uiNotifications, isLoadingState]);

  useEffect(() => {
    if (isLoadingState || !isAuthenticated) return;

    const intervalId = setInterval(() => {
      const now = new Date();
      const today = getStartOfDayUtil(now);
      const currentDayOfMonthFromNow = now.getDate();

      if (lastNotificationCheckDay !== null && lastNotificationCheckDay !== currentDayOfMonthFromNow) {
        setNotifiedToday(new Set());
      }
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

            if (recurrenceType === 'weekly') {
                if (isSameDay(today, oneDayBeforeInstance)) {
                    notify('1day_weekly', 'toastActivityTomorrowTitle', 'toastActivityTomorrowDescription', { activityTitle });
                }
            } else if (recurrenceType === 'monthly') {
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
          });
        }
      });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [personalActivities, workActivities, appModeState, isLoadingState, isAuthenticated, toast, t, lastNotificationCheckDay, notifiedToday, stableAddUINotification, dateFnsLocale, showSystemNotification, locale]);

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
                setPomodoroPhase(phase);
                setPomodoroTimeRemaining(timeRemaining);
                setPomodoroIsRunning(isRunning);
                setPomodoroCyclesCompleted(cyclesCompleted);
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
            if (navigator.serviceWorker.controller) {
                setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
            } else {
                setIsPomodoroReady(false);
            }
        } catch (error) {
            setIsPomodoroReady(false);
            toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: `SW Reg Error: ${error instanceof Error ? error.message : String(error)}`});
        }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', handleSWMessage);
        const handleControllerChange = () => {
            if (navigator.serviceWorker.controller) {
                setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
            } else {
                setIsPomodoroReady(false);
            }
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        if (document.readyState === 'complete') {
            registerAndInitializeSW();
        } else {
            window.addEventListener('load', registerAndInitializeSW, { once: true });
        }
        if (navigator.serviceWorker.controller) {
             setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
        }

    } else {
        setIsPomodoroReady(false);
    }

    return () => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.removeEventListener('message', handleSWMessage);
        }
    };
  }, [locale, postToServiceWorker, handleSWMessage, t, toast]);

  useEffect(() => {
    if (isPomodoroReady && prevPomodoroPhaseRef.current !== pomodoroPhase && prevPomodoroPhaseRef.current !== 'off') {
        const phaseThatEnded = prevPomodoroPhaseRef.current;
        let titleKey: keyof Translations = 'pomodoroWorkSessionEnded';
        let descriptionKey: keyof Translations = 'pomodoroFocusOnTask';

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
        const title = t(titleKey as any);
        const description = t(descriptionKey as any);

        if (title && description) {
            stableAddUINotification({ title, description, activityId: `pomodoro_cycle_${pomodoroCyclesCompleted}_${phaseThatEnded}` });
            toast({ title, description });
        }
    }
    prevPomodoroPhaseRef.current = pomodoroPhase;
  }, [pomodoroPhase, pomodoroCyclesCompleted, isPomodoroReady, stableAddUINotification, t, toast]);

  const startPomodoroWork = useCallback(() => postToServiceWorker({ type: 'START_WORK', payload: { locale, cyclesCompleted: 0 } }), [postToServiceWorker, locale]);
  const startPomodoroShortBreak = useCallback(() => postToServiceWorker({ type: 'START_SHORT_BREAK', payload: { locale } }), [postToServiceWorker, locale]);
  const startPomodoroLongBreak = useCallback(() => postToServiceWorker({ type: 'START_LONG_BREAK', payload: { locale } }), [postToServiceWorker, locale]);
  const pausePomodoro = useCallback(() => postToServiceWorker({ type: 'PAUSE_TIMER', payload: { locale } }), [postToServiceWorker, locale]);
  const resumePomodoro = useCallback(() => postToServiceWorker({ type: 'RESUME_TIMER', payload: { locale } }), [postToServiceWorker, locale]);
  const resetPomodoro = useCallback(() => {
    setIsPomodoroReady(false);
    postToServiceWorker({ type: 'RESET_TIMER', payload: { locale } });
  }, [postToServiceWorker, locale]);


  const setAppMode = useCallback((mode: AppMode) => {
    if (mode !== appModeState) {
      addHistoryLogEntry(mode === 'personal' ? 'historyLogSwitchToPersonalMode' : 'historyLogSwitchToWorkMode', undefined, 'account');
    }
    setAppModeState(mode);
  }, [appModeState, addHistoryLogEntry]);

  const setIsAuthenticated = useCallback((value: boolean, rememberMe: boolean = false) => {
    const wasAuthenticated = isAuthenticated;
    setIsAuthenticatedState(value);
    if (value && !wasAuthenticated) {
        addHistoryLogEntry('historyLogLogin', undefined, 'account');
        setHistoryLog([]);
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === "granted") {
            const title = t('loginSuccessNotificationTitle');
            const description = t('loginSuccessNotificationDescription');
            stableAddUINotification({ title, description });
            showSystemNotification(title, description);
        }
    }
    if (value) {
        const newExpiryTimestamp = Date.now() + (rememberMe ? SESSION_DURATION_30_DAYS_MS : SESSION_DURATION_24_HOURS_MS);
        setSessionExpiryTimestampState(newExpiryTimestamp);
    } else {
        setSessionExpiryTimestampState(null);
    }
  }, [isAuthenticated, addHistoryLogEntry, t, stableAddUINotification, showSystemNotification]);

  const logPasswordChange = useCallback(() => addHistoryLogEntry('historyLogPasswordChange', undefined, 'account'), [addHistoryLogEntry]);
  const setLoginAttempts = useCallback((attempts: number) => setLoginAttemptsState(attempts), []);
  const setLockoutEndTime = useCallback((timestamp: number | null) => setLockoutEndTimeState(timestamp), []);

  const addCategory = useCallback(async (name: string, iconName: string, mode: AppMode | 'all') => {
    setError(null);
    const payload: BackendCategoryCreatePayload = { name, icon_name: iconName, mode: frontendToBackendCategoryMode(mode) };
    try {
      const response = await fetch(`${API_BASE_URL}/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add category: HTTP ${response.status}`));}
      const newBackendCategory: BackendCategory = await response.json();
      setAllCategories(prev => [...prev, backendToFrontendCategory(newBackendCategory)]);
      toast({ title: t('toastCategoryAddedTitle'), description: t('toastCategoryAddedDescription', { categoryName: name }) });
      addHistoryLogEntry(mode === 'personal' ? 'historyLogAddCategoryPersonal' : mode === 'work' ? 'historyLogAddCategoryWork' : 'historyLogAddCategoryAll', { name }, 'category');
    } catch (err) { createApiErrorToast(err, toast, "toastCategoryAddedTitle", "adding", t, `${API_BASE_URL}/categories`); setError((err as Error).message); throw err; }
  }, [toast, t, addHistoryLogEntry]);

  const updateCategory = useCallback(async (categoryId: number, updates: Partial<Omit<Category, 'id' | 'icon'>>, oldCategoryData?: Category) => {
    setError(null);
    const payload: Partial<BackendCategoryCreatePayload> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.iconName !== undefined) payload.icon_name = updates.iconName;
    if (updates.mode !== undefined) payload.mode = frontendToBackendCategoryMode(updates.mode);

    try {
      const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update category: HTTP ${response.status}`));}
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
    if (!categoryToDelete) return;
    try {
      const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete category: HTTP ${response.status}`));}
      setAllCategories(prev => prev.filter(cat => cat.id !== categoryId));
      toast({ title: t('toastCategoryDeletedTitle'), description: t('toastCategoryDeletedDescription', { categoryName: categoryToDelete.name }) });
      addHistoryLogEntry('historyLogDeleteCategory', { name: categoryToDelete.name, mode: categoryToDelete.mode as string }, 'category');
    } catch (err) { createApiErrorToast(err, toast, "toastCategoryDeletedTitle", "deleting", t, `${API_BASE_URL}/categories/${categoryId}`); setError((err as Error).message); throw err; }
  }, [allCategories, toast, t, addHistoryLogEntry]);

  const addAssignee = useCallback(async (name: string, username?: string, password?: string) => {
    setError(null);
    const finalUsername = username || name.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 1000);
    const finalPassword = password || "P@ssword123";
    const payload: BackendUserCreatePayload = { name, username: finalUsername, password: finalPassword };

    try {
      const response = await fetch(`${API_BASE_URL}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add assignee: HTTP ${response.status}`));}
      const newBackendUser: BackendUser = await response.json();
      setAllAssignees(prev => [...prev, backendToFrontendAssignee(newBackendUser)]);
      toast({ title: t('toastAssigneeAddedTitle'), description: t('toastAssigneeAddedDescription', { assigneeName: name }) });
      addHistoryLogEntry('historyLogAddAssignee', { name }, 'assignee');
    } catch (err) { createApiErrorToast(err, toast, "toastAssigneeAddedTitle", "adding", t, `${API_BASE_URL}/users`); setError((err as Error).message); throw err; }
  }, [toast, t, addHistoryLogEntry]);

  const updateAssignee = useCallback(async (assigneeId: number, updates: Partial<Pick<Assignee, 'name' | 'username'>>) => {
    setError(null);
    const currentAssignee = assignees.find(a => a.id === assigneeId);
    
    if (updates.username && updates.username !== currentAssignee?.username) {
      const existingUserWithNewUsername = assignees.find(a => a.username === updates.username && a.id !== assigneeId);
      if (existingUserWithNewUsername) {
        const errorMsg = t('usernameTakenErrorDescription', { username: updates.username });
        toast({ variant: "destructive", title: t('usernameTakenErrorTitle'), description: errorMsg });
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    }

    const payload: Partial<BackendUserUpdatePayload> = {};
    if (updates.name) payload.name = updates.name;
    if (updates.username) payload.username = updates.username;
    // Note: Password update is not handled here as backend expects Form data for password
    // This assumes backend PUT /users/{user_id} can handle JSON for name/username updates
    // and optionally password if it were Form data.

    try {
      const response = await fetch(`${API_BASE_URL}/users/${assigneeId}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' }, // Sending JSON
         body: JSON.stringify(payload)
      });

      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update assignee: HTTP ${response.status}`));}
      const updatedBackendUser: BackendUser = await response.json();
      setAllAssignees(prev => prev.map(asg => (asg.id === assigneeId ? backendToFrontendAssignee(updatedBackendUser) : asg)));
      toast({ title: t('toastAssigneeUpdatedTitle'), description: t('toastAssigneeUpdatedDescription', { assigneeName: updatedBackendUser.name }) });
      
      const historyDetails: Record<string, string | undefined> = { name: updatedBackendUser.name };
      if (currentAssignee?.name !== updatedBackendUser.name) {
        historyDetails.oldName = currentAssignee?.name;
      }
      if (updates.username && currentAssignee?.username !== updatedBackendUser.username) {
        historyDetails.oldUsername = currentAssignee?.username;
        historyDetails.newUsername = updatedBackendUser.username;
      }
      addHistoryLogEntry('historyLogUpdateAssignee', historyDetails, 'assignee');

    } catch (err) {
        if (!(err instanceof Error && err.message.includes(t('usernameTakenErrorDescription', {username: updates.username || ''})))) {
            createApiErrorToast(err, toast, "toastAssigneeUpdatedTitle", "updating", t, `${API_BASE_URL}/users/${assigneeId}`);
        }
        setError((err as Error).message); throw err;
    }
  }, [assignees, toast, t, addHistoryLogEntry]);

  const deleteAssignee = useCallback(async (assigneeId: number) => {
    setError(null);
    const assigneeToDelete = assignees.find(asg => asg.id === assigneeId);
    if (!assigneeToDelete) return;
    try {
      const response = await fetch(`${API_BASE_URL}/users/${assigneeId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete assignee: HTTP ${response.status}`));}
      setAllAssignees(prev => prev.filter(asg => asg.id !== assigneeId));
      const updateActivities = (acts: Activity[]) =>
        acts.map(act => ({
          ...act,
          responsiblePersonIds: act.responsiblePersonIds?.filter(id => id !== assigneeId)
        }));
      setPersonalActivities(prev => updateActivities(prev));
      setWorkActivities(prev => updateActivities(prev));
      
      toast({ title: t('toastAssigneeDeletedTitle'), description: t('toastAssigneeDeletedDescription', { assigneeName: assigneeToDelete.name }) });
      addHistoryLogEntry('historyLogDeleteAssignee', { name: assigneeToDelete.name }, 'assignee');
    } catch (err) { createApiErrorToast(err, toast, "toastAssigneeDeletedTitle", "deleting", t, `${API_BASE_URL}/users/${assigneeId}`); setError((err as Error).message); throw err; }
  }, [assignees, toast, t, addHistoryLogEntry]);


  const addActivity = useCallback(async (
      activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'completedAt' | 'notes' | 'recurrence' | 'completedOccurrences' | 'responsiblePersonIds' | 'categoryId' | 'appMode' | 'masterActivityId' | 'isRecurringInstance' | 'originalInstanceDate'> & {
        todos?: Omit<Todo, 'id' | 'completed'>[]; time?: string; notes?: string; recurrence?: RecurrenceRule | null; responsiblePersonIds?: number[]; categoryId: number; appMode: AppMode;
      }, customCreatedAt?: number
    ) => {
    setError(null);
    const frontendActivityShell: Activity = {
      id: 0, // Placeholder, backend will assign
      title: activityData.title,
      categoryId: activityData.categoryId,
      todos: (activityData.todos || []).map(t => ({ id: 0, text: t.text, completed: false })), // Placeholder IDs for todos
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
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add activity: HTTP ${response.status}`));}
      
      const newBackendActivity: BackendActivity | null | undefined = await response.json().catch(() => null);
      
      const newFrontendActivity = backendToFrontendActivity(newBackendActivity, appModeState);
      
      if (newFrontendActivity.appMode === 'personal') {
        setPersonalActivities(prev => [...prev, newFrontendActivity]);
      } else {
        setWorkActivities(prev => [...prev, newFrontendActivity]);
      }
      toast({ title: t('toastActivityAddedTitle'), description: t('toastActivityAddedDescription') });
      addHistoryLogEntry(appModeState === 'personal' ? 'historyLogAddActivityPersonal' : 'historyLogAddActivityWork', { title: newFrontendActivity.title }, appModeState);
    } catch (err) { createApiErrorToast(err, toast, "toastActivityAddedTitle", "adding", t, `${API_BASE_URL}/activities`); setError((err as Error).message); throw err; }
  }, [appModeState, toast, t, addHistoryLogEntry]);

  const updateActivity = useCallback(async (activityId: number, updates: Partial<Omit<Activity, 'id'>>, originalActivity?: Activity) => {
    setError(null);
    let currentActivitiesList = appModeState === 'work' ? workActivities : personalActivities;
    let activityToUpdate = currentActivitiesList.find(a => a.id === activityId);
    let targetSetter = appModeState === 'work' ? setWorkActivities : setPersonalActivities;

    if (!activityToUpdate) {
      currentActivitiesList = appModeState === 'work' ? personalActivities : workActivities;
      activityToUpdate = currentActivitiesList.find(a => a.id === activityId);
      targetSetter = appModeState === 'work' ? setPersonalActivities : setWorkActivities;
       if(!activityToUpdate) {
         console.error("Activity not found for update in any list:", activityId);
         toast({variant: "destructive", title: "Error", description: "Activity not found for update."});
         return;
       }
    }
    
    const effectiveAppMode = updates.appMode || activityToUpdate.appMode;
    const updatedFrontendShell: Activity = { ...activityToUpdate, ...updates, appMode: effectiveAppMode };
    const payload = frontendToBackendActivityPayload(updatedFrontendShell, true) as BackendActivityUpdatePayload;

    try {
      const response = await fetch(`${API_BASE_URL}/activities/${activityId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update activity: HTTP ${response.status}`));}
      const updatedBackendActivity: BackendActivity = await response.json();
      const finalFrontendActivity = {
        ...backendToFrontendActivity(updatedBackendActivity, appModeState),
        completedOccurrences: activityToUpdate.completedOccurrences,
      };
      // Preserve client-side todo completion status after backend update
      if (updates.todos && Array.isArray(updates.todos)) {
         finalFrontendActivity.todos = updates.todos;
      }


      if (updates.completedOccurrences) {
        finalFrontendActivity.completedOccurrences = { ...finalFrontendActivity.completedOccurrences, ...updates.completedOccurrences };
      }
      if (updates.completed !== undefined) finalFrontendActivity.completed = updates.completed;
      if (updates.completedAt !== undefined) finalFrontendActivity.completedAt = updates.completedAt;


      if (originalActivity && finalFrontendActivity.appMode !== originalActivity.appMode) {
        if (originalActivity.appMode === 'personal') setPersonalActivities(prev => prev.filter(act => act.id !== activityId));
        else setWorkActivities(prev => prev.filter(act => act.id !== activityId));
        if (finalFrontendActivity.appMode === 'personal') setPersonalActivities(prev => [...prev, finalFrontendActivity]);
        else setWorkActivities(prev => [...prev, finalFrontendActivity]);
      } else {
         targetSetter(prev => prev.map(act => (act.id === activityId ? finalFrontendActivity : act)));
      }

      toast({ title: t('toastActivityUpdatedTitle'), description: t('toastActivityUpdatedDescription') });
      addHistoryLogEntry(appModeState === 'personal' ? 'historyLogUpdateActivityPersonal' : 'historyLogUpdateActivityWork', { title: finalFrontendActivity.title }, appModeState);
    } catch (err) { createApiErrorToast(err, toast, "toastActivityUpdatedTitle", "updating", t, `${API_BASE_URL}/activities/${activityId}`); setError((err as Error).message); throw err; }
  }, [appModeState, personalActivities, workActivities, toast, t, addHistoryLogEntry]);

  const deleteActivity = useCallback(async (activityId: number) => {
    setError(null);
    
    let activityToDelete = personalActivities.find(a => a.id === activityId);
    let setter = setPersonalActivities;
    let modeForLog: AppMode = 'personal';

    if (!activityToDelete) {
        activityToDelete = workActivities.find(a => a.id === activityId);
        setter = setWorkActivities;
        modeForLog = 'work';
    }
    
    if (!activityToDelete) {
      console.error("Activity not found for deletion:", activityId);
      toast({variant: "destructive", title: "Error", description: "Activity not found for deletion."});
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/activities/${activityId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete activity: HTTP ${response.status}`));}
      setter(prev => prev.filter(act => act.id !== activityId));
      toast({ title: t('toastActivityDeletedTitle'), description: t('toastActivityDeletedDescription', { activityTitle: activityToDelete.title }) });
      addHistoryLogEntry(modeForLog === 'personal' ? 'historyLogDeleteActivityPersonal' : 'historyLogDeleteActivityWork', { title: activityToDelete.title }, modeForLog);
    } catch (err) { createApiErrorToast(err, toast, "toastActivityDeletedTitle", "deleting", t, `${API_BASE_URL}/activities/${activityId}`); setError((err as Error).message); throw err; }
  }, [personalActivities, workActivities, toast, t, addHistoryLogEntry]);


  const addTodoToActivity = useCallback(async (activityId: number, todoText: string) => {
    setError(null);
    const payload: BackendTodoCreate = { text: todoText };
    try {
      const response = await fetch(`${API_BASE_URL}/activities/${activityId}/todos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add todo: HTTP ${response.status}`));}
      const newBackendTodo: BackendTodo = await response.json();
      const newFrontendTodo: Todo = {
        id: typeof newBackendTodo?.id === 'number' ? newBackendTodo.id : Date.now() + Math.random(),
        text: newBackendTodo?.text || todoText,
        completed: false
      };
      if (typeof newBackendTodo?.id !== 'number') {
        console.warn(`[AppProvider] Todo added for activity ${activityId} but backend did not return a valid ID. Using temporary ID. Backend response:`, newBackendTodo);
      }


      const updateInList = (list: Activity[], setter: React.Dispatch<React.SetStateAction<Activity[]>>) => {
          const activityIndex = list.findIndex(act => act.id === activityId);
          if (activityIndex !== -1) {
            const updatedActivity = { ...list[activityIndex], todos: [...list[activityIndex].todos, newFrontendTodo] };
            setter(prev => prev.map(act => act.id === activityId ? updatedActivity : act));
          }
      };
      updateInList(personalActivities, setPersonalActivities);
      updateInList(workActivities, setWorkActivities);

      toast({ title: t('toastTodoAddedTitle'), description: t('toastTodoAddedDescription', { todoText }) });
    } catch (err) { createApiErrorToast(err, toast, "toastTodoAddedTitle", "adding", t, `${API_BASE_URL}/activities/${activityId}/todos`); setError((err as Error).message); throw err; }
  }, [personalActivities, workActivities, toast, t]);

  const updateTodoInActivity = useCallback((activityId: number, todoId: number, updates: Partial<Todo>) => {
    // This remains client-side only for now, as backend does not support PUT /todos/{id}
    if (updates.hasOwnProperty('completed') || updates.hasOwnProperty('text')) {
      const updateInList = (list: Activity[], setter: React.Dispatch<React.SetStateAction<Activity[]>>) => {
          const activityIndex = list.findIndex(act => act.id === activityId);
          if (activityIndex !== -1) {
            const updatedTodos = list[activityIndex].todos.map(todo =>
              todo.id === todoId ? { ...todo, ...updates } : todo
            );
            const updatedActivity = { ...list[activityIndex], todos: updatedTodos };
            setter(prev => prev.map(act => act.id === activityId ? updatedActivity : act));
            if (updates.text) {
              toast({ title: t('toastTodoUpdatedTitle'), description: t('toastTodoUpdatedDescription', { todoText: updates.text || "" }) });
            }
          }
      };
      updateInList(personalActivities, setPersonalActivities);
      updateInList(workActivities, setWorkActivities);
    }
  }, [personalActivities, workActivities, t, toast]);

  const deleteTodoFromActivity = useCallback(async (activityId: number, todoId: number) => {
    setError(null);
    const todoToDelete =
      personalActivities.find(act => act.id === activityId)?.todos.find(t => t.id === todoId) ||
      workActivities.find(act => act.id === activityId)?.todos.find(t => t.id === todoId);

    try {
      const response = await fetch(`${API_BASE_URL}/todos/${todoId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete todo: HTTP ${response.status}`));}
      
      const updateInList = (list: Activity[], setter: React.Dispatch<React.SetStateAction<Activity[]>>) => {
          const activityIndex = list.findIndex(act => act.id === activityId);
          if (activityIndex !== -1) {
            const updatedTodos = list[activityIndex].todos.filter(todo => todo.id !== todoId);
            const updatedActivity = { ...list[activityIndex], todos: updatedTodos };
            setter(prev => prev.map(act => act.id === activityId ? updatedActivity : act));
          }
      };
      updateInList(personalActivities, setPersonalActivities);
      updateInList(workActivities, setWorkActivities);

      toast({ title: t('toastTodoDeletedTitle'), description: t('toastTodoDeletedDescription', { todoText: todoToDelete?.text || "Todo" }) });
    } catch (err) { createApiErrorToast(err, toast, "toastTodoDeletedTitle", "deleting", t, `${API_BASE_URL}/todos/${todoId}`); setError((err as Error).message); throw err; }
  }, [personalActivities, workActivities, toast, t]);

  const toggleOccurrenceCompletion = useCallback((masterActivityId: number, occurrenceDateTimestamp: number, completedState: boolean) => {
    let activityTitleForLog = 'Unknown Activity';
    let masterActivity = personalActivities.find(act => act.id === masterActivityId);
    let setter = setPersonalActivities;
    let modeForLog: AppMode = 'personal';

    if (!masterActivity) {
        masterActivity = workActivities.find(act => act.id === masterActivityId);
        setter = setWorkActivities;
        modeForLog = 'work';
    }
    
    if (masterActivity) activityTitleForLog = masterActivity.title;

    const occurrenceDateKey = formatDateFns(new Date(occurrenceDateTimestamp), 'yyyy-MM-dd');

    setter(prevActivities =>
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
    addHistoryLogEntry(modeForLog === 'personal' ? 'historyLogToggleActivityCompletionPersonal' : 'historyLogToggleActivityCompletionWork', { title: activityTitleForLog, completed: completedState ? 1 : 0 }, modeForLog);
  }, [personalActivities, workActivities, addHistoryLogEntry]);


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

  const combinedIsLoading = isLoadingState || isActivitiesLoading || isCategoriesLoading || isAssigneesLoading || (isAuthenticated && isHistoryLoading);

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

    
