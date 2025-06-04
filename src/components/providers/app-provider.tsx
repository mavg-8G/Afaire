
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  Activity, Todo, Category, AppMode, RecurrenceRule, UINotification, HistoryLogEntry, HistoryLogActionKey, Translations, Assignee, PomodoroPhase,
  BackendCategoryCreatePayload, BackendCategory, BackendUser, BackendUserCreatePayload, BackendUserUpdatePayload,
  BackendActivityCreatePayload, BackendActivityUpdatePayload, BackendActivity, BackendTodoCreate, BackendHistory,
  RecurrenceType, BackendCategoryMode, BackendRepeatMode, BackendTodo,
  Token, DecodedToken, BackendHistoryCreatePayload, BackendCategoryUpdatePayload, AppContextType as AppContextTypeImport,
  BackendActivityListItem, BackendActivityOccurrence, BackendActivityOccurrenceCreate, BackendActivityOccurrenceUpdate
} from '@/lib/types';
import { DEFAULT_JWT_SECRET_KEY, POMODORO_WORK_DURATION_SECONDS, POMODORO_SHORT_BREAK_DURATION_SECONDS, POMODORO_LONG_BREAK_DURATION_SECONDS, DEFAULT_API_BASE_URL } from '@/lib/constants';
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

const envApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const API_BASE_URL = (envApiBaseUrl && envApiBaseUrl.trim() !== '') ? envApiBaseUrl : DEFAULT_API_BASE_URL;
const JWT_SECRET_KEY_FOR_DECODING = process.env.NEXT_PUBLIC_JWT_SECRET_KEY || DEFAULT_JWT_SECRET_KEY;


export type AppContextType = AppContextTypeImport;


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

const backendToFrontendActivity = (
  backendActivityInput: BackendActivity | BackendActivityListItem | null | undefined,
  currentAppMode: AppMode
): Activity => {
   const backendActivity = backendActivityInput as (BackendActivity & BackendActivityListItem);

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
    endDate: backendActivity.end_date ? parseISO(backendActivity.end_date.toString()).getTime() : null,
    daysOfWeek: daysOfWeekArray.length > 0 ? daysOfWeekArray : undefined,
    dayOfMonth: backendActivity.day_of_month ?? undefined,
  };

  let todosFromBackend: Todo[] = [];
  if (Array.isArray(backendActivity.todos)) {
    backendActivity.todos.forEach((bt: BackendTodo, index: number) => {
        const todoId = typeof bt?.id === 'number' ? bt.id : Date.now() + Math.random() + index;
        if (typeof bt?.id !== 'number') {
            console.warn(`[AppProvider] Warning: Todo at index ${index} for activity ID ${activityIdForLog} is missing a valid 'id' from backend. Using temporary ID ${todoId}. Backend todo:`, bt);
        }
        todosFromBackend.push({
          id: todoId,
          text: bt?.text || 'Untitled Todo from Backend',
          completed: bt?.complete || false,
        });
      });
  } else if (backendActivity.todos !== undefined && backendActivity.todos !== null) {
     console.warn(`[AppProvider] Warning: backendActivity.todos is not an array for activity ID ${activityIdForLog}. Defaulting to empty array. Received:`, backendActivity.todos);
  }

  let responsiblePersonIdsProcessed: number[] = [];
  if (Array.isArray(backendActivity.responsibles)) { // From rich BackendActivity
    responsiblePersonIdsProcessed = backendActivity.responsibles.map(r => r.id);
  } else if (Array.isArray(backendActivity.responsible_ids)) { // From BackendActivityListItem / ActivityResponse
    responsiblePersonIdsProcessed = backendActivity.responsible_ids;
  }

  let categoryIdToUse = 0;
  if (backendActivity.category && typeof backendActivity.category.id === 'number') { // From rich BackendActivity
      categoryIdToUse = backendActivity.category.id;
  } else if (typeof backendActivity.category_id === 'number') { // From BackendActivityListItem / ActivityResponse or fallback
      categoryIdToUse = backendActivity.category_id;
  } else {
      console.warn(`[AppProvider] Warning: Could not determine categoryId for activity ID ${activityIdForLog}. Defaulting to 0. Received category_id: ${backendActivity.category_id}, Received category object:`, backendActivity.category);
  }

  const idToUse = typeof backendActivity?.id === 'number' ? backendActivity.id : Date.now() + Math.random();
  if (typeof backendActivity?.id !== 'number') {
      console.error(`[AppProvider] CRITICAL: Backend activity response did not contain a valid 'id'. Using fallback ID ${idToUse}. Received:`, typeof backendActivity === 'object' ? JSON.stringify(backendActivity) : backendActivity);
  }

  const completedOccurrencesMap: Record<string, boolean> = {};
  if (Array.isArray(backendActivity.occurrences)) {
    backendActivity.occurrences.forEach(occ => {
        try {
            const dateKey = formatISO(parseISO(occ.date), { representation: 'date' });
            completedOccurrencesMap[dateKey] = occ.complete;
        } catch (e) {
            console.warn(`[AppProvider] Failed to parse occurrence date for activity ${activityIdForLog}: ${occ.date}`, e);
        }
    });
  }


  return {
    id: idToUse,
    title: backendActivity?.title || 'Untitled Activity',
    categoryId: categoryIdToUse,
    todos: todosFromBackend,
    createdAt: createdAtTimestamp,
    time: backendActivity?.time || "00:00",
    notes: backendActivity?.notes ?? undefined,
    recurrence: recurrenceRule.type === 'none' ? { type: 'none' } : recurrenceRule,
    completedOccurrences: completedOccurrencesMap,
    responsiblePersonIds: responsiblePersonIdsProcessed,
    appMode: (backendActivity?.mode === 'both' ? currentAppMode : (backendActivity?.mode || currentAppMode)) as AppMode,
  };
};

