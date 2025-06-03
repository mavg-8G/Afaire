
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  Activity, Todo, Category, AppMode, RecurrenceRule, UINotification, HistoryLogEntry, HistoryLogActionKey, Translations, Assignee, PomodoroPhase,
  BackendCategoryCreatePayload, BackendCategory, BackendUser, BackendUserCreatePayload, BackendUserUpdatePayload, BackendActivityCreatePayload, BackendActivityUpdatePayload, BackendActivity, BackendTodoCreate, BackendHistory, RecurrenceType, BackendCategoryMode, BackendRepeatMode, BackendTodo,
  Token, DecodedToken, BackendHistoryCreatePayload, BackendCategoryUpdatePayload, AppContextType as AppContextTypeImport
} from '@/lib/types';
import { DEFAULT_API_BASE_URL, DEFAULT_JWT_SECRET_KEY, POMODORO_WORK_DURATION_SECONDS, POMODORO_SHORT_BREAK_DURATION_SECONDS, POMODORO_LONG_BREAK_DURATION_SECONDS } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import * as jose from 'jose';
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
  format as formatDateFns,
} from 'date-fns';
import * as Icons from 'lucide-react';
import { useTranslations } from '@/contexts/language-context';
import { enUS, es, fr } from 'date-fns/locale';
import { useTheme } from 'next-themes';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;
const JWT_SECRET_KEY_FOR_DECODING = process.env.NEXT_PUBLIC_JWT_SECRET_KEY || DEFAULT_JWT_SECRET_KEY;


// Combine with imported AppContextType
export type AppContextType = AppContextTypeImport & {
  fetchAndSetSpecificActivityDetails: (activityId: number) => Promise<Activity | null>;
};


export const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_APP_MODE = 'todoFlowAppMode_v2';
const LOCAL_STORAGE_KEY_JWT = 'todoFlowJWT_v1';
const LOCAL_STORAGE_KEY_UI_NOTIFICATIONS = 'todoFlowUINotifications_v2';
const LOCAL_STORAGE_KEY_APP_PIN = 'todoFlowAppPin_v2';


const getIconComponent = (iconName: string): Icons.LucideIcon => {
  const capitalizedIconName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
  const pascalCaseIconName = capitalizedIconName.replace(/[^A-Za-z0-9]/g, '');
  return (Icons as any)[pascalCaseIconName] || Icons.Package;
};

let logoutChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined') {
  logoutChannel = new BroadcastChannel('todoFlowLogoutChannel_v2');
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
  const maxIterations = 366 * 1; // Check for one year

  while (iterations < maxIterations && !isAfter(currentDate, rangeEndDate)) {
    iterations++;
    if (seriesEndDate && isAfter(currentDate, seriesEndDate)) break;
    if (isBefore(currentDate, new Date(masterActivity.createdAt))) {
        if (recurrence.type === 'daily') currentDate = addDays(currentDate, 1);
        else if (recurrence.type === 'weekly') currentDate = addDays(currentDate, 1); 
        else if (recurrence.type === 'monthly') {
            let nextMonth = addMonths(currentDate, 1);
            currentDate = setDayOfMonthFn(nextMonth, recurrence.dayOfMonth || getDate(currentDate)); 
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
  isAdmin: backendUser.is_admin || false,
});

const backendToFrontendActivity = (backendActivity: BackendActivity | null | undefined, currentAppMode: AppMode): Activity => {
   if (!backendActivity || typeof backendActivity !== 'object' || Object.keys(backendActivity).length === 0) {
    const fallbackId = Date.now() + Math.random();
    console.error(`[AppProvider] CRITICAL: backendToFrontendActivity received invalid or empty backendActivity object. Using fallback ID ${fallbackId}. Received:`, typeof backendActivity === 'object' ? JSON.stringify(backendActivity) : String(backendActivity));
    return {
      id: fallbackId,
      title: 'Error: Invalid Activity Data from Backend',
      categoryId: 0,
      todos: [],
      createdAt: Date.now(),
      appMode: currentAppMode,
      completedOccurrences: {},
      time: "00:00",
      recurrence: {type: 'none'}
    };
  }
  
  const activityIdForLog = typeof backendActivity.id === 'number' ? backendActivity.id : 'ID_MISSING_OR_INVALID_IN_BACKEND_RESPONSE';
  const startDateFromBackend = backendActivity.start_date;
  let createdAtTimestamp: number;

  if (typeof startDateFromBackend === 'string' && startDateFromBackend.trim() !== '') {
    try {
      createdAtTimestamp = parseISO(startDateFromBackend).getTime();
      if (isNaN(createdAtTimestamp)) throw new Error("Parsed timestamp is NaN");
    } catch (e) {
      console.warn(`[AppProvider] Warning: Failed to parse start_date "${startDateFromBackend}" from backend for activity ID ${activityIdForLog}. Error:`, e instanceof Error ? e.message : String(e), ". Using fallback createdAt to Date.now().");
      createdAtTimestamp = Date.now();
    }
  } else {
    console.warn(`[AppProvider] Warning: backendActivity.start_date is missing, null, or invalid in response for activity ID ${activityIdForLog}:`, startDateFromBackend === undefined ? 'FIELD_MISSING' : startDateFromBackend, ". Using fallback createdAt to Date.now().");
    createdAtTimestamp = Date.now();
  }
  
  let daysOfWeekArray: number[] = [];
  if (backendActivity.days_of_week && typeof backendActivity.days_of_week === 'string') {
    daysOfWeekArray = backendActivity.days_of_week.split(',').map(dayStr => parseInt(dayStr.trim(), 10)).filter(num => !isNaN(num) && num >= 0 && num <=6);
  }

  const recurrenceRule: RecurrenceRule = {
    type: backendActivity.repeat_mode as RecurrenceType, 
    endDate: backendActivity.end_date ? parseISO(backendActivity.end_date).getTime() : null,
    daysOfWeek: daysOfWeekArray.length > 0 ? daysOfWeekArray : undefined, 
    dayOfMonth: backendActivity.day_of_month ?? undefined,
  };
  
 const todosFromMainObject: Todo[] = [];
  if (Array.isArray(backendActivity.todos)) {
    backendActivity.todos.forEach((bt: BackendTodo, index: number) => {
        const todoId = typeof bt?.id === 'number' ? bt.id : Date.now() + Math.random() + index;
        if (typeof bt?.id !== 'number') {
            console.warn(`[AppProvider] Warning: Todo at index ${index} for activity ID ${activityIdForLog} is missing a valid 'id' from backend (main object). Using temporary ID ${todoId}. Backend todo:`, bt);
        }
        if (typeof bt?.text !== 'string') {
            console.warn(`[AppProvider] Warning: Todo at index ${index} for activity ID ${activityIdForLog} is missing 'text' from backend (main object).`);
        }
        todosFromMainObject.push({
          id: todoId,
          text: bt?.text || 'Untitled Todo from Backend',
          completed: bt?.complete || false, 
        });
      });
  } else if (backendActivity.todos !== undefined && backendActivity.todos !== null) { 
     console.warn(`[AppProvider] Warning: backendActivity.todos from main object is not an array for activity ID ${activityIdForLog}. Defaulting to empty array. Received:`, backendActivity.todos);
  }
  
 const responsiblePersonIds = (Array.isArray(backendActivity.responsibles))
    ? backendActivity.responsibles.map(r => r.id)
    : [];

  if (!(Array.isArray(backendActivity.responsibles)) && backendActivity.responsibles !== undefined) {
    console.warn(`[AppProvider] Warning: backendActivity.responsibles is not an array for activity ID ${activityIdForLog}. Defaulting to empty array. Received:`, backendActivity.responsibles !== undefined ? JSON.stringify(backendActivity.responsibles) : 'FIELD_MISSING_OR_UNDEFINED');
  }

  const idToUse = typeof backendActivity?.id === 'number' ? backendActivity.id : Date.now() + Math.random(); 
  if (typeof backendActivity?.id !== 'number') {
      console.error(`[AppProvider] CRITICAL: Backend activity response did not contain a valid 'id'. Using fallback ID ${idToUse}. Received:`, typeof backendActivity === 'object' ? JSON.stringify(backendActivity) : backendActivity);
  }

  return {
    id: idToUse,
    title: backendActivity?.title || 'Untitled Activity',
    categoryId: typeof backendActivity?.category_id === 'number' ? backendActivity.category_id : 0,
    todos: todosFromMainObject, // Initialize with todos from main object, can be overridden later
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
  activity: Omit<Activity, 'id' | 'completedOccurrences' | 'isRecurringInstance' | 'originalInstanceDate' | 'masterActivityId'> & { todos?: BackendTodoCreate[] },
  isUpdate: boolean = false
): Partial<BackendActivityCreatePayload | BackendActivityUpdatePayload> => {
  const payload: Partial<BackendActivityCreatePayload & BackendActivityUpdatePayload> = {
    title: activity.title,
    start_date: new Date(activity.createdAt).toISOString(),
    time: activity.time || "00:00",
    category_id: activity.categoryId,
    notes: activity.notes,
    mode: activity.appMode === 'all' ? 'both' : activity.appMode,
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
  
  if (activity.responsiblePersonIds !== undefined) {
    payload.responsible_ids = activity.responsiblePersonIds;
  } else if (!isUpdate) { 
    payload.responsible_ids = [];
  }

  if (!isUpdate && activity.todos && activity.todos.length > 0) {
    (payload as BackendActivityCreatePayload).todos = activity.todos.map(t => ({ text: t.text, complete: t.completed }));
  } else if (!isUpdate) {
    (payload as BackendActivityCreatePayload).todos = []; 
  }

  return payload;
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
    operationType: 'loading' | 'adding' | 'updating' | 'deleting' | 'authenticating' | 'logging',
    translationFn: (key: keyof Translations, params?: any) => string,
    endpoint?: string,
  ) => {
    const error = err as Error & { cause?: unknown, name?: string, response?: Response };
    let consoleMessage = `[AppProvider] Failed ${operationType} for endpoint: ${endpoint || 'N/A'}.
Error Name: ${error.name || 'UnknownError'}
Error Message: ${error.message || 'No message'}.`;
    if (error.stack) consoleMessage += `\nStack: ${error.stack}`;

    if (error.cause && typeof error.cause === 'object' && error.cause !== null) {
        try {
            consoleMessage += `\nCause: ${JSON.stringify(error.cause, Object.getOwnPropertyNames(error.cause))}`;
        } catch (e) {
            consoleMessage += `\nCause (could not stringify): ${error.cause}`;
        }
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
    } else if (error.message && error.message.toLowerCase().includes("unexpected token '<'") && error.message.toLowerCase().includes("html")) {
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
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [decodedJwt, setDecodedJwt] = useState<DecodedToken | null>(null);

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
  const [appPinState, setAppPinState] = useState<string | null>(null); 

  const isAuthenticated = !!jwtToken;

  const addHistoryLogEntryRef = useRef<((actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined>, scope?: HistoryLogEntry['scope']) => Promise<void>) | null>(null);


  // --- ORDERED useCallback DEFINITIONS ---

  const getCurrentUserId = useCallback((): number | null => {
    return decodedJwt?.sub ? parseInt(decodedJwt.sub, 10) : null;
  }, [decodedJwt]);

  const decodeAndSetToken = useCallback(async (token: string | null) => {
    if (!token) {
      setJwtToken(null);
      setDecodedJwt(null);
      if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_STORAGE_KEY_JWT);
      return;
    }
    try {
      const secret = new TextEncoder().encode(JWT_SECRET_KEY_FOR_DECODING);
      const { payload } = await jose.jwtVerify(token, secret, { algorithms: ['HS256'] });
      setJwtToken(token);
      setDecodedJwt(payload as DecodedToken);
      if (typeof window !== 'undefined') localStorage.setItem(LOCAL_STORAGE_KEY_JWT, token);
    } catch (e) {
      console.error("[AppProvider] Failed to verify/decode JWT:", e);
      setJwtToken(null);
      setDecodedJwt(null);
      if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_STORAGE_KEY_JWT);
    }
  }, []);

  const postToServiceWorker = useCallback((message: any) => {
    if (typeof window !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({...message, payload: { ...message.payload, locale } });
    } else if (typeof window !== 'undefined'){
      if (message.type !== 'GET_INITIAL_STATE' && !isPomodoroReady) { 
        toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: t('pomodoroSWNotReady') as string });
      }
    }
  }, [locale, t, toast, isPomodoroReady]);
  
  const startPomodoroWork = useCallback(() => postToServiceWorker({ type: 'START_WORK', payload: { cyclesCompleted: pomodoroCyclesCompleted } }), [postToServiceWorker, pomodoroCyclesCompleted]);
  const startPomodoroShortBreak = useCallback(() => postToServiceWorker({ type: 'START_SHORT_BREAK' }), [postToServiceWorker]);
  const startPomodoroLongBreak = useCallback(() => postToServiceWorker({ type: 'START_LONG_BREAK' }), [postToServiceWorker]);
  const pausePomodoro = useCallback(() => postToServiceWorker({ type: 'PAUSE_TIMER' }), [postToServiceWorker]);
  const resumePomodoro = useCallback(() => postToServiceWorker({ type: 'RESUME_TIMER' }), [postToServiceWorker]);
  const resetPomodoro = useCallback(() => {
    setIsPomodoroReady(false); 
    postToServiceWorker({ type: 'RESET_TIMER' });
  }, [postToServiceWorker]);


  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}, tokenToUse?: string | null): Promise<Response> => {
    const currentToken = tokenToUse || jwtToken;

    if (!currentToken && !url.endsWith('/token') && !url.includes(`${API_BASE_URL}/token`)) { 
      throw new Error("No JWT token available for authenticated request.");
    }

    const headers = new Headers(options.headers || {});
    if (currentToken) {
        headers.append('Authorization', `Bearer ${currentToken}`);
    }
    
    if (!(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)) { 
        if (!headers.has('Content-Type') && options.method && ['POST', 'PUT', 'PATCH'].includes(options.method.toUpperCase())) {
             headers.append('Content-Type', 'application/json');
        }
    }

    const response = await fetch(url.startsWith('http') ? url : `${API_BASE_URL}${url}`, { ...options, headers });

    if (response.status === 401 && !url.endsWith('/token') && !url.includes(`${API_BASE_URL}/token`)) {
        throw new Error(`Unauthorized: ${response.statusText}`); 
    }
    return response;
  }, [jwtToken, API_BASE_URL]); 

  const addHistoryLogEntry = useCallback(async (actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined>, scope: HistoryLogEntry['scope'] = 'account') => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        console.warn("[AppProvider] Cannot add history log: User ID not available.");
        return;
    }

    const payload: BackendHistoryCreatePayload = {
        action: actionKey, 
        user_id: currentUserId,
    };
    
    const actionWithDetails = details ? `${actionKey} ${JSON.stringify(details)}` : actionKey;
    payload.action = actionWithDetails.substring(0, 255); 

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/history`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(formatBackendError(errorData, `Failed to log history: HTTP ${response.status}`));
        }
        const newBackendHistoryEntry: BackendHistory = await response.json();
        setHistoryLog(prevLog => [backendToFrontendHistory(newBackendHistoryEntry), ...prevLog.slice(0, 99)]); 
    } catch (err) { 
        createApiErrorToast(err, toast, "historyLoadErrorTitle", "logging", t, `${API_BASE_URL}/history`);
        console.error(`[AppProvider] Failed logging history for action ${actionKey}:`, (err as Error).message);
    }
  }, [fetchWithAuth, getCurrentUserId, t, toast, API_BASE_URL]); 
  
  useEffect(() => { addHistoryLogEntryRef.current = addHistoryLogEntry;}, [addHistoryLogEntry]);

  const logout = useCallback(() => {
    if (addHistoryLogEntryRef.current) {
      addHistoryLogEntryRef.current('historyLogLogout', undefined, 'account');
    }
    decodeAndSetToken(null); 
    setIsAppLocked(false); 

    setPersonalActivities([]);
    setWorkActivities([]);
    setAllCategories([]);
    setAllAssignees([]);
    setHistoryLog([]);
    setUINotifications([]); 

    postToServiceWorker({ type: 'RESET_TIMER' });
    if (logoutChannel) logoutChannel.postMessage('logout_event_v2');
  }, [decodeAndSetToken, postToServiceWorker]); 
  
  // --- AppProvider state and other functions ---

  useEffect(() => {
    const loadClientSideDataAndFetchInitial = async () => {
      setIsLoadingState(true);
      
      const storedAppMode = localStorage.getItem(LOCAL_STORAGE_KEY_APP_MODE) as AppMode | null;
      if (storedAppMode && (storedAppMode === 'personal' || storedAppMode === 'work')) setAppModeState(storedAppMode);

      const storedToken = localStorage.getItem(LOCAL_STORAGE_KEY_JWT);
      let currentTokenForInitialLoad: string | null = null;
      if (storedToken) {
          await decodeAndSetToken(storedToken); 
          currentTokenForInitialLoad = storedToken;
      }

      const storedUINotifications = localStorage.getItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS);
      if (storedUINotifications) setUINotifications(JSON.parse(storedUINotifications));
      if (typeof window !== 'undefined' && 'Notification' in window) setSystemNotificationPermission(Notification.permission);
      
      const storedPin = localStorage.getItem(LOCAL_STORAGE_KEY_APP_PIN);
      if (storedPin) {
        setAppPinState(storedPin);
        if (storedToken) setIsAppLocked(true); 
      }

      if (currentTokenForInitialLoad) { 
        try {
            setIsActivitiesLoading(true);
            const actResponse = await fetchWithAuth(`${API_BASE_URL}/activities`, {}, currentTokenForInitialLoad); 
            if (!actResponse.ok) { 
                if (actResponse.status === 401) { logout(); } 
                throw new Error(`Activities fetch failed: ${actResponse.statusText}`); 
            }
            const backendActivities: BackendActivity[] = await actResponse.json();
            const newPersonal: Activity[] = [], newWork: Activity[] = [];
            backendActivities.forEach(beAct => {
                if (!beAct) return; 
                const feAct = backendToFrontendActivity(beAct, beAct.mode as AppMode); 
                if (feAct.appMode === 'personal') newPersonal.push(feAct); else newWork.push(feAct);
            });
            setPersonalActivities(newPersonal); setWorkActivities(newWork);
        } catch (err) { 
            if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
                 createApiErrorToast(err, toast, "toastActivityLoadErrorTitle", "loading", t, `${API_BASE_URL}/activities`); 
            } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) {
                logout();
            }
        }
        finally { setIsActivitiesLoading(false); }

        try {
            setIsCategoriesLoading(true);
            const catResponse = await fetchWithAuth(`${API_BASE_URL}/categories`, {}, currentTokenForInitialLoad);
            if (!catResponse.ok) { 
                if (catResponse.status === 401) { logout(); } 
                throw new Error(`Categories fetch failed: ${catResponse.statusText}`); 
            }
            const backendCategories: BackendCategory[] = await catResponse.json();
            setAllCategories(backendCategories.map(cat => backendToFrontendCategory(cat)));
        } catch (err) { 
             if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
                createApiErrorToast(err, toast, "toastCategoryLoadErrorTitle", "loading", t, `${API_BASE_URL}/categories`); 
             } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) {
                logout();
            }
        }
        finally { setIsCategoriesLoading(false); }

        try {
            setIsAssigneesLoading(true);
            const userResponse = await fetchWithAuth(`${API_BASE_URL}/users`, {}, currentTokenForInitialLoad);
            if (!userResponse.ok) { 
                if (userResponse.status === 401) { logout(); } 
                throw new Error(`Users fetch failed: ${userResponse.statusText}`); 
            }
            const backendUsers: BackendUser[] = await userResponse.json();
            setAllAssignees(backendUsers.map(user => backendToFrontendAssignee(user)));
        } catch (err) { 
             if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
                createApiErrorToast(err, toast, "toastAssigneeLoadErrorTitle", "loading", t, `${API_BASE_URL}/users`); 
             } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) {
                logout();
            }
        }
        finally { setIsAssigneesLoading(false); }

        try {
            setIsHistoryLoading(true);
            const histResponse = await fetchWithAuth(`${API_BASE_URL}/history`, {}, currentTokenForInitialLoad);
            if (!histResponse.ok) { 
                if (histResponse.status === 401) { logout(); } 
                throw new Error(`History fetch failed: ${histResponse.statusText}`); 
            }
            const backendHistoryItems: BackendHistory[] = await histResponse.json();
            setHistoryLog(backendHistoryItems.map(item => backendToFrontendHistory(item)));
        } catch (err) { 
            if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
                createApiErrorToast(err, toast, "historyLoadErrorTitle", "loading", t, `${API_BASE_URL}/history`); 
            } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) {
                logout();
            }
        }
        finally { setIsHistoryLoading(false); }
      } else {
        setIsActivitiesLoading(false); setIsCategoriesLoading(false); setIsAssigneesLoading(false); setIsHistoryLoading(false);
      }
      setIsLoadingState(false); 
    };
    
    loadClientSideDataAndFetchInitial();
  }, [decodeAndSetToken, t, toast, fetchWithAuth, logout, API_BASE_URL]); 


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


 useEffect(() => {
    if (!isLoadingState) { 
      localStorage.setItem(LOCAL_STORAGE_KEY_APP_MODE, appModeState);
      const root = document.documentElement;
      root.classList.remove('mode-personal', 'mode-work');
      root.classList.add(appModeState === 'work' ? 'mode-work' : 'mode-personal');
    }
  }, [appModeState, isLoadingState]);

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
    const handleLogoutMessage = (event: MessageEvent) => { if (event.data === 'logout_event_v2' && isAuthenticated) logout();}; 
    logoutChannel.addEventListener('message', handleLogoutMessage);
    return () => { if (logoutChannel) logoutChannel.removeEventListener('message', handleLogoutMessage);};
  }, [isAuthenticated, logout]);


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
            if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                await navigator.serviceWorker.register('/sw.js', { scope: '/' }); 
                await navigator.serviceWorker.ready; 
                if (navigator.serviceWorker.controller) {
                    setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
                } else {
                    setIsPomodoroReady(false); 
                }
            } else {
                 setIsPomodoroReady(false);
            }
        } catch (error) {
            console.error('Service Worker registration failed:', error);
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
            descriptionKey = (pomodoroCyclesCompleted > 0 && pomodoroCyclesCompleted % 4 === 0) 
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


  const setAppMode = useCallback((mode: AppMode) => {
    if (mode !== appModeState) {
      addHistoryLogEntryRef.current?.(mode === 'personal' ? 'historyLogSwitchToPersonalMode' : 'historyLogSwitchToWorkMode', undefined, 'account');
    }
    setAppModeState(mode);
  }, [appModeState]); 
  
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setError(null);
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    let newAccessToken: string | null = null;

    try {
      const response = await fetch(`${API_BASE_URL}/token`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(formatBackendError(errorData, `Login failed: HTTP ${response.status}`));
      }
      const tokenData: Token = await response.json();
      newAccessToken = tokenData.access_token; 
      await decodeAndSetToken(newAccessToken); 
      
      addHistoryLogEntryRef.current?.('historyLogLogin', undefined, 'account');
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === "granted") {
        const title = t('loginSuccessNotificationTitle');
        const description = t('loginSuccessNotificationDescription');
        stableAddUINotification({ title, description });
        showSystemNotification(title, description);
      }
      if (newAccessToken) {
          try {
              setIsActivitiesLoading(true);
              const actResponse = await fetchWithAuth(`${API_BASE_URL}/activities`, {}, newAccessToken);
              if (!actResponse.ok) { 
                if (actResponse.status === 401) { logout(); } 
                throw new Error(`Activities fetch failed: ${actResponse.statusText}`); 
              }
              const backendActivities: BackendActivity[] = await actResponse.json();
              const newPersonal: Activity[] = [], newWork: Activity[] = [];
              backendActivities.forEach(beAct => {
                  if (!beAct) return;
                  const feAct = backendToFrontendActivity(beAct, beAct.mode as AppMode);
                  if (feAct.appMode === 'personal') newPersonal.push(feAct); else newWork.push(feAct);
              });
              setPersonalActivities(newPersonal); setWorkActivities(newWork);
          } catch (err) { 
             if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
                createApiErrorToast(err, toast, "toastActivityLoadErrorTitle", "loading", t, `${API_BASE_URL}/activities`); 
             } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) {
                logout();
            }
          }
          finally { setIsActivitiesLoading(false); }

          try {
              setIsCategoriesLoading(true);
              const catResponse = await fetchWithAuth(`${API_BASE_URL}/categories`, {}, newAccessToken);
              if (!catResponse.ok) { 
                if (catResponse.status === 401) { logout(); } 
                throw new Error(`Categories fetch failed: ${catResponse.statusText}`); 
              }
              const backendCategories: BackendCategory[] = await catResponse.json();
              setAllCategories(backendCategories.map(cat => backendToFrontendCategory(cat)));
          } catch (err) { 
             if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
                createApiErrorToast(err, toast, "toastCategoryLoadErrorTitle", "loading", t, `${API_BASE_URL}/categories`); 
             } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) {
                logout();
            }
          }
          finally { setIsCategoriesLoading(false); }

          try {
              setIsAssigneesLoading(true);
              const userResponse = await fetchWithAuth(`${API_BASE_URL}/users`, {}, newAccessToken);
              if (!userResponse.ok) { 
                if (userResponse.status === 401) { logout(); } 
                throw new Error(`Users fetch failed: ${userResponse.statusText}`); 
              }
              const backendUsers: BackendUser[] = await userResponse.json();
              setAllAssignees(backendUsers.map(user => backendToFrontendAssignee(user)));
          } catch (err) { 
             if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
                createApiErrorToast(err, toast, "toastAssigneeLoadErrorTitle", "loading", t, `${API_BASE_URL}/users`); 
             } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) {
                logout();
            }
          }
          finally { setIsAssigneesLoading(false); }

          try {
              setIsHistoryLoading(true);
              const histResponse = await fetchWithAuth(`${API_BASE_URL}/history`, {}, newAccessToken);
              if (!histResponse.ok) { 
                if (histResponse.status === 401) { logout(); } 
                throw new Error(`History fetch failed: ${histResponse.statusText}`); 
              }
              const backendHistoryItems: BackendHistory[] = await histResponse.json();
              setHistoryLog(backendHistoryItems.map(item => backendToFrontendHistory(item)));
          } catch (err) { 
            if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
                createApiErrorToast(err, toast, "historyLoadErrorTitle", "loading", t, `${API_BASE_URL}/history`); 
            } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) {
                logout();
            }
          }
          finally { setIsHistoryLoading(false); }
      }
      return true;
    } catch (err) {
      createApiErrorToast(err, toast, "loginErrorTitle", "authenticating", t, `${API_BASE_URL}/token`);
      setError((err as Error).message);
      return false;
    }
  }, [decodeAndSetToken, t, toast, stableAddUINotification, showSystemNotification, fetchWithAuth, logout, API_BASE_URL]); 

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        toast({ variant: "destructive", title: t('loginErrorTitle'), description: "User not identified for password change."});
        return false;
    }
    setError(null);
    const payload = { old_password: oldPassword, new_password: newPassword };
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${currentUserId}/change-password`, {
            method: 'POST', 
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
             if (response.status === 401) { logout(); }
            throw new Error(formatBackendError(errorData, `Password change failed: HTTP ${response.status}`));
        }
        addHistoryLogEntryRef.current?.('historyLogPasswordChangeAttempt', undefined, 'account'); 
        toast({ title: t('passwordUpdateSuccessTitle'), description: t('passwordUpdateSuccessDescription') });
        return true;
    } catch (err) {
        if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
            createApiErrorToast(err, toast, "changePasswordModalTitle", "updating", t, `${API_BASE_URL}/users/${currentUserId}/change-password`);
        } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) {
            logout();
        }
        setError((err as Error).message);
        return false;
    }
  }, [fetchWithAuth, getCurrentUserId, t, toast, logout, API_BASE_URL]);


  const addCategory = useCallback(async (name: string, iconName: string, mode: AppMode | 'all') => {
    setError(null);
    const payload: BackendCategoryCreatePayload = { name, icon_name: iconName, mode: frontendToBackendCategoryMode(mode) };
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/categories`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add category: HTTP ${response.status}`));}
      const newBackendCategory: BackendCategory = await response.json();
      setAllCategories(prev => [...prev, backendToFrontendCategory(newBackendCategory)]);
      toast({ title: t('toastCategoryAddedTitle'), description: t('toastCategoryAddedDescription', { categoryName: name }) });
      addHistoryLogEntryRef.current?.(mode === 'personal' ? 'historyLogAddCategoryPersonal' : mode === 'work' ? 'historyLogAddCategoryWork' : 'historyLogAddCategoryAll', { name }, 'category');
    } catch (err) { if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) { createApiErrorToast(err, toast, "toastCategoryAddedTitle", "adding", t, `${API_BASE_URL}/categories`);} else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } setError((err as Error).message); throw err; }
  }, [fetchWithAuth, toast, t, logout, API_BASE_URL]);

  const updateCategory = useCallback(async (categoryId: number, updates: Partial<Omit<Category, 'id' | 'icon'>>, oldCategoryData?: Category) => {
    setError(null);
    const payload: BackendCategoryUpdatePayload = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.iconName !== undefined) payload.icon_name = updates.iconName;
    if (updates.mode !== undefined) payload.mode = frontendToBackendCategoryMode(updates.mode);

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/categories/${categoryId}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update category: HTTP ${response.status}`));}
      const updatedBackendCategory: BackendCategory = await response.json();
      const updatedFrontendCategory = backendToFrontendCategory(updatedBackendCategory);
      setAllCategories(prev => prev.map(cat => (cat.id === categoryId ? updatedFrontendCategory : cat)));
      toast({ title: t('toastCategoryUpdatedTitle'), description: t('toastCategoryUpdatedDescription', { categoryName: updatedFrontendCategory.name }) });
      let actionKey: HistoryLogActionKey = 'historyLogUpdateCategoryAll';
      if (updatedFrontendCategory.mode === 'personal') actionKey = 'historyLogUpdateCategoryPersonal';
      else if (updatedFrontendCategory.mode === 'work') actionKey = 'historyLogUpdateCategoryWork';
      addHistoryLogEntryRef.current?.(actionKey, { name: updatedFrontendCategory.name, oldName: oldCategoryData?.name !== updatedFrontendCategory.name ? oldCategoryData?.name : undefined , oldMode: oldCategoryData?.mode !== updatedFrontendCategory.mode ? oldCategoryData?.mode : undefined }, 'category');
    } catch (err) { if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {createApiErrorToast(err, toast, "toastCategoryUpdatedTitle", "updating", t, `${API_BASE_URL}/categories/${categoryId}`);} else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } setError((err as Error).message); throw err; }
  }, [fetchWithAuth, toast, t, logout, API_BASE_URL]);

  const deleteCategory = useCallback(async (categoryId: number) => {
    setError(null);
    const categoryToDelete = allCategories.find(cat => cat.id === categoryId);
    if (!categoryToDelete) return; 
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/categories/${categoryId}`, { method: 'DELETE' });
      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete category: HTTP ${response.status}`));}
      setAllCategories(prev => prev.filter(cat => cat.id !== categoryId));
      const updateActivitiesCategory = (acts: Activity[]) => acts.map(act => act.categoryId === categoryId ? { ...act, categoryId: 0 } : act); 
      setPersonalActivities(prev => updateActivitiesCategory(prev));
      setWorkActivities(prev => updateActivitiesCategory(prev));
      toast({ title: t('toastCategoryDeletedTitle'), description: t('toastCategoryDeletedDescription', { categoryName: categoryToDelete.name }) });
      addHistoryLogEntryRef.current?.('historyLogDeleteCategory', { name: categoryToDelete.name, mode: categoryToDelete.mode as string }, 'category');
    } catch (err) { if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) { createApiErrorToast(err, toast, "toastCategoryDeletedTitle", "deleting", t, `${API_BASE_URL}/categories/${categoryId}`);} else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } setError((err as Error).message); throw err; }
  }, [fetchWithAuth, allCategories, toast, t, logout, API_BASE_URL]);

  const addAssignee = useCallback(async (name: string, username: string, password?: string, isAdmin?: boolean) => {
    setError(null);
    if (!password) { 
        toast({variant: "destructive", title: t('loginErrorTitle'), description: "Password is required to create a user."}); 
        throw new Error("Password is required to create a user.");
    }
    const payload: BackendUserCreatePayload = { name, username, password, is_admin: isAdmin || false };

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/users`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add assignee: HTTP ${response.status}`));}
      const newBackendUser: BackendUser = await response.json();
      setAllAssignees(prev => [...prev, backendToFrontendAssignee(newBackendUser)]);
      toast({ title: t('toastAssigneeAddedTitle'), description: t('toastAssigneeAddedDescription', { assigneeName: name }) });
      addHistoryLogEntryRef.current?.('historyLogAddAssignee', { name, isAdmin: newBackendUser.is_admin ? 1 : 0 }, 'assignee');
    } catch (err) { if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {createApiErrorToast(err, toast, "toastAssigneeAddedTitle", "adding", t, `${API_BASE_URL}/users`);} else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } setError((err as Error).message); throw err; }
  }, [fetchWithAuth, toast, t, logout, API_BASE_URL]);

  const updateAssignee = useCallback(async (assigneeId: number, updates: Partial<Pick<Assignee, 'name' | 'username' | 'isAdmin'>>, newPassword?: string) => {
    setError(null);
    const currentAssignee = assignees.find(a => a.id === assigneeId);
    
    const payload: BackendUserUpdatePayload = {};
    if (updates.name) payload.name = updates.name;
    if (updates.username) payload.username = updates.username;
    if (newPassword) payload.password = newPassword; 
    if (updates.isAdmin !== undefined) payload.is_admin = updates.isAdmin;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/users/${assigneeId}`, {
         method: 'PUT',
         body: JSON.stringify(payload) 
      });

      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update assignee: HTTP ${response.status}`));}
      const updatedBackendUser: BackendUser = await response.json();
      const frontendAssignee = backendToFrontendAssignee(updatedBackendUser);
      
      setAllAssignees(prev => prev.map(asg => (asg.id === assigneeId ? frontendAssignee : asg)));
      toast({ title: t('toastAssigneeUpdatedTitle'), description: t('toastAssigneeUpdatedDescription', { assigneeName: updatedBackendUser.name }) });
      
      const historyDetails: Record<string, string | number | undefined> = { name: updatedBackendUser.name };
      if (currentAssignee?.name !== updatedBackendUser.name) historyDetails.oldName = currentAssignee?.name;
      if (updates.username && currentAssignee?.username !== updatedBackendUser.username) {
        historyDetails.oldUsername = currentAssignee?.username;
        historyDetails.newUsername = updatedBackendUser.username;
      }
      if (updates.isAdmin !== undefined && currentAssignee?.isAdmin !== updates.isAdmin) {
        historyDetails.isAdmin = updates.isAdmin ? 1 : 0;
        historyDetails.oldIsAdmin = currentAssignee?.isAdmin ? 1 : 0;
      }
      addHistoryLogEntryRef.current?.('historyLogUpdateAssignee', historyDetails, 'assignee');

    } catch (err) {
        if (!(err instanceof Error && err.message.includes(t('usernameTakenErrorDescription', {username: updates.username || ''})))) {
           if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
            createApiErrorToast(err, toast, "toastAssigneeUpdatedTitle", "updating", t, `${API_BASE_URL}/users/${assigneeId}`);
           } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
        }
        setError((err as Error).message); throw err;
    }
  }, [fetchWithAuth, assignees, toast, t, logout, API_BASE_URL]);

  const deleteAssignee = useCallback(async (assigneeId: number) => {
    setError(null);
    const assigneeToDelete = assignees.find(asg => asg.id === assigneeId);
    if (!assigneeToDelete) return; 
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/users/${assigneeId}`, { method: 'DELETE' });
      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete assignee: HTTP ${response.status}`));}
      setAllAssignees(prev => prev.filter(asg => asg.id !== assigneeId));
      const updateActivities = (acts: Activity[]) =>
        acts.map(act => ({
          ...act,
          responsiblePersonIds: act.responsiblePersonIds?.filter(id => id !== assigneeId)
        }));
      setPersonalActivities(prev => updateActivities(prev));
      setWorkActivities(prev => updateActivities(prev));
      
      toast({ title: t('toastAssigneeDeletedTitle'), description: t('toastAssigneeDeletedDescription', { assigneeName: assigneeToDelete.name }) });
      addHistoryLogEntryRef.current?.('historyLogDeleteAssignee', { name: assigneeToDelete.name }, 'assignee');
    } catch (err) { if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) { createApiErrorToast(err, toast, "toastAssigneeDeletedTitle", "deleting", t, `${API_BASE_URL}/users/${assigneeId}`);} else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } setError((err as Error).message); throw err; }
  }, [fetchWithAuth, assignees, toast, t, logout, API_BASE_URL]);


  const addActivity = useCallback(async (
      activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'completedAt' | 'notes' | 'recurrence' | 'completedOccurrences' | 'responsiblePersonIds' | 'categoryId'| 'appMode'| 'masterActivityId' | 'isRecurringInstance' | 'originalInstanceDate'> & {
        todos?: Omit<Todo, 'id'>[]; time?: string; notes?: string; recurrence?: RecurrenceRule | null; responsiblePersonIds?: number[]; categoryId: number; appMode: AppMode;
      }, customCreatedAt?: number
    ) => {
    setError(null);
    const frontendActivityShell: Activity = {
      id: 0, 
      title: activityData.title,
      categoryId: activityData.categoryId,
      todos: (activityData.todos || []).map(t => ({ id: 0, text: t.text, completed: !!t.completed })), 
      createdAt: customCreatedAt !== undefined ? customCreatedAt : Date.now(), 
      time: activityData.time,
      notes: activityData.notes,
      recurrence: activityData.recurrence,
      responsiblePersonIds: activityData.responsiblePersonIds,
      appMode: activityData.appMode,
      completedOccurrences: {}, 
    };

    const payload = frontendToBackendActivityPayload(frontendActivityShell) as BackendActivityCreatePayload;
    payload.todos = (activityData.todos || []).map(t => ({text: t.text, complete: !!t.completed}));


    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/activities`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add activity: HTTP ${response.status}`));}
      
      const newBackendActivity: BackendActivity | null | undefined = await response.json().catch(() => null);
      const newFrontendActivity = backendToFrontendActivity(newBackendActivity, appModeState); 
      
      if (newFrontendActivity.appMode === 'personal') {
        setPersonalActivities(prev => [...prev, newFrontendActivity]);
      } else {
        setWorkActivities(prev => [...prev, newFrontendActivity]);
      }
      toast({ title: t('toastActivityAddedTitle'), description: t('toastActivityAddedDescription') });
      addHistoryLogEntryRef.current?.(newFrontendActivity.appMode === 'personal' ? 'historyLogAddActivityPersonal' : 'historyLogAddActivityWork', { title: newFrontendActivity.title }, newFrontendActivity.appMode);
    } catch (err) { if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) { createApiErrorToast(err, toast, "toastActivityAddedTitle", "adding", t, `${API_BASE_URL}/activities`);} else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } setError((err as Error).message); throw err; }
  }, [fetchWithAuth, appModeState, toast, t, logout, API_BASE_URL]);

 const updateActivity = useCallback(async (activityId: number, updates: Partial<Omit<Activity, 'id' | 'todos'>>, originalActivity?: Activity) => {
    setError(null);
    let currentActivitiesList = personalActivities.find(a => a.id === activityId) ? personalActivities : workActivities;
    let activityToUpdate = currentActivitiesList.find(a => a.id === activityId);
    let targetSetter = personalActivities.find(a => a.id === activityId) ? setPersonalActivities : setWorkActivities;

    if (!activityToUpdate) {
      console.error("[AppProvider] Activity not found for update:", activityId);
      toast({variant: "destructive", title: "Error", description: "Activity not found for update."});
      return;
    }
    
    const effectiveAppMode = updates.appMode || activityToUpdate.appMode;
    const payload = frontendToBackendActivityPayload({ ...activityToUpdate, ...updates, appMode: effectiveAppMode }, true) as BackendActivityUpdatePayload;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update activity: HTTP ${response.status}`));}
      const updatedBackendActivity: BackendActivity = await response.json();
      
      let processedActivityFromBackend = backendToFrontendActivity(updatedBackendActivity, appModeState);
      
      const finalFrontendActivity = {
        ...activityToUpdate, 
        ...processedActivityFromBackend, 
        todos: activityToUpdate.todos || [], 
        completedOccurrences: updates.completedOccurrences || activityToUpdate.completedOccurrences || {},
        completed: updates.completed !== undefined ? updates.completed : activityToUpdate.completed,
        completedAt: updates.completedAt !== undefined ? updates.completedAt : activityToUpdate.completedAt,
        appMode: processedActivityFromBackend.appMode || updates.appMode || activityToUpdate.appMode,
      };

      if (originalActivity && finalFrontendActivity.appMode !== originalActivity.appMode) {
        if (originalActivity.appMode === 'personal') setPersonalActivities(prev => prev.filter(act => act.id !== activityId));
        else setWorkActivities(prev => prev.filter(act => act.id !== activityId));
        if (finalFrontendActivity.appMode === 'personal') setPersonalActivities(prev => [...prev, finalFrontendActivity]);
        else setWorkActivities(prev => [...prev, finalFrontendActivity]);
      } else {
         targetSetter(prev => prev.map(act => (act.id === activityId ? finalFrontendActivity : act)));
      }

      toast({ title: t('toastActivityUpdatedTitle'), description: t('toastActivityUpdatedDescription') });
      addHistoryLogEntryRef.current?.(finalFrontendActivity.appMode === 'personal' ? 'historyLogUpdateActivityPersonal' : 'historyLogUpdateActivityWork', { title: finalFrontendActivity.title }, finalFrontendActivity.appMode);
    } catch (err) { if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {createApiErrorToast(err, toast, "toastActivityUpdatedTitle", "updating", t, `${API_BASE_URL}/activities/${activityId}`);} else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } setError((err as Error).message); throw err; }
  }, [fetchWithAuth, appModeState, personalActivities, workActivities, toast, t, logout, API_BASE_URL]);

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
      console.error("[AppProvider] Activity not found for deletion:", activityId);
      toast({variant: "destructive", title: "Error", description: "Activity not found for deletion."});
      return;
    }

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}`, { method: 'DELETE' });
      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete activity: HTTP ${response.status}`));}
      setter(prev => prev.filter(act => act.id !== activityId));
      toast({ title: t('toastActivityDeletedTitle'), description: t('toastActivityDeletedDescription', { activityTitle: activityToDelete.title }) });
      addHistoryLogEntryRef.current?.(modeForLog === 'personal' ? 'historyLogDeleteActivityPersonal' : 'historyLogDeleteActivityWork', { title: activityToDelete.title }, modeForLog);
    } catch (err) { if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {createApiErrorToast(err, toast, "toastActivityDeletedTitle", "deleting", t, `${API_BASE_URL}/activities/${activityId}`);} else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } setError((err as Error).message); throw err; }
  }, [fetchWithAuth, personalActivities, workActivities, toast, t, logout, API_BASE_URL]);


  const addTodoToActivity = useCallback(async (activityId: number, todoText: string, completed: boolean = false): Promise<Todo | null> => {
    setError(null);
    const payload: BackendTodoCreate = { text: todoText, complete: completed };
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}/todos`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add todo: HTTP ${response.status}`));}
      const newBackendTodo: BackendTodo = await response.json();
      const newFrontendTodo: Todo = {
        id: newBackendTodo.id, 
        text: newBackendTodo.text,
        completed: newBackendTodo.complete 
      };

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
      return newFrontendTodo;
    } catch (err) { 
        if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
            createApiErrorToast(err, toast, "toastTodoAddedTitle", "adding", t, `${API_BASE_URL}/activities/${activityId}/todos`);
        } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
        setError((err as Error).message); 
        return null; 
    }
  }, [fetchWithAuth, personalActivities, workActivities, toast, t, logout, API_BASE_URL]); 

  const updateTodoInActivity = useCallback(async (activityId: number, todoId: number, updates: Partial<Todo>) => {
    setError(null);
    const payload: Partial<BackendTodo> = {}; 
    if (updates.text !== undefined) payload.text = updates.text;
    if (updates.completed !== undefined) payload.complete = updates.completed;

    if (Object.keys(payload).length === 0) return; 

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/todos/${todoId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            if (response.status === 401) { logout(); }
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(formatBackendError(errorData, `Failed to update todo: HTTP ${response.status}`));
        }
        const updatedBackendTodo: BackendTodo = await response.json();
        const updatedFrontendTodo: Todo = {
            id: updatedBackendTodo.id,
            text: updatedBackendTodo.text,
            completed: updatedBackendTodo.complete
        };

        const updateInList = (list: Activity[], setter: React.Dispatch<React.SetStateAction<Activity[]>>) => {
            const activityIndex = list.findIndex(act => act.id === activityId);
            if (activityIndex !== -1) {
                const updatedTodos = list[activityIndex].todos.map(todo =>
                    todo.id === todoId ? updatedFrontendTodo : todo
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
    } catch (err) {
        if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
            createApiErrorToast(err, toast, "toastTodoUpdatedTitle", "updating", t, `${API_BASE_URL}/todos/${todoId}`);
        } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
        setError((err as Error).message);
        throw err;
    }
  }, [fetchWithAuth, personalActivities, workActivities, t, toast, logout, API_BASE_URL]); 

  const deleteTodoFromActivity = useCallback(async (activityId: number, todoId: number) => {
    setError(null);
    const todoToDelete =
      personalActivities.find(act => act.id === activityId)?.todos.find(t => t.id === todoId) ||
      workActivities.find(act => act.id === activityId)?.todos.find(t => t.id === todoId);

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/todos/${todoId}`, { method: 'DELETE' });
      if (!response.ok) { if (response.status === 401) { logout(); } const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete todo: HTTP ${response.status}`));}
      
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
    } catch (err) { if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) { createApiErrorToast(err, toast, "toastTodoDeletedTitle", "deleting", t, `${API_BASE_URL}/todos/${todoId}`);} else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } setError((err as Error).message); throw err; }
  }, [fetchWithAuth, personalActivities, workActivities, toast, t, logout, API_BASE_URL]); 

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
    addHistoryLogEntryRef.current?.(modeForLog === 'personal' ? 'historyLogToggleActivityCompletionPersonal' : 'historyLogToggleActivityCompletionWork', { title: activityTitleForLog, completed: completedState ? 1 : 0 }, modeForLog);
  }, [personalActivities, workActivities]); 

 const fetchAndSetSpecificActivityDetails = useCallback(async (activityId: number): Promise<Activity | null> => {
    try {
        const activityResponse = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}`);
        if (!activityResponse.ok) {
            if (activityResponse.status === 401) { logout(); }
            const errorData = await activityResponse.json().catch(() => ({ detail: `HTTP ${activityResponse.status}: ${activityResponse.statusText}` }));
            throw new Error(formatBackendError(errorData, `Failed to fetch activity details for ID ${activityId}.`));
        }
        const backendActivity: BackendActivity = await activityResponse.json();
        const frontendActivityShell = backendToFrontendActivity(backendActivity, appModeState);

        let fetchedApiTodos: BackendTodo[] = [];
        try {
            const todosResponse = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}/todos`);
            if (todosResponse.ok) {
                fetchedApiTodos = await todosResponse.json();
            } else {
                console.warn(`[AppProvider] Failed to fetch todos for activity ${activityId} from sub-endpoint: HTTP ${todosResponse.status}`);
            }
        } catch (todoError) {
            console.warn(`[AppProvider] Error fetching todos for activity ${activityId} from sub-endpoint:`, todoError);
        }

        const frontendTodos: Todo[] = fetchedApiTodos.map(bt => ({
            id: bt.id,
            text: bt.text,
            completed: bt.complete,
        }));
        frontendActivityShell.todos = frontendTodos; // Override with todos from the dedicated endpoint

        const setter = frontendActivityShell.appMode === 'personal' ? setPersonalActivities : setWorkActivities;
        
        setter(prevActivities => {
            const existingActivity = prevActivities.find(act => act.id === activityId);
            if (existingActivity) {
                const updatedActivity = {
                    ...existingActivity, 
                    ...frontendActivityShell, 
                };
                return prevActivities.map(act => act.id === activityId ? updatedActivity : act);
            }
            return [...prevActivities, frontendActivityShell]; 
        });
        return frontendActivityShell;
    } catch (err) {
         if (!(err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401')))) {
            createApiErrorToast(err, toast, "toastActivityLoadErrorTitle", "loading", t, `${API_BASE_URL}/activities/${activityId}`);
         } else if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
        return null;
    }
  }, [fetchWithAuth, appModeState, API_BASE_URL, t, toast, logout]);


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

  const contextValue = useMemo(() => ({
    activities: getRawActivities(), getRawActivities, categories: filteredCategories, assignees: assigneesForContext, appMode: appModeState, setAppMode,
    addActivity, updateActivity, deleteActivity, toggleOccurrenceCompletion,
    addTodoToActivity, updateTodoInActivity, deleteTodoFromActivity,
    getCategoryById, addCategory, updateCategory, deleteCategory,
    addAssignee, updateAssignee, deleteAssignee, getAssigneeById,
    isLoading: combinedIsLoading, error,
    isAuthenticated, login, logout, changePassword, getCurrentUserId,
    uiNotifications, addUINotification: stableAddUINotification, markUINotificationAsRead, markAllUINotificationsAsRead, clearAllUINotifications,
    historyLog, addHistoryLogEntry,
    systemNotificationPermission, requestSystemNotificationPermission,
    pomodoroPhase, pomodoroTimeRemaining, pomodoroIsRunning, pomodoroCyclesCompleted,
    startPomodoroWork, startPomodoroShortBreak, startPomodoroLongBreak, pausePomodoro, resumePomodoro, resetPomodoro, isPomodoroReady,
    isAppLocked, appPinState, unlockApp, setAppPin,
    fetchAndSetSpecificActivityDetails,
  }), [
    getRawActivities, filteredCategories, assigneesForContext, appModeState, setAppMode, addActivity, updateActivity, deleteActivity, toggleOccurrenceCompletion,
    addTodoToActivity, updateTodoInActivity, deleteTodoFromActivity, getCategoryById, addCategory, updateCategory, deleteCategory, addAssignee, updateAssignee, deleteAssignee,
    getAssigneeById, combinedIsLoading, error, isAuthenticated, login, logout, changePassword, getCurrentUserId, uiNotifications, stableAddUINotification, markUINotificationAsRead,
    markAllUINotificationsAsRead, clearAllUINotifications, historyLog, addHistoryLogEntry, systemNotificationPermission, requestSystemNotificationPermission, pomodoroPhase,
    pomodoroTimeRemaining, pomodoroIsRunning, pomodoroCyclesCompleted, startPomodoroWork, startPomodoroShortBreak, startPomodoroLongBreak, pausePomodoro, resumePomodoro,
    resetPomodoro, isPomodoroReady, isAppLocked, appPinState, unlockApp, setAppPin, fetchAndSetSpecificActivityDetails
  ]);


  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