const frontendToBackendActivityPayload = (
  activity: Omit<Activity, 'id' | 'completedOccurrences' | 'isRecurringInstance' | 'originalInstanceDate' | 'masterActivityId'> & { todos?: BackendTodoCreate[] },
  isUpdate: boolean = false
): Partial<BackendActivityCreatePayload | BackendActivityUpdatePayload> => {
  const payload: Partial<BackendActivityCreatePayload & BackendActivityUpdatePayload> = {
    title: activity.title,
    // Ensure date is sent as YYYY-MM-DDTHH:MM:SS for backend datetime fields
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
    (payload as BackendActivityCreatePayload).todos = activity.todos.map(t => ({ text: t.text, complete: !!t.completed }));
  } else if (!isUpdate) {
    (payload as BackendActivityCreatePayload).todos = [];
  }

  return payload;
};

const backendToFrontendHistory = (backendHistory: BackendHistory): HistoryLogEntry => ({
  id: backendHistory.id,
  timestamp: parseISO(backendHistory.timestamp).getTime(),
  actionKey: backendHistory.action as HistoryLogActionKey, // This might need more robust mapping if actions change
  backendAction: backendHistory.action,
  backendUserId: backendHistory.user_id,
  scope: 'account', // Default, can be refined if backend provides more scope info
  details: { rawBackendAction: backendHistory.action } // Store raw action for debugging/future use
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
  const postToServiceWorkerRef = useRef<(message: any) => void>(() => {});


  const [isAppLocked, setIsAppLocked] = useState(false);
  const [appPinState, setAppPinState] = useState<string | null>(null);

  const isAuthenticated = !!jwtToken;

  const addHistoryLogEntryRef = useRef<((actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined | null>, scope?: HistoryLogEntry['scope']) => Promise<void>) | null>(null);


  const getCurrentUserId = useCallback((): number | null => {
    return decodedJwt?.userId ? decodedJwt.userId : (decodedJwt?.sub ? parseInt(decodedJwt.sub, 10) : null);
  }, [decodedJwt]);

  const decodeAndSetToken = useCallback(async (tokenData: Token | null) => {
    if (!tokenData || !tokenData.access_token) {
      setJwtToken(null);
      setDecodedJwt(null);
      if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_STORAGE_KEY_JWT);
      return;
    }
    try {
      const secret = new TextEncoder().encode(JWT_SECRET_KEY_FOR_DECODING);
      const { payload } = await jose.jwtVerify(tokenData.access_token, secret, { algorithms: ['HS256'] });

      setJwtToken(tokenData.access_token);
      setDecodedJwt({
        sub: payload.sub!,
        exp: payload.exp!,
        userId: tokenData.user_id, // Store directly from tokenData
        username: tokenData.username, // Store directly
        isAdmin: tokenData.is_admin, // Store directly
      });
      if (typeof window !== 'undefined') localStorage.setItem(LOCAL_STORAGE_KEY_JWT, tokenData.access_token);
    } catch (err) {
      const error = err as Error;
      console.error("[AppProvider] Failed to verify/decode JWT:", error.message, error.name, error.stack);
      if (error.name === 'JWTExpired') {
        toast({ variant: "destructive", title: "Session Expired", description: "Your session has expired. Please log in again."});
      }
      setJwtToken(null);
      setDecodedJwt(null);
      if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_STORAGE_KEY_JWT);
    }
  }, [JWT_SECRET_KEY_FOR_DECODING, toast]);

  useEffect(() => {
    const postToServiceWorkerLogic = (message: any) => {
      if (typeof window !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({...message, payload: { ...message.payload, locale } });
      } else if (typeof window !== 'undefined'){
        if (message.type !== 'GET_INITIAL_STATE' && !isPomodoroReady) {
          toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: t('pomodoroSWNotReady') as string });
        }
      }
    };
    postToServiceWorkerRef.current = postToServiceWorkerLogic;
  }, [locale, t, toast, isPomodoroReady]);


  const startPomodoroWork = useCallback(() => postToServiceWorkerRef.current({ type: 'START_WORK', payload: { cyclesCompleted: pomodoroCyclesCompleted } }), [pomodoroCyclesCompleted]);
  const startPomodoroShortBreak = useCallback(() => postToServiceWorkerRef.current({ type: 'START_SHORT_BREAK' }), []);
  const startPomodoroLongBreak = useCallback(() => postToServiceWorkerRef.current({ type: 'START_LONG_BREAK' }), []);
  const pausePomodoro = useCallback(() => postToServiceWorkerRef.current({ type: 'PAUSE_TIMER' }), []);
  const resumePomodoro = useCallback(() => postToServiceWorkerRef.current({ type: 'RESUME_TIMER' }), []);
  const resetPomodoro = useCallback(() => {
    setIsPomodoroReady(false);
    postToServiceWorkerRef.current({ type: 'RESET_TIMER' });
  }, []);


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
  }, [jwtToken]);

  const addHistoryLogEntry = useCallback(async (actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined | null>, scope: HistoryLogEntry['scope'] = 'account') => {
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
  }, [fetchWithAuth, getCurrentUserId, t, toast]);

  useEffect(() => { addHistoryLogEntryRef.current = addHistoryLogEntry;}, [addHistoryLogEntry]);

  const logout = useCallback(() => {
    addHistoryLogEntryRef.current?.('historyLogLogout', undefined, 'account');
    decodeAndSetToken(null);
    setIsAppLocked(false);

    setPersonalActivities([]);
    setWorkActivities([]);
    setAllCategories([]);
    setAllAssignees([]);
    setHistoryLog([]);
    setUINotifications([]);

    postToServiceWorkerRef.current({ type: 'RESET_TIMER' });
    if (logoutChannel) logoutChannel.postMessage('logout_event_v2');
  }, [decodeAndSetToken]);

  useEffect(() => {
    const loadClientSideDataAndFetchInitial = async () => {
      setIsLoadingState(true);
      setIsActivitiesLoading(true);
      setIsCategoriesLoading(true);
      setIsAssigneesLoading(true);
      setIsHistoryLoading(true);

      const storedAppMode = localStorage.getItem(LOCAL_STORAGE_KEY_APP_MODE) as AppMode | null;
      if (storedAppMode && (storedAppMode === 'personal' || storedAppMode === 'work')) setAppModeState(storedAppMode);

      const storedTokenString = localStorage.getItem(LOCAL_STORAGE_KEY_JWT);
      let currentTokenForInitialLoad: string | null = null;

      if (storedTokenString) {
          const tempTokenData: Token = { // Create a dummy Token object to pass to decodeAndSetToken
              access_token: storedTokenString,
              token_type: 'bearer',
              user_id: 0, username: '', is_admin: false // These values will be overridden by decodeAndSetToken
          };
          await decodeAndSetToken(tempTokenData);
          currentTokenForInitialLoad = storedTokenString; // Use the original token for API calls
      }

      const storedUINotifications = localStorage.getItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS);
      if (storedUINotifications) setUINotifications(JSON.parse(storedUINotifications));
      if (typeof window !== 'undefined' && 'Notification' in window) setSystemNotificationPermission(Notification.permission);

      const storedPin = localStorage.getItem(LOCAL_STORAGE_KEY_APP_PIN);
      if (storedPin) {
        setAppPinState(storedPin);
        if (currentTokenForInitialLoad) setIsAppLocked(true);
      }

      if (currentTokenForInitialLoad) {
        try {
            const [actResponse, catResponse, userResponse, histResponse, occurrencesResponse] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/activities`, {}, currentTokenForInitialLoad),
                fetchWithAuth(`${API_BASE_URL}/categories`, {}, currentTokenForInitialLoad),
                fetchWithAuth(`${API_BASE_URL}/users`, {}, currentTokenForInitialLoad),
                fetchWithAuth(`${API_BASE_URL}/history`, {}, currentTokenForInitialLoad),
                fetchWithAuth(`${API_BASE_URL}/activity-occurrences`, {}, currentTokenForInitialLoad)
            ]);

            if (!actResponse.ok) throw new Error(`Activities fetch failed: HTTP ${actResponse.status} ${actResponse.statusText}`);
            const backendActivitiesList: BackendActivityListItem[] = await actResponse.json();

            if (!catResponse.ok) throw new Error(`Categories fetch failed: HTTP ${catResponse.status} ${catResponse.statusText}`);
            const backendCategories: BackendCategory[] = await catResponse.json();
            setAllCategories(backendCategories.map(cat => backendToFrontendCategory(cat)));
            setIsCategoriesLoading(false);

            if (!userResponse.ok) throw new Error(`Users fetch failed: HTTP ${userResponse.status} ${userResponse.statusText}`);
            const backendUsers: BackendUser[] = await userResponse.json();
            setAllAssignees(backendUsers.map(user => backendToFrontendAssignee(user)));
            setIsAssigneesLoading(false);

            if (!histResponse.ok) throw new Error(`History fetch failed: HTTP ${histResponse.status} ${histResponse.statusText}`);
            const backendHistoryItems: BackendHistory[] = await histResponse.json();
            setHistoryLog(backendHistoryItems.map(item => backendToFrontendHistory(item)));
            setIsHistoryLoading(false);

            let allOccurrences: BackendActivityOccurrence[] = [];
            if (occurrencesResponse.ok) {
                allOccurrences = await occurrencesResponse.json();
            } else {
                console.warn(`[AppProvider] Failed to fetch all occurrences: HTTP ${occurrencesResponse.status}`);
            }

            const newPersonal: Activity[] = [], newWork: Activity[] = [];
            backendActivitiesList.forEach(beListItem => {
                if (!beListItem) return;
                let feAct = backendToFrontendActivity(beListItem, appModeState);
                // Populate completedOccurrences from allOccurrences
                const activityOccurrences = allOccurrences.filter(occ => occ.activity_id === feAct.id);
                const occurrencesMap: Record<string, boolean> = {};
                activityOccurrences.forEach(occ => {
                     try {
                        const dateKey = formatISO(parseISO(occ.date), { representation: 'date' });
                        occurrencesMap[dateKey] = occ.complete;
                    } catch (e) {
                        console.warn(`[AppProvider] Failed to parse occurrence date for activity ${feAct.id}: ${occ.date}`, e);
                    }
                });
                feAct.completedOccurrences = occurrencesMap;

                if (feAct.appMode === 'personal') newPersonal.push(feAct); else newWork.push(feAct);
            });
            setPersonalActivities(newPersonal); setWorkActivities(newWork);

        } catch (err) {
            if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
            else { createApiErrorToast(err, toast, "toastActivityLoadErrorTitle", "loading", t, `${API_BASE_URL}/activities`);}
        } finally {
            setIsActivitiesLoading(false);
            setIsCategoriesLoading(isCategoriesLoading && !allCategories.length); // only true if still loading and no cats
            setIsAssigneesLoading(isAssigneesLoading && !assignees.length);
            setIsHistoryLoading(isHistoryLoading && !historyLog.length);
        }
      } else {
        setIsActivitiesLoading(false); setIsCategoriesLoading(false); setIsAssigneesLoading(false); setIsHistoryLoading(false);
      }
      setIsLoadingState(false);
    };

    loadClientSideDataAndFetchInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodeAndSetToken, t, toast, fetchWithAuth, API_BASE_URL, appModeState]);


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
                    setTimeout(() => postToServiceWorkerRef.current({ type: 'GET_INITIAL_STATE' }), 200);
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
                setTimeout(() => postToServiceWorkerRef.current({ type: 'GET_INITIAL_STATE' }), 200);
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
             setTimeout(() => postToServiceWorkerRef.current({ type: 'GET_INITIAL_STATE' }), 200);
        }

    } else {
        setIsPomodoroReady(false);
    }

    return () => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.removeEventListener('message', handleSWMessage);
        }
    };
  }, [handleSWMessage, t, toast]);

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
      addHistoryLogEntryRef.current?.('historyLogSwitchMode', { newMode: mode.charAt(0).toUpperCase() + mode.slice(1), oldMode: appModeState.charAt(0).toUpperCase() + appModeState.slice(1) }, 'account');
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
      await decodeAndSetToken(tokenData);
      newAccessToken = tokenData.access_token;

      addHistoryLogEntryRef.current?.('historyLogLogin', { username: tokenData.username }, 'account');
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === "granted") {
        const title = t('loginSuccessNotificationTitle');
        const description = t('loginSuccessNotificationDescription');
        stableAddUINotification({ title, description });
        showSystemNotification(title, description);
      }
      if (newAccessToken) {
          try {
              setIsActivitiesLoading(true);
              setIsCategoriesLoading(true);
              setIsAssigneesLoading(true);
              setIsHistoryLoading(true);

              const [actResponse, catResponse, userResponse, histResponse, occurrencesResponse] = await Promise.all([
                  fetchWithAuth(`${API_BASE_URL}/activities`, {}, newAccessToken),
                  fetchWithAuth(`${API_BASE_URL}/categories`, {}, newAccessToken),
                  fetchWithAuth(`${API_BASE_URL}/users`, {}, newAccessToken),
                  fetchWithAuth(`${API_BASE_URL}/history`, {}, newAccessToken),
                  fetchWithAuth(`${API_BASE_URL}/activity-occurrences`, {}, newAccessToken)
              ]);

              if (!actResponse.ok) throw new Error(`Activities fetch failed: HTTP ${actResponse.status} ${actResponse.statusText}`);
              const backendActivitiesList: BackendActivityListItem[] = await actResponse.json();

              if (!catResponse.ok) throw new Error(`Categories fetch failed: HTTP ${catResponse.status} ${catResponse.statusText}`);
              const backendCategories: BackendCategory[] = await catResponse.json();
              setAllCategories(backendCategories.map(cat => backendToFrontendCategory(cat)));
              setIsCategoriesLoading(false);

              if (!userResponse.ok) throw new Error(`Users fetch failed: HTTP ${userResponse.status} ${userResponse.statusText}`);
              const backendUsers: BackendUser[] = await userResponse.json();
              setAllAssignees(backendUsers.map(user => backendToFrontendAssignee(user)));
              setIsAssigneesLoading(false);

              if (!histResponse.ok) throw new Error(`History fetch failed: HTTP ${histResponse.status} ${histResponse.statusText}`);
              const backendHistoryItems: BackendHistory[] = await histResponse.json();
              setHistoryLog(backendHistoryItems.map(item => backendToFrontendHistory(item)));
              setIsHistoryLoading(false);

              let allOccurrences: BackendActivityOccurrence[] = [];
              if (occurrencesResponse.ok) {
                  allOccurrences = await occurrencesResponse.json();
              } else {
                  console.warn(`[AppProvider] Failed to fetch all occurrences after login: HTTP ${occurrencesResponse.status}`);
              }

              const newPersonal: Activity[] = [], newWork: Activity[] = [];
              backendActivitiesList.forEach(beListItem => {
                  if (!beListItem) return;
                  let feAct = backendToFrontendActivity(beListItem, appModeState);
                  const activityOccurrences = allOccurrences.filter(occ => occ.activity_id === feAct.id);
                  const occurrencesMap: Record<string, boolean> = {};
                  activityOccurrences.forEach(occ => {
                     try {
                        const dateKey = formatISO(parseISO(occ.date), { representation: 'date' });
                        occurrencesMap[dateKey] = occ.complete;
                    } catch (e) {
                        console.warn(`[AppProvider] Failed to parse occurrence date for activity ${feAct.id} after login: ${occ.date}`, e);
                    }
                  });
                  feAct.completedOccurrences = occurrencesMap;
                  if (feAct.appMode === 'personal') newPersonal.push(feAct); else newWork.push(feAct);
              });
              setPersonalActivities(newPersonal); setWorkActivities(newWork);

          } catch (err) {
             if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
             else { createApiErrorToast(err, toast, "toastActivityLoadErrorTitle", "loading", t, `${API_BASE_URL}/activities`); }
          }
          finally {
            setIsActivitiesLoading(false);
            setIsCategoriesLoading(isCategoriesLoading && !allCategories.length);
            setIsAssigneesLoading(isAssigneesLoading && !assignees.length);
            setIsHistoryLoading(isHistoryLoading && !historyLog.length);
          }
      }
      return true;
    } catch (err) {
      createApiErrorToast(err, toast, "loginErrorTitle", "authenticating", t, `${API_BASE_URL}/token`);
      setError((err as Error).message);
      return false;
    }
  }, [API_BASE_URL, decodeAndSetToken, t, toast, stableAddUINotification, showSystemNotification, fetchWithAuth, appModeState, logout]);

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
            throw new Error(formatBackendError(errorData, `Password change failed: HTTP ${response.status}`));
        }
        addHistoryLogEntryRef.current?.('historyLogPasswordChangeAttempt', { userId: currentUserId }, 'account');
        toast({ title: t('passwordUpdateSuccessTitle'), description: t('passwordUpdateSuccessDescription') });
        return true;
    } catch (err) {
        if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
        else { createApiErrorToast(err, toast, "changePasswordModalTitle", "updating", t, `${API_BASE_URL}/users/${currentUserId}/change-password`); }
        setError((err as Error).message);
        return false;
    }
  }, [API_BASE_URL, fetchWithAuth, getCurrentUserId, t, toast, logout]);


  const addCategory = useCallback(async (name: string, iconName: string, mode: AppMode | 'all') => {
    setError(null);
    const payload: BackendCategoryCreatePayload = { name, icon_name: iconName, mode: frontendToBackendCategoryMode(mode) };
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/categories`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add category: HTTP ${response.status}`));}
      const newBackendCategory: BackendCategory = await response.json();
      setAllCategories(prev => [...prev, backendToFrontendCategory(newBackendCategory)]);
      toast({ title: t('toastCategoryAddedTitle'), description: t('toastCategoryAddedDescription', { categoryName: name }) });
      addHistoryLogEntryRef.current?.('historyLogAddCategory', { name, iconName, mode, categoryId: newBackendCategory.id }, 'category');
    } catch (err) { if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } else {createApiErrorToast(err, toast, "toastCategoryAddedTitle", "adding", t, `${API_BASE_URL}/categories`);} setError((err as Error).message); throw err; }
  }, [API_BASE_URL, fetchWithAuth, toast, t, logout]);

  const updateCategory = useCallback(async (categoryId: number, updates: Partial<Omit<Category, 'id' | 'icon'>>, oldCategoryData?: Category) => {
    setError(null);
    const payload: BackendCategoryUpdatePayload = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.iconName !== undefined) payload.icon_name = updates.iconName;
    if (updates.mode !== undefined) payload.mode = frontendToBackendCategoryMode(updates.mode);

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/categories/${categoryId}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update category: HTTP ${response.status}`));}
      const updatedBackendCategory: BackendCategory = await response.json();
      const updatedFrontendCategory = backendToFrontendCategory(updatedBackendCategory);
      setAllCategories(prev => prev.map(cat => (cat.id === categoryId ? updatedFrontendCategory : cat)));
      toast({ title: t('toastCategoryUpdatedTitle'), description: t('toastCategoryUpdatedDescription', { categoryName: updatedFrontendCategory.name }) });

      addHistoryLogEntryRef.current?.('historyLogUpdateCategory', {
        categoryId: categoryId, newName: updatedFrontendCategory.name, oldName: oldCategoryData?.name,
        newIconName: updatedFrontendCategory.iconName, oldIconName: oldCategoryData?.iconName,
        newMode: updatedFrontendCategory.mode, oldMode: oldCategoryData?.mode
      }, 'category');
    } catch (err) { if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } else {createApiErrorToast(err, toast, "toastCategoryUpdatedTitle", "updating", t, `${API_BASE_URL}/categories/${categoryId}`);} setError((err as Error).message); throw err; }
  }, [API_BASE_URL, fetchWithAuth, toast, t, logout]);

  const deleteCategory = useCallback(async (categoryId: number) => {
    setError(null);
    const categoryToDelete = allCategories.find(cat => cat.id === categoryId);
    if (!categoryToDelete) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/categories/${categoryId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete category: HTTP ${response.status}`));}
      setAllCategories(prev => prev.filter(cat => cat.id !== categoryId));
      const updateActivitiesCategory = (acts: Activity[]) => acts.map(act => act.categoryId === categoryId ? { ...act, categoryId: 0 } : act);
      setPersonalActivities(prev => updateActivitiesCategory(prev));
      setWorkActivities(prev => updateActivitiesCategory(prev));
      toast({ title: t('toastCategoryDeletedTitle'), description: t('toastCategoryDeletedDescription', { categoryName: categoryToDelete.name }) });
      addHistoryLogEntryRef.current?.('historyLogDeleteCategory', { categoryId: categoryId, name: categoryToDelete.name, iconName: categoryToDelete.iconName, mode: categoryToDelete.mode }, 'category');
    } catch (err) { if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } else { createApiErrorToast(err, toast, "toastCategoryDeletedTitle", "deleting", t, `${API_BASE_URL}/categories/${categoryId}`);} setError((err as Error).message); throw err; }
  }, [API_BASE_URL, fetchWithAuth, allCategories, toast, t, logout]);

  const addAssignee = useCallback(async (name: string, username: string, password?: string, isAdmin?: boolean) => {
    setError(null);
    if (!password) {
        toast({variant: "destructive", title: t('loginErrorTitle'), description: "Password is required to create a user."});
        throw new Error("Password is required to create a user.");
    }
    const payload: BackendUserCreatePayload = { name, username, password, is_admin: isAdmin || false };

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/users`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add assignee: HTTP ${response.status}`));}
      const newBackendUser: BackendUser = await response.json();
      setAllAssignees(prev => [...prev, backendToFrontendAssignee(newBackendUser)]);
      toast({ title: t('toastAssigneeAddedTitle'), description: t('toastAssigneeAddedDescription', { assigneeName: name }) });
      addHistoryLogEntryRef.current?.('historyLogAddAssignee', { name, username: newBackendUser.username, isAdmin: newBackendUser.is_admin }, 'assignee');
    } catch (err) { if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } else {createApiErrorToast(err, toast, "toastAssigneeAddedTitle", "adding", t, `${API_BASE_URL}/users`);} setError((err as Error).message); throw err; }
  }, [API_BASE_URL, fetchWithAuth, toast, t, logout]);

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

      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update assignee: HTTP ${response.status}`));}
      const updatedBackendUser: BackendUser = await response.json();
      const frontendAssignee = backendToFrontendAssignee(updatedBackendUser);

      setAllAssignees(prev => prev.map(asg => (asg.id === assigneeId ? frontendAssignee : asg)));
      toast({ title: t('toastAssigneeUpdatedTitle'), description: t('toastAssigneeUpdatedDescription', { assigneeName: updatedBackendUser.name }) });

      addHistoryLogEntryRef.current?.('historyLogUpdateAssignee', {
        assigneeId: assigneeId, name: updatedBackendUser.name, oldName: currentAssignee?.name,
        username: updatedBackendUser.username, oldUsername: currentAssignee?.username,
        isAdmin: updatedBackendUser.is_admin, oldIsAdmin: currentAssignee?.isAdmin
      }, 'assignee');

    } catch (err) {
        if (!(err instanceof Error && err.message.includes(t('usernameTakenErrorDescription', {username: updates.username || ''})))) {
           if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
           else { createApiErrorToast(err, toast, "toastAssigneeUpdatedTitle", "updating", t, `${API_BASE_URL}/users/${assigneeId}`);}
        }
        setError((err as Error).message); throw err;
    }
  }, [API_BASE_URL, fetchWithAuth, assignees, toast, t, logout]);

  const deleteAssignee = useCallback(async (assigneeId: number) => {
    setError(null);
    const assigneeToDelete = assignees.find(asg => asg.id === assigneeId);
    if (!assigneeToDelete) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/users/${assigneeId}`, { method: 'DELETE' });
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
      addHistoryLogEntryRef.current?.('historyLogDeleteAssignee', { assigneeId: assigneeId, name: assigneeToDelete.name, username: assigneeToDelete.username }, 'assignee');
    } catch (err) { if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } else { createApiErrorToast(err, toast, "toastAssigneeDeletedTitle", "deleting", t, `${API_BASE_URL}/users/${assigneeId}`);} setError((err as Error).message); throw err; }
  }, [API_BASE_URL, fetchWithAuth, assignees, toast, t, logout]);


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
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add activity: HTTP ${response.status}`));}

      const newBackendActivity: BackendActivity = await response.json();
      const newFrontendActivity = backendToFrontendActivity(newBackendActivity, appModeState);

      if (newFrontendActivity.appMode === 'personal') {
        setPersonalActivities(prev => [...prev, newFrontendActivity]);
      } else {
        setWorkActivities(prev => [...prev, newFrontendActivity]);
      }
      toast({ title: t('toastActivityAddedTitle'), description: t('toastActivityAddedDescription') });

      const category = allCategories.find(c => c.id === newFrontendActivity.categoryId);
      addHistoryLogEntryRef.current?.('historyLogAddActivity', {
        title: newFrontendActivity.title,
        categoryName: category?.name,
        date: formatDateFns(new Date(newFrontendActivity.createdAt), 'PP', {locale: dateFnsLocale}),
        time: newFrontendActivity.time,
        mode: newFrontendActivity.appMode
      }, newFrontendActivity.appMode);
    } catch (err) { if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } else { createApiErrorToast(err, toast, "toastActivityAddedTitle", "adding", t, `${API_BASE_URL}/activities`);} setError((err as Error).message); throw err; }
  }, [API_BASE_URL, fetchWithAuth, appModeState, toast, t, logout, allCategories, dateFnsLocale]);

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
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update activity: HTTP ${response.status}`));}
      const updatedBackendActivity: BackendActivity = await response.json(); // This is the rich ORM model
      let processedActivityFromBackend = backendToFrontendActivity(updatedBackendActivity, appModeState);

      const finalFrontendActivity = {
        ...activityToUpdate,
        ...processedActivityFromBackend,
        // Preserve client-side todos and occurrences if backend doesn't overwrite them fully from this specific response
        todos: processedActivityFromBackend.todos.length > 0 ? processedActivityFromBackend.todos : activityToUpdate.todos,
        completedOccurrences: Object.keys(processedActivityFromBackend.completedOccurrences).length > 0 ? processedActivityFromBackend.completedOccurrences : (updates.completedOccurrences || activityToUpdate.completedOccurrences || {}),
        completed: updates.completed !== undefined ? updates.completed : activityToUpdate.completed,
        completedAt: updates.completedAt !== undefined ? updates.completedAt : activityToUpdate.completedAt,
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

      const category = allCategories.find(c => c.id === finalFrontendActivity.categoryId);
      addHistoryLogEntryRef.current?.('historyLogUpdateActivity', {
        activityId: activityId, title: finalFrontendActivity.title, oldTitle: originalActivity?.title,
        categoryName: category?.name, oldCategoryName: originalActivity ? allCategories.find(c => c.id === originalActivity.categoryId)?.name : undefined,
        date: formatDateFns(new Date(finalFrontendActivity.createdAt), 'PP', {locale: dateFnsLocale}),
        oldDate: originalActivity ? formatDateFns(new Date(originalActivity.createdAt), 'PP', {locale: dateFnsLocale}) : undefined,
        time: finalFrontendActivity.time, oldTime: originalActivity?.time,
        mode: finalFrontendActivity.appMode
      }, finalFrontendActivity.appMode);
    } catch (err) { if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } else {createApiErrorToast(err, toast, "toastActivityUpdatedTitle", "updating", t, `${API_BASE_URL}/activities/${activityId}`);} setError((err as Error).message); throw err; }
  }, [API_BASE_URL, fetchWithAuth, appModeState, personalActivities, workActivities, toast, t, logout, allCategories, dateFnsLocale]);

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
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete activity: HTTP ${response.status}`));}
      setter(prev => prev.filter(act => act.id !== activityId));
      toast({ title: t('toastActivityDeletedTitle'), description: t('toastActivityDeletedDescription', { activityTitle: activityToDelete.title }) });

      const category = allCategories.find(c => c.id === activityToDelete!.categoryId);
      addHistoryLogEntryRef.current?.('historyLogDeleteActivity', {
        activityId: activityId, title: activityToDelete.title,
        categoryName: category?.name,
        date: formatDateFns(new Date(activityToDelete.createdAt), 'PP', {locale: dateFnsLocale}),
        time: activityToDelete.time,
        mode: activityToDelete.appMode
      }, modeForLog);
    } catch (err) { if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } else { createApiErrorToast(err, toast, "toastActivityDeletedTitle", "deleting", t, `${API_BASE_URL}/activities/${activityId}`);} setError((err as Error).message); throw err; }
  }, [API_BASE_URL, fetchWithAuth, personalActivities, workActivities, toast, t, logout, allCategories, dateFnsLocale]);


  const addTodoToActivity = useCallback(async (activityId: number, todoText: string, completed: boolean = false): Promise<Todo | null> => {
    setError(null);
    const payload: BackendTodoCreate = { text: todoText, complete: completed };
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}/todos`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add todo: HTTP ${response.status}`));}
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
        if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
        else { createApiErrorToast(err, toast, "toastTodoAddedTitle", "adding", t, `${API_BASE_URL}/activities/${activityId}/todos`); }
        setError((err as Error).message);
        return null;
    }
  }, [API_BASE_URL, fetchWithAuth, personalActivities, workActivities, toast, t, logout]);

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
        if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
        else { createApiErrorToast(err, toast, "toastTodoUpdatedTitle", "updating", t, `${API_BASE_URL}/todos/${todoId}`);}
        setError((err as Error).message);
        throw err;
    }
  }, [API_BASE_URL, fetchWithAuth, personalActivities, workActivities, t, toast, logout]);

  const deleteTodoFromActivity = useCallback(async (activityId: number, todoId: number) => {
    setError(null);
    const todoToDelete =
      personalActivities.find(act => act.id === activityId)?.todos.find(t => t.id === todoId) ||
      workActivities.find(act => act.id === activityId)?.todos.find(t => t.id === todoId);

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/todos/${todoId}`, { method: 'DELETE' });
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
    } catch (err) { if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); } else { createApiErrorToast(err, toast, "toastTodoDeletedTitle", "deleting", t, `${API_BASE_URL}/todos/${todoId}`);} setError((err as Error).message); throw err; }
  }, [API_BASE_URL, fetchWithAuth, personalActivities, workActivities, toast, t, logout]);

 const toggleOccurrenceCompletion = useCallback(async (masterActivityId: number, occurrenceDateTimestamp: number, completedState: boolean) => {
    let masterActivity = personalActivities.find(act => act.id === masterActivityId) || workActivities.find(act => act.id === masterActivityId);
    const setter = personalActivities.find(act => act.id === masterActivityId) ? setPersonalActivities : setWorkActivities;

    if (!masterActivity) {
        console.error("Master activity not found for toggling occurrence:", masterActivityId);
        return;
    }
    const activityTitleForLog = masterActivity.title;
    const modeForLog = masterActivity.appMode;
    const occurrenceDateKey = formatISO(new Date(occurrenceDateTimestamp), { representation: 'date' });
    const occurrenceDateTimeISO = new Date(occurrenceDateTimestamp).toISOString();

    // Optimistic UI update
    setter(prevActivities =>
      prevActivities.map(act =>
        act.id === masterActivityId
          ? { ...act, completedOccurrences: { ...act.completedOccurrences, [occurrenceDateKey]: completedState } }
          : act
      )
    );

    try {
        // Check if occurrence exists
        const occurrencesResponse = await fetchWithAuth(`${API_BASE_URL}/activities/${masterActivityId}/occurrences`);
        if (!occurrencesResponse.ok) throw new Error(`Failed to fetch occurrences for activity ${masterActivityId}`);
        const existingOccurrences: BackendActivityOccurrence[] = await occurrencesResponse.json();

        const targetDate = new Date(occurrenceDateTimestamp);
        const existingOccurrence = existingOccurrences.find(occ =>
            isSameDay(parseISO(occ.date), targetDate)
        );

        if (existingOccurrence) {
            // Update existing occurrence
            const updatePayload: BackendActivityOccurrenceUpdate = { complete: completedState };
            const updateResponse = await fetchWithAuth(`${API_BASE_URL}/activity-occurrences/${existingOccurrence.id}`, {
                method: 'PUT',
                body: JSON.stringify(updatePayload)
            });
            if (!updateResponse.ok) {
              const errorData = await updateResponse.json().catch(() => ({detail: `HTTP ${updateResponse.status}`}));
              throw new Error(formatBackendError(errorData, `Failed to update occurrence ${existingOccurrence.id}`));
            }
        } else {
            // Create new occurrence
            const createPayload: BackendActivityOccurrenceCreate = {
                activity_id: masterActivityId,
                date: occurrenceDateTimeISO,
                complete: completedState
            };
            const createResponse = await fetchWithAuth(`${API_BASE_URL}/activity-occurrences`, {
                method: 'POST',
                body: JSON.stringify(createPayload)
            });
            if (!createResponse.ok) {
              const errorData = await createResponse.json().catch(() => ({detail: `HTTP ${createResponse.status}`}));
              throw new Error(formatBackendError(errorData, `Failed to create new occurrence`));
            }
        }

        addHistoryLogEntryRef.current?.('historyLogToggleActivityCompletion', {
            title: activityTitleForLog,
            completed: completedState,
            date: formatDateFns(new Date(occurrenceDateTimestamp), 'PP', { locale: dateFnsLocale }),
            time: masterActivity?.time,
            mode: masterActivity?.appMode
        }, modeForLog);

    } catch (err) {
        console.error("Error toggling occurrence completion:", err);
        // Revert optimistic update on error
        setter(prevActivities =>
            prevActivities.map(act =>
                act.id === masterActivityId
                    ? { ...act, completedOccurrences: { ...act.completedOccurrences, [occurrenceDateKey]: !completedState } }
                    : act
            )
        );
        if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) {
            logout();
        } else {
            createApiErrorToast(err, toast, "toastActivityUpdatedTitle", "updating", t);
        }
    }
  }, [API_BASE_URL, fetchWithAuth, personalActivities, workActivities, dateFnsLocale, t, toast, logout]);


 const fetchAndSetSpecificActivityDetails = useCallback(async (activityId: number): Promise<Activity | null> => {
    try {
        // 1. Fetch main activity details (now returns ActivityResponse / BackendActivityListItem)
        const activityResponse = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}`);
        if (!activityResponse.ok) {
            const errorData = await activityResponse.json().catch(() => ({ detail: `HTTP ${activityResponse.status}: ${activityResponse.statusText}` }));
            throw new Error(formatBackendError(errorData, `Failed to fetch activity details for ID ${activityId}.`));
        }
        const backendActivityListItem: BackendActivityListItem = await activityResponse.json();
        let frontendActivityShell = backendToFrontendActivity(backendActivityListItem, appModeState);

        // 2. Fetch todos for this activity
        const todosResponse = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}/todos`);
        let fetchedApiTodos: BackendTodo[] = [];
        if (todosResponse.ok) {
            fetchedApiTodos = await todosResponse.json();
        } else {
            console.warn(`[AppProvider] Failed to fetch todos for activity ${activityId}: HTTP ${todosResponse.status}`);
        }
        frontendActivityShell.todos = fetchedApiTodos.map(bt => ({
            id: bt.id,
            text: bt.text,
            completed: bt.complete,
        }));

        // 3. Fetch occurrences for this activity
        const occurrencesResponse = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}/occurrences`);
        let activityOccurrences: BackendActivityOccurrence[] = [];
        if (occurrencesResponse.ok) {
            activityOccurrences = await occurrencesResponse.json();
        } else {
            console.warn(`[AppProvider] Failed to fetch occurrences for activity ${activityId}: HTTP ${occurrencesResponse.status}`);
        }
        const occurrencesMap: Record<string, boolean> = {};
        activityOccurrences.forEach(occ => {
             try {
                const dateKey = formatISO(parseISO(occ.date), { representation: 'date' });
                occurrencesMap[dateKey] = occ.complete;
            } catch (e) {
                console.warn(`[AppProvider] Failed to parse occurrence date for activity ${activityId}: ${occ.date}`, e);
            }
        });
        frontendActivityShell.completedOccurrences = occurrencesMap;


        const setter = frontendActivityShell.appMode === 'personal' ? setPersonalActivities : setWorkActivities;
        setter(prevActivities => {
            const existingActivity = prevActivities.find(act => act.id === activityId);
            if (existingActivity) {
                return prevActivities.map(act => act.id === activityId ? { ...existingActivity, ...frontendActivityShell } : act);
            }
            return [...prevActivities, frontendActivityShell];
        });
        return frontendActivityShell;
    } catch (err) {
         if (err instanceof Error && (err.message.toLowerCase().includes('unauthorized') || err.message.includes('401'))) { logout(); }
         else { createApiErrorToast(err, toast, "toastActivityLoadErrorTitle", "loading", t, `${API_BASE_URL}/activities/${activityId}`);}
        return null;
    }
  }, [API_BASE_URL, fetchWithAuth, appModeState, t, toast, logout]);


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
