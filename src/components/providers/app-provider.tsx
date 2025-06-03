
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  Activity, Todo, Category, AppMode, RecurrenceRule, UINotification, HistoryLogEntry, HistoryLogActionKey, Translations, Assignee, PomodoroPhase,
  BackendCategoryCreatePayload, BackendCategory, BackendUser, BackendUserCreatePayload, BackendUserUpdatePayload, BackendActivityCreatePayload, BackendActivityUpdatePayload, BackendActivity, BackendTodoCreate, BackendHistory, RecurrenceType, BackendCategoryMode, BackendRepeatMode, BackendTodo,
  Token, DecodedToken, BackendHistoryCreatePayload, BackendCategoryUpdatePayload
} from '@/lib/types';
import { DEFAULT_JWT_SECRET_KEY, POMODORO_WORK_DURATION_SECONDS, POMODORO_SHORT_BREAK_DURATION_SECONDS, POMODORO_LONG_BREAK_DURATION_SECONDS } from '@/lib/constants';
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://afaire.is-cool.dev/api';
const JWT_SECRET_KEY_FOR_DECODING = process.env.NEXT_PUBLIC_JWT_SECRET_KEY || DEFAULT_JWT_SECRET_KEY;

export interface AppContextType {
  activities: Activity[];
  getRawActivities: () => Activity[];
  categories: Category[];
  assignees: Assignee[];
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  addActivity: (
    activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'completedAt' | 'notes' | 'recurrence' | 'completedOccurrences' | 'responsiblePersonIds' | 'categoryId'| 'appMode'| 'masterActivityId' | 'isRecurringInstance' | 'originalInstanceDate'> & {
      todos?: Omit<Todo, 'id' | 'completed'>[];
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
  addTodoToActivity: (activityId: number, todoText: string, completed?: boolean) => Promise<void>;
  updateTodoInActivity: (activityId: number, todoId: number, updates: Partial<Todo>) => Promise<void>;
  deleteTodoFromActivity: (activityId: number, todoId: number) => Promise<void>;
  getCategoryById: (categoryId: number) => Category | undefined;
  addCategory: (name: string, iconName: string, mode: AppMode | 'all') => Promise<void>;
  updateCategory: (categoryId: number, updates: Partial<Omit<Category, 'id' | 'icon'>>, oldCategoryData?: Category) => Promise<void>;
  deleteCategory: (categoryId: number) => Promise<void>;
  addAssignee: (name: string, username: string, password?: string, isAdmin?: boolean) => Promise<void>;
  updateAssignee: (assigneeId: number, updates: Partial<Pick<Assignee, 'name' | 'username' | 'isAdmin'>>, newPassword?: string) => Promise<void>;
  deleteAssignee: (assigneeId: number) => Promise<void>;
  getAssigneeById: (assigneeId: number) => Assignee | undefined;
  isLoading: boolean;
  error: string | null;

  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  getCurrentUserId: () => number | null;


  uiNotifications: UINotification[];
  addUINotification: (data: Omit<UINotification, 'id' | 'timestamp' | 'read'>) => void;
  markUINotificationAsRead: (notificationId: string) => void;
  markAllUINotificationsAsRead: () => void;
  clearAllUINotifications: () => void;

  historyLog: HistoryLogEntry[];
  addHistoryLogEntry: (actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined>, scope?: HistoryLogEntry['scope']) => Promise<void>;

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
        else if (recurrence.type === 'weekly') currentDate = addDays(currentDate, 1); // Advance by day, check daysOfWeek later
        else if (recurrence.type === 'monthly') {
            // Advance to the dayOfMonth in the *next* logical month.
            // This ensures we don't get stuck if dayOfMonth is e.g. 31 and current month is shorter.
            let nextMonth = addMonths(currentDate, 1);
            currentDate = setDayOfMonthFn(nextMonth, recurrence.dayOfMonth || getDate(currentDate)); // Fallback to current day if dayOfMonth not set
            // If setting dayOfMonth made it skip too far, or an invalid date, this needs more robust logic.
            // For simplicity, this moves to next month's target day.
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
            instanceDate: new Date(currentDate.getTime()), // Ensure new Date object
            masterActivityId: masterActivity.id,
          });
      }
    }

    if (recurrence.type === 'daily') {
        currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'weekly') {
        currentDate = addDays(currentDate, 1); // Check each day for weekly
    } else if (recurrence.type === 'monthly') {
        if (recurrence.dayOfMonth) {
            let nextIterationDate;
            const currentMonthTargetDay = setDayOfMonthFn(currentDate, recurrence.dayOfMonth);
            if(isAfter(currentMonthTargetDay, currentDate) && getDate(currentMonthTargetDay) === recurrence.dayOfMonth){
                 // Target day is later in the current month
                 nextIterationDate = currentMonthTargetDay;
            } else {
                 // Target day is past or current day, so move to next month's target day
                 let nextMonthDate = addMonths(currentDate, 1);
                 nextIterationDate = setDayOfMonthFn(nextMonthDate, recurrence.dayOfMonth);
            }
            currentDate = nextIterationDate;
        } else {
            // Should not happen if dayOfMonth is required for 'monthly'
            currentDate = addDays(currentDate, 1); 
        }
    } else {
      break; // Should not happen for valid recurrence types
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
  if (!backendActivity || typeof backendActivity !== 'object') {
    const fallbackId = Date.now() + Math.random();
    console.error(`[AppProvider] CRITICAL: backendToFrontendActivity received invalid backendActivity object. Using fallback ID ${fallbackId}. Received:`, typeof backendActivity === 'object' ? JSON.stringify(backendActivity) : backendActivity);
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
  
 const todos: Todo[] = [];
  if (Array.isArray(backendActivity.todos)) {
    backendActivity.todos.forEach((bt: BackendTodo, index: number) => {
        const todoId = typeof bt?.id === 'number' ? bt.id : Date.now() + Math.random() + index;
        if (typeof bt?.id !== 'number') {
            console.warn(`[AppProvider] Warning: Todo at index ${index} for activity ID ${activityIdForLog} is missing a valid 'id' from backend. Using temporary ID ${todoId}. Backend todo:`, bt);
        }
        if (typeof bt?.text !== 'string') {
            console.warn(`[AppProvider] Warning: Todo at index ${index} for activity ID ${activityIdForLog} is missing 'text'.`);
        }
        todos.push({
          id: todoId,
          text: bt?.text || 'Untitled Todo from Backend',
          completed: bt?.complete || false, 
        });
      });
  } else {
     console.warn(`[AppProvider] Warning: backendActivity.todos is missing or not an array for activity ID ${activityIdForLog}. Defaulting to empty array. Received:`, backendActivity.todos);
  }
  
 const responsiblePersonIds = (Array.isArray(backendActivity.responsibles))
    ? backendActivity.responsibles.map(r => r.id)
    : [];

  if (!(Array.isArray(backendActivity.responsibles))) {
    console.warn(`[AppProvider] Warning: backendActivity.responsibles is missing or not an array for activity ID ${activityIdForLog}. Defaulting to empty array. Received:`, backendActivity.responsibles !== undefined ? JSON.stringify(backendActivity.responsibles) : 'FIELD_MISSING_OR_UNDEFINED');
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
    completedOccurrences: {}, // This is client-managed for now
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
    // Ensure days_of_week is an array of strings for the backend
    payload.days_of_week = activity.recurrence.type === 'weekly' ? (activity.recurrence.daysOfWeek || []).map(String) : null;
    payload.day_of_month = activity.recurrence.type === 'monthly' ? (activity.recurrence.dayOfMonth ?? null) : null;
  } else {
    payload.repeat_mode = 'none'; // Explicitly set to none if not recurring
    payload.end_date = null;
    payload.days_of_week = null;
    payload.day_of_month = null;
  }
  
  // Handle responsible_ids: always send for create, send if defined for update
  if (activity.responsiblePersonIds !== undefined) {
    payload.responsible_ids = activity.responsiblePersonIds;
  } else if (!isUpdate) { 
    // For create operations, default to empty list if not provided (though form should provide it)
    payload.responsible_ids = [];
  }


  // Todos are only part of the create payload. Updates to todos are handled by separate endpoints.
  if (!isUpdate && activity.todos && activity.todos.length > 0) {
    (payload as BackendActivityCreatePayload).todos = activity.todos.map(t => ({ text: t.text, complete: t.completed }));
  } else if (!isUpdate) {
    (payload as BackendActivityCreatePayload).todos = []; // Ensure empty list if no todos on create
  }

  return payload;
};

const backendToFrontendHistory = (backendHistory: BackendHistory): HistoryLogEntry => ({
  id: backendHistory.id,
  timestamp: parseISO(backendHistory.timestamp).getTime(),
  actionKey: backendHistory.action as HistoryLogActionKey, // Assuming backend actions match keys
  backendAction: backendHistory.action, // Store original action string
  backendUserId: backendHistory.user_id,
  scope: 'account', // Default scope, can be refined if backend provides more info
  details: { rawBackendAction: backendHistory.action } // Store raw action in details
});

const formatBackendError = (errorData: any, defaultMessage: string): string => {
  if (errorData && errorData.detail) {
    if (Array.isArray(errorData.detail)) {
      // Handle FastAPI validation errors
      return errorData.detail
        .map((validationError: any) => {
          const loc = validationError.loc && Array.isArray(validationError.loc)
            ? validationError.loc.filter((item: any) => item !== 'body').join(' > ') // Filter out 'body' from loc
            : 'Field';
          return `${loc}: ${validationError.msg}`;
        })
        .join('; ');
    } else if (typeof errorData.detail === 'string') {
      // Handle string detail
      return errorData.detail;
    }
  }
  // Fallback if detail is not in expected format or errorData is null/undefined
  return defaultMessage;
};

const createApiErrorToast = (
    err: unknown,
    toastFn: (options: any) => void,
    defaultTitleKey: keyof Translations,
    operationType: 'loading' | 'adding' | 'updating' | 'deleting' | 'authenticating' | 'logging',
    translationFn: (key: keyof Translations, params?: any) => string,
    endpoint?: string
  ) => {
    // Cast to a more specific error type if possible, otherwise use generic Error
    const error = err as Error & { cause?: unknown, name?: string, response?: Response };
    let consoleMessage = `[AppProvider] Failed ${operationType} for endpoint: ${endpoint || 'N/A'}.
Error Name: ${error.name || 'UnknownError'}
Error Message: ${error.message || 'No message'}.`;
    if (error.stack) consoleMessage += `\nStack: ${error.stack}`;

    // Safely stringify cause if it's an object, otherwise convert to string
    if (error.cause && typeof error.cause === 'object' && error.cause !== null) {
        try {
            consoleMessage += `\nCause: ${JSON.stringify(error.cause, Object.getOwnPropertyNames(error.cause))}`;
        } catch (e) {
            // If stringifying fails (e.g., circular references), just use basic string conversion
            consoleMessage += `\nCause (could not stringify): ${error.cause}`;
        }
    } else if (error.cause) {
        consoleMessage += `\nCause: ${String(error.cause)}`;
    }
    // Check for 401 specifically, as it's handled by global logout
     if (error.response && error.response.status === 401 && operationType !== 'authenticating') {
       // Handled by global 401 check, no separate toast here
       return;
    }

    console.error(consoleMessage);

    // Determine toast description
    let descriptionKey: keyof Translations = 'toastDefaultErrorDescription';
    let descriptionParams: any = {};
    let customDescription: string | null = null;

    // Check for network error (TypeError and "Failed to fetch")
    if (error.name === 'TypeError' && error.message.toLowerCase().includes('failed to fetch')) {
      descriptionKey = 'toastFailedToFetchErrorDescription';
      descriptionParams = { endpoint: endpoint || API_BASE_URL };
    } else if (error.message && error.message.toLowerCase().includes("unexpected token '<'") && error.message.toLowerCase().includes("html")) {
      // Handle cases where server returns HTML instead of JSON (e.g., proxy errors, server misconfig)
      descriptionKey = 'toastInvalidJsonErrorDescription';
      descriptionParams = { endpoint: endpoint || API_BASE_URL };
    } else if (error.message) {
        // Use the error's message directly if it's not one of the specific network errors
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

  // Loading states for different data types
  const [isLoadingState, setIsLoadingState] = useState<boolean>(true); // Overall initial loading
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(true);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isAssigneesLoading, setIsAssigneesLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, locale } = useTranslations();

  const dateFnsLocale = useMemo(() => (locale === 'es' ? es : locale === 'fr' ? fr : enUS), [locale]);
  const [lastNotificationCheckDay, setLastNotificationCheckDay] = useState<number | null>(null); // Store day of month
  const [notifiedToday, setNotifiedToday] = useState<Set<string>>(new Set()); // Keys: `${activityId}:${instanceDateISO}`
  
  const [uiNotifications, setUINotifications] = useState<UINotification[]>([]);
  const [historyLog, setHistoryLog] = useState<HistoryLogEntry[]>([]);
  const { theme, resolvedTheme } = useTheme(); // For theme-color meta tag
  const [systemNotificationPermission, setSystemNotificationPermission] = useState<NotificationPermission | null>(null);

  // Pomodoro States
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('off');
  const [pomodoroTimeRemaining, setPomodoroTimeRemaining] = useState(POMODORO_WORK_DURATION_SECONDS);
  const [pomodoroIsRunning, setPomodoroIsRunning] = useState(false);
  const [pomodoroCyclesCompleted, setPomodoroCyclesCompleted] = useState(0);
  const [isPomodoroReady, setIsPomodoroReady] = useState(false);
  const prevPomodoroPhaseRef = useRef<PomodoroPhase>(pomodoroPhase);

  // App Lock States
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [appPinState, setAppPinState] = useState<string | null>(null); // Default to null, no pin

  const isAuthenticated = !!jwtToken;


  const decodeAndSetToken = useCallback(async (token: string | null) => {
    if (!token) {
      setJwtToken(null);
      setDecodedJwt(null);
      if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_STORAGE_KEY_JWT);
      return;
    }
    try {
      // For HS256, the secret should be a Uint8Array.
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
      // Optionally logout or show error
    }
  }, []);
  
  const getCurrentUserId = useCallback((): number | null => {
    return decodedJwt?.sub ? parseInt(decodedJwt.sub, 10) : null;
  }, [decodedJwt]);


  // Unified fetch function with auth handling
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}, tokenToUse?: string | null): Promise<Response> => {
    const currentToken = tokenToUse || jwtToken;

    if (!currentToken) {
      // This error should ideally be caught before calling fetchWithAuth if token is essential,
      // but as a fallback, force logout.
      // logout(); // This creates a loop if called during initial data fetch when token is null
      throw new Error("No JWT token available for authenticated request.");
    }

    const headers = new Headers(options.headers || {});
    headers.append('Authorization', `Bearer ${currentToken}`);
    // Do not set Content-Type if body is FormData, browser handles it.
    // For JSON, ensure it's set.
    if (!(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)) { // Also check for URLSearchParams
        if (!headers.has('Content-Type') && options.method && ['POST', 'PUT', 'PATCH'].includes(options.method.toUpperCase())) {
             headers.append('Content-Type', 'application/json');
        }
    }


    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        // Don't call logout here to avoid infinite loops if the initial token load fails.
        // Instead, rely on the caller (e.g., useEffect for initial load, or login function)
        // to handle the 401 by clearing the token.
        // If this happens during an ongoing session, the AuthenticatedAppLayout effect will redirect.
        // For now, just throw the error to be caught by the specific operation.
        // logout(); // This will be handled by the global unauthenticated state check in layout
        throw new Error(`Unauthorized: ${response.statusText}`); // Propagate error
    }
    return response;
  }, [jwtToken]); // Removed logout from dependency array to avoid potential loops


  const logout = useCallback(() => {
    addHistoryLogEntry('historyLogLogout', undefined, 'account');
    decodeAndSetToken(null); // Clears token from state and localStorage
    setIsAppLocked(false); // Unlock app on logout

    // Clear all local data
    setPersonalActivities([]);
    setWorkActivities([]);
    setAllCategories([]);
    setAllAssignees([]);
    setHistoryLog([]);
    setUINotifications([]); // Clear UI notifications

    // Reset Pomodoro timer via Service Worker
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'RESET_TIMER', payload: { locale } });
    }
    // Notify other tabs/windows
    if (logoutChannel) logoutChannel.postMessage('logout_event_v2');
  }, [decodeAndSetToken, locale]); // addHistoryLogEntry removed from deps to avoid cycle

  // Centralized History Logging
  const addHistoryLogEntry = useCallback(async (actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined>, scope: HistoryLogEntry['scope'] = 'account') => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        // This might happen if an action is performed while token is being processed or is invalid.
        // Consider queueing or simply warning. For now, a warning.
        console.warn("[AppProvider] Cannot add history log: User ID not available.");
        return;
    }

    // Construct action string with details for backend
    // Ensure it doesn't exceed backend column length if there's a limit.
    const payload: BackendHistoryCreatePayload = {
        action: actionKey, // Send the key itself
        user_id: currentUserId,
        // details will be part of the action string or a separate field if backend supports it
    };
    
    // If your backend's 'action' field is meant to store the key + details:
    const actionWithDetails = details ? `${actionKey} ${JSON.stringify(details)}` : actionKey;
    // Truncate if necessary, assuming backend column limit (e.g., 255 chars)
    payload.action = actionWithDetails.substring(0, 255); // Example truncation

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
        setHistoryLog(prevLog => [backendToFrontendHistory(newBackendHistoryEntry), ...prevLog.slice(0, 99)]); // Keep max 100 entries
    } catch (err) {
        // Don't toast for history log errors, just console log to avoid noise for user
        console.error(`[AppProvider] Failed logging history for action ${actionKey}:`, (err as Error).message);
        // setError((err as Error).message); // Avoid setting global error for this
    }
  }, [fetchWithAuth, getCurrentUserId]); // Removed jwtToken from deps as fetchWithAuth handles it


  // Effect for dynamic theme-color meta tag
  useEffect(() => {
    if (typeof window === 'undefined' || isLoadingState) return; // Ensure this runs client-side and after initial load
    // Debounce or delay slightly to ensure CSS variables are applied
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
            // Fallback or warning if HSL parsing fails
            console.warn("[AppProvider] Could not parse --background HSL string for theme-color:", backgroundHslString);
        }
    }, 0); // Minimal delay, can be increased if CSS vars take longer to apply
    return () => clearTimeout(timerId);
  }, [theme, resolvedTheme, appModeState, isLoadingState]); // Re-run if theme or appMode changes

  // --- Data Accessors and Modifiers ---
  const getRawActivities = useCallback(() => {
    return appModeState === 'work' ? workActivities : personalActivities;
  }, [appModeState, workActivities, personalActivities]);

  const currentActivitySetter = useMemo(() => {
    return appModeState === 'work' ? setWorkActivities : setPersonalActivities;
  }, [appModeState]);

 const filteredCategories = useMemo(() => {
    if (isCategoriesLoading) return []; // Return empty if still loading
    return allCategories.filter(cat =>
      cat.mode === 'all' || cat.mode === appModeState
    );
  }, [allCategories, appModeState, isCategoriesLoading]); // Add isCategoriesLoading

  const assigneesForContext = useMemo(() => {
    if (isAssigneesLoading) return []; // Return empty if still loading
    return assignees;
  }, [assignees, isAssigneesLoading]); // Add isAssigneesLoading

  // --- UI Notifications ---
  const stableAddUINotification = useCallback((data: Omit<UINotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: UINotification = {
      ...data,
      id: uuidv4(),
      timestamp: Date.now(),
      read: false,
    };
    setUINotifications(prev => {
        // Prevent duplicate notifications for the same event if already present and unread
        const existingNotification = prev.find(n => n.activityId === newNotification.activityId && n.instanceDate === newNotification.instanceDate && n.title === newNotification.title);
        if (existingNotification) return prev;
        return [newNotification, ...prev.slice(0, 49)]; // Keep max 50 notifications
    });
  }, []);

  // --- System Notifications ---
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
    // Permission is 'default', request it
    try {
      const permissionResult = await Notification.requestPermission();
      setSystemNotificationPermission(permissionResult);
      if (permissionResult === 'granted') {
        toast({ title: t('systemNotificationsEnabled'), description: t('systemNotificationsNowActive') as string });
        showSystemNotification(t('systemNotificationsEnabled') as string, t('systemNotificationsNowActive') as string); // Show a test notification
      } else if (permissionResult === 'denied') {
        toast({ title: t('systemNotificationsBlocked'), description: t('systemNotificationsUserDenied') as string });
      } else { // 'default' - user dismissed the prompt
         toast({ title: t('systemNotificationsNotYetEnabled') as string, description: t('systemNotificationsDismissed') as string });
      }
    } catch (err) {
      // Fallback to current permission if requestPermission fails for some reason
      setSystemNotificationPermission(Notification.permission);
    }
  }, [t, toast, showSystemNotification]);


 // --- Effects ---
  // Initial load: localStorage, JWT decoding, and initial data fetch if authenticated
 useEffect(() => {
    const loadClientSideDataAndFetchInitial = async () => {
      setIsLoadingState(true);
      
      // Load appMode from localStorage
      const storedAppMode = localStorage.getItem(LOCAL_STORAGE_KEY_APP_MODE) as AppMode | null;
      if (storedAppMode && (storedAppMode === 'personal' || storedAppMode === 'work')) setAppModeState(storedAppMode);

      // Try to load and decode JWT
      const storedToken = localStorage.getItem(LOCAL_STORAGE_KEY_JWT);
      // await decodeAndSetToken before checking jwtToken directly in this effect
      if (storedToken) {
          await decodeAndSetToken(storedToken); // This will set jwtToken state if valid
      }

      // Load UI notifications from localStorage
      const storedUINotifications = localStorage.getItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS);
      if (storedUINotifications) setUINotifications(JSON.parse(storedUINotifications));
      // Check current system notification permission
      if (typeof window !== 'undefined' && 'Notification' in window) setSystemNotificationPermission(Notification.permission);
      
      // App Pin
      const storedPin = localStorage.getItem(LOCAL_STORAGE_KEY_APP_PIN);
      if (storedPin) {
        setAppPinState(storedPin);
        // Only lock if a pin exists and user was previously authenticated.
        // If no stored token, don't lock, let them go to login page.
        if (storedToken) setIsAppLocked(true); 
      }


      // Fetch initial data only if a token was present and successfully decoded (jwtToken state would be set)
      if (jwtToken) { // Check the state variable *after* decodeAndSetToken has run
        try {
            setIsActivitiesLoading(true);
            const actResponse = await fetchWithAuth(`${API_BASE_URL}/activities`, {}, jwtToken); // Pass token explicitly
            if (!actResponse.ok) throw new Error(`Activities fetch failed: ${actResponse.statusText}`);
            const backendActivities: BackendActivity[] = await actResponse.json();
            const newPersonal: Activity[] = [], newWork: Activity[] = [];
            backendActivities.forEach(beAct => {
                if (!beAct) return; // Skip if beAct is null/undefined
                const feAct = backendToFrontendActivity(beAct, beAct.mode as AppMode); // Pass backend mode for initial sorting
                if (feAct.appMode === 'personal') newPersonal.push(feAct); else newWork.push(feAct);
            });
            setPersonalActivities(newPersonal); setWorkActivities(newWork);
        } catch (err) { createApiErrorToast(err, toast, "toastActivityLoadErrorTitle", "loading", t, `${API_BASE_URL}/activities`); }
        finally { setIsActivitiesLoading(false); }

        try {
            setIsCategoriesLoading(true);
            const catResponse = await fetchWithAuth(`${API_BASE_URL}/categories`, {}, jwtToken);
            if (!catResponse.ok) throw new Error(`Categories fetch failed: ${catResponse.statusText}`);
            const backendCategories: BackendCategory[] = await catResponse.json();
            setAllCategories(backendCategories.map(cat => backendToFrontendCategory(cat)));
        } catch (err) { createApiErrorToast(err, toast, "toastCategoryLoadErrorTitle", "loading", t, `${API_BASE_URL}/categories`); }
        finally { setIsCategoriesLoading(false); }

        try {
            setIsAssigneesLoading(true);
            const userResponse = await fetchWithAuth(`${API_BASE_URL}/users`, {}, jwtToken);
            if (!userResponse.ok) throw new Error(`Users fetch failed: ${userResponse.statusText}`);
            const backendUsers: BackendUser[] = await userResponse.json();
            setAllAssignees(backendUsers.map(user => backendToFrontendAssignee(user)));
        } catch (err) { createApiErrorToast(err, toast, "toastAssigneeLoadErrorTitle", "loading", t, `${API_BASE_URL}/users`); }
        finally { setIsAssigneesLoading(false); }

        try {
            setIsHistoryLoading(true);
            const histResponse = await fetchWithAuth(`${API_BASE_URL}/history`, {}, jwtToken);
            if (!histResponse.ok) throw new Error(`History fetch failed: ${histResponse.statusText}`);
            const backendHistoryItems: BackendHistory[] = await histResponse.json();
            setHistoryLog(backendHistoryItems.map(item => backendToFrontendHistory(item)));
        } catch (err) { createApiErrorToast(err, toast, "historyLoadErrorTitle", "loading", t, `${API_BASE_URL}/history`); }
        finally { setIsHistoryLoading(false); }
      } else {
        // If no token, no data to fetch, so set loading flags to false
        setIsActivitiesLoading(false); setIsCategoriesLoading(false); setIsAssigneesLoading(false); setIsHistoryLoading(false);
      }
      setIsLoadingState(false); // Overall loading complete
    };
    
    loadClientSideDataAndFetchInitial();
  // jwtToken dependency is crucial here to re-trigger data fetch after login
  }, [decodeAndSetToken, jwtToken, t, toast]); // Removed fetchWithAuth from deps to avoid re-triggering on its own change


  // Save appMode to localStorage
  useEffect(() => {
    if (!isLoadingState) { // Only save after initial load
      localStorage.setItem(LOCAL_STORAGE_KEY_APP_MODE, appModeState);
      // Apply class to HTML for global styling based on mode
      const root = document.documentElement;
      root.classList.remove('mode-personal', 'mode-work');
      root.classList.add(appModeState === 'work' ? 'mode-work' : 'mode-personal');
    }
  }, [appModeState, isLoadingState]);

  // Save UI notifications to localStorage
  useEffect(() => { if(!isLoadingState) localStorage.setItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS, JSON.stringify(uiNotifications));}, [uiNotifications, isLoadingState]);

  // Activity Reminder Notifications (Interval)
  useEffect(() => {
    if (isLoadingState || !isAuthenticated) return;

    const intervalId = setInterval(() => {
      const now = new Date();
      const today = getStartOfDayUtil(now); // Use consistent start of day
      const currentDayOfMonthFromNow = now.getDate();

      // Reset notifiedToday set if the day has changed
      if (lastNotificationCheckDay !== null && lastNotificationCheckDay !== currentDayOfMonthFromNow) {
        setNotifiedToday(new Set());
      }
      setLastNotificationCheckDay(currentDayOfMonthFromNow);

      const activitiesToScan = appModeState === 'work' ? workActivities : personalActivities;

      activitiesToScan.forEach(masterActivity => {
        const activityTitle = masterActivity.title;
        const masterId = masterActivity.id;

        // --- 5-Minute "Starting Soon" Notifications for Today's Timed Activities ---
        if (masterActivity.time) {
          // Generate instances only for today
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

        // --- "Tomorrow", "In 2 Days", "In 1 Week" Notifications for Recurring Activities ---
        if (masterActivity.recurrence && masterActivity.recurrence.type !== 'none') {
          const recurrenceType = masterActivity.recurrence.type;
          // Check for upcoming instances in the next 8 days (to cover 1 week + buffer)
          const futureCheckEndDate = addDays(today, 8); // Look ahead 8 days
          const upcomingInstances = generateFutureInstancesForNotifications(masterActivity, addDays(today,1), futureCheckEndDate); // Start from tomorrow

          upcomingInstances.forEach(instance => {
            const instanceDateKey = formatISO(instance.instanceDate, { representation: 'date' });
            // Check if this specific instance is completed
            const isOccurrenceCompleted = !!masterActivity.completedOccurrences?.[instanceDateKey];
            if(isOccurrenceCompleted) return; // Skip if already completed

            const notify = (typeKey: string, titleKey: keyof Translations, descKey: keyof Translations, params: { activityTitle: string }) => {
              const notificationFullKey = `${masterId}:${instanceDateKey}:${typeKey}`; // Unique key per instance & type
              if (!notifiedToday.has(notificationFullKey)) {
                const notifTitle = t(titleKey as any, params);
                const notifDesc = t(descKey as any, params);
                showSystemNotification(notifTitle, notifDesc);
                stableAddUINotification({ title: notifTitle, description: notifDesc, activityId: masterId, instanceDate: instance.instanceDate.getTime() });
                toast({ title: notifTitle, description: notifDesc });
                setNotifiedToday(prev => new Set(prev).add(notificationFullKey));
              }
            };

            // Calculate notification trigger dates based on the instance's date
            const oneDayBeforeInstance = dateFnsStartOfDay(subDays(instance.instanceDate, 1));
            const twoDaysBeforeInstance = dateFnsStartOfDay(subDays(instance.instanceDate, 2));
            const oneWeekBeforeInstance = dateFnsStartOfDay(subWeeks(instance.instanceDate, 1));

            // Compare 'today' with these trigger dates
            if (recurrenceType === 'weekly') { // Specific logic for weekly (e.g., only 1 day before)
                if (isSameDay(today, oneDayBeforeInstance)) {
                    notify('1day_weekly', 'toastActivityTomorrowTitle', 'toastActivityTomorrowDescription', { activityTitle });
                }
            } else if (recurrenceType === 'monthly') { // Specific logic for monthly
                if (isSameDay(today, oneWeekBeforeInstance)) {
                    notify('1week_monthly', 'toastActivityInOneWeekTitle', 'toastActivityInOneWeekDescription', { activityTitle });
                }
                if (isSameDay(today, twoDaysBeforeInstance)) { // Example: also notify 2 days before for monthly
                     notify('2days_monthly', 'toastActivityInTwoDaysTitle', 'toastActivityInTwoDaysDescription', { activityTitle });
                }
                if (isSameDay(today, oneDayBeforeInstance)) {
                    notify('1day_monthly', 'toastActivityTomorrowTitle', 'toastActivityTomorrowDescription', { activityTitle });
                }
            }
            // Could add a 'daily' case if specific pre-notifications are needed for daily recurrences
          });
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [personalActivities, workActivities, appModeState, isLoadingState, isAuthenticated, toast, t, lastNotificationCheckDay, notifiedToday, stableAddUINotification, dateFnsLocale, showSystemNotification, locale]);

  // Logout listener for multi-tab/window sync
  useEffect(() => {
    if (!logoutChannel) return;
    const handleLogoutMessage = (event: MessageEvent) => { if (event.data === 'logout_event_v2' && isAuthenticated) logout();}; // Use new event name
    logoutChannel.addEventListener('message', handleLogoutMessage);
    return () => { if (logoutChannel) logoutChannel.removeEventListener('message', handleLogoutMessage);};
  }, [isAuthenticated, logout]);


  // --- Pomodoro Service Worker Integration ---
  const postToServiceWorker = useCallback((message: any) => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      // Include locale and other necessary state directly in the payload
      navigator.serviceWorker.controller.postMessage({...message, payload: { ...message.payload, locale } });
    } else {
      // Handle case where SW is not ready, especially if trying to start a timer
      if (message.type !== 'GET_INITIAL_STATE' && !isPomodoroReady) { // Avoid toast on initial state get
        toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: t('pomodoroSWNotReady') as string });
      }
    }
  }, [locale, t, toast, isPomodoroReady]); // isPomodoroReady added to deps

  // Handle messages from Service Worker
  const handleSWMessage = useCallback((event: MessageEvent) => {
        if (event.data && event.data.type) {
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
            // Potentially handle 'TIMER_READY' if SW sends it
        }
    }, [isPomodoroReady, toast, t]); // Added isPomodoroReady

  // Register SW and set up communication
  useEffect(() => {
    const registerAndInitializeSW = async () => {
        try {
            await navigator.serviceWorker.register('/sw.js', { scope: '/' }); // Register the SW
            await navigator.serviceWorker.ready; // Wait for SW to be ready
            // After SW is ready, try to get initial state
            if (navigator.serviceWorker.controller) {
                // Delay slightly to ensure SW controller is fully active after registration/ready
                setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
            } else {
                // This case might occur if the page loads before SW controller is active
                // The 'controllerchange' listener should handle this.
                setIsPomodoroReady(false); // Explicitly set not ready
            }
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            setIsPomodoroReady(false); // SW failed to register
            toast({ variant: 'destructive', title: t('pomodoroErrorTitle') as string, description: `SW Reg Error: ${error instanceof Error ? error.message : String(error)}`});
        }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', handleSWMessage);

        // Listener for when SW controller changes (e.g., first activation)
        const handleControllerChange = () => {
            if (navigator.serviceWorker.controller) {
                setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
            } else {
                setIsPomodoroReady(false);
            }
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        // Attempt registration based on document ready state or load event
        if (document.readyState === 'complete') {
            registerAndInitializeSW();
        } else {
            window.addEventListener('load', registerAndInitializeSW, { once: true });
        }
        // If controller already exists on initial load, get state
        if (navigator.serviceWorker.controller) {
             setTimeout(() => postToServiceWorker({ type: 'GET_INITIAL_STATE' }), 200);
        }

    } else {
        setIsPomodoroReady(false); // SW not supported
    }

    return () => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.removeEventListener('message', handleSWMessage);
            // Consider removing controllerchange listener if added
        }
    };
  }, [locale, postToServiceWorker, handleSWMessage, t, toast]); // Dependencies

  // Effect to show notifications when Pomodoro phase changes (ends)
  useEffect(() => {
    if (isPomodoroReady && prevPomodoroPhaseRef.current !== pomodoroPhase && prevPomodoroPhaseRef.current !== 'off') { // Only if previous phase was active
        const phaseThatEnded = prevPomodoroPhaseRef.current;
        let titleKey: keyof Translations = 'pomodoroWorkSessionEnded'; // Default
        let descriptionKey: keyof Translations = 'pomodoroFocusOnTask'; // Default

        if (phaseThatEnded === 'work') {
            titleKey = 'pomodoroWorkSessionEnded';
            descriptionKey = (pomodoroCyclesCompleted > 0 && pomodoroCyclesCompleted % 4 === 0) // Assuming 4 cycles for long break
                             ? 'pomodoroTakeALongBreak'
                             : 'pomodoroTakeAShortBreak';
        } else if (phaseThatEnded === 'shortBreak') {
            titleKey = 'pomodoroShortBreakEnded';
            descriptionKey = 'pomodoroBackToWork';
        } else if (phaseThatEnded === 'longBreak') {
            titleKey = 'pomodoroLongBreakEnded';
            descriptionKey = 'pomodoroBackToWork';
        }
        const title = t(titleKey as any); // Cast to any to satisfy TS for dynamic keys
        const description = t(descriptionKey as any);

        if (title && description) { // Ensure translations are found
            stableAddUINotification({ title, description, activityId: `pomodoro_cycle_${pomodoroCyclesCompleted}_${phaseThatEnded}` });
            // showSystemNotification(title, description); // Consider if this is too noisy for phase changes
            toast({ title, description });
        }
    }
    prevPomodoroPhaseRef.current = pomodoroPhase; // Update ref after processing
  }, [pomodoroPhase, pomodoroCyclesCompleted, isPomodoroReady, stableAddUINotification, t, toast, showSystemNotification]);

  // Pomodoro action dispatchers
  const startPomodoroWork = useCallback(() => postToServiceWorker({ type: 'START_WORK', payload: { locale, cyclesCompleted: 0 } }), [postToServiceWorker, locale]);
  const startPomodoroShortBreak = useCallback(() => postToServiceWorker({ type: 'START_SHORT_BREAK', payload: { locale } }), [postToServiceWorker, locale]);
  const startPomodoroLongBreak = useCallback(() => postToServiceWorker({ type: 'START_LONG_BREAK', payload: { locale } }), [postToServiceWorker, locale]);
  const pausePomodoro = useCallback(() => postToServiceWorker({ type: 'PAUSE_TIMER', payload: { locale } }), [postToServiceWorker, locale]);
  const resumePomodoro = useCallback(() => postToServiceWorker({ type: 'RESUME_TIMER', payload: { locale } }), [postToServiceWorker, locale]);
  const resetPomodoro = useCallback(() => {
    setIsPomodoroReady(false); // Assume it will become unready until SW confirms reset
    postToServiceWorker({ type: 'RESET_TIMER', payload: { locale } });
  }, [postToServiceWorker, locale]);


  // --- CRUD and Action Callbacks ---
  const setAppMode = useCallback((mode: AppMode) => {
    if (mode !== appModeState) {
      addHistoryLogEntry(mode === 'personal' ? 'historyLogSwitchToPersonalMode' : 'historyLogSwitchToWorkMode', undefined, 'account');
    }
    setAppModeState(mode);
  }, [appModeState, addHistoryLogEntry]);
  
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setError(null);
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

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
      await decodeAndSetToken(tokenData.access_token); // This sets jwtToken state
      
      // After successful login and token set, fetch initial data using the new token explicitly
      // This section will now run AFTER jwtToken state is updated due to the useEffect dependency on jwtToken
      // No need to duplicate fetch logic here, rely on the main useEffect for data loading.
      // However, we need to ensure that the main data loading useEffect *does* run.
      // The change in jwtToken state (from null to a value) will trigger it.

      addHistoryLogEntry('historyLogLogin', undefined, 'account');
      // Show a success notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === "granted") {
        const title = t('loginSuccessNotificationTitle');
        const description = t('loginSuccessNotificationDescription');
        stableAddUINotification({ title, description });
        showSystemNotification(title, description);
      }
      return true;
    } catch (err) {
      createApiErrorToast(err, toast, "loginErrorTitle", "authenticating", t, `${API_BASE_URL}/token`);
      setError((err as Error).message);
      return false;
    }
  }, [decodeAndSetToken, addHistoryLogEntry, t, toast, stableAddUINotification, showSystemNotification]); // Removed fetchWithAuth as data fetching is handled by main useEffect

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        // This should ideally not happen if user is logged in, but as a safeguard:
        toast({ variant: "destructive", title: t('loginErrorTitle'), description: "User not identified for password change."});
        return false;
    }
    setError(null);
    const payload = { old_password: oldPassword, new_password: newPassword };
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${currentUserId}/change-password`, {
            method: 'POST', // Ensure this matches your backend (FastAPI uses POST for this)
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(formatBackendError(errorData, `Password change failed: HTTP ${response.status}`));
        }
        addHistoryLogEntry('historyLogPasswordChangeAttempt', undefined, 'account'); // Log attempt
        toast({ title: t('passwordUpdateSuccessTitle'), description: t('passwordUpdateSuccessDescription') });
        return true;
    } catch (err) {
        createApiErrorToast(err, toast, "changePasswordModalTitle", "updating", t, `${API_BASE_URL}/users/${currentUserId}/change-password`);
        setError((err as Error).message);
        return false;
    }
  }, [fetchWithAuth, getCurrentUserId, addHistoryLogEntry, t, toast]);


  // Category CRUD
  const addCategory = useCallback(async (name: string, iconName: string, mode: AppMode | 'all') => {
    setError(null);
    const payload: BackendCategoryCreatePayload = { name, icon_name: iconName, mode: frontendToBackendCategoryMode(mode) };
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/categories`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add category: HTTP ${response.status}`));}
      const newBackendCategory: BackendCategory = await response.json();
      setAllCategories(prev => [...prev, backendToFrontendCategory(newBackendCategory)]);
      toast({ title: t('toastCategoryAddedTitle'), description: t('toastCategoryAddedDescription', { categoryName: name }) });
      addHistoryLogEntry(mode === 'personal' ? 'historyLogAddCategoryPersonal' : mode === 'work' ? 'historyLogAddCategoryWork' : 'historyLogAddCategoryAll', { name }, 'category');
    } catch (err) { createApiErrorToast(err, toast, "toastCategoryAddedTitle", "adding", t, `${API_BASE_URL}/categories`); setError((err as Error).message); throw err; }
  }, [fetchWithAuth, toast, t, addHistoryLogEntry]);

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
      let actionKey: HistoryLogActionKey = 'historyLogUpdateCategoryAll';
      if (updatedFrontendCategory.mode === 'personal') actionKey = 'historyLogUpdateCategoryPersonal';
      else if (updatedFrontendCategory.mode === 'work') actionKey = 'historyLogUpdateCategoryWork';
      addHistoryLogEntry(actionKey, { name: updatedFrontendCategory.name, oldName: oldCategoryData?.name !== updatedFrontendCategory.name ? oldCategoryData?.name : undefined , oldMode: oldCategoryData?.mode !== updatedFrontendCategory.mode ? oldCategoryData?.mode : undefined }, 'category');
    } catch (err) { createApiErrorToast(err, toast, "toastCategoryUpdatedTitle", "updating", t, `${API_BASE_URL}/categories/${categoryId}`); setError((err as Error).message); throw err; }
  }, [fetchWithAuth, toast, t, addHistoryLogEntry]);

  const deleteCategory = useCallback(async (categoryId: number) => {
    setError(null);
    const categoryToDelete = allCategories.find(cat => cat.id === categoryId);
    if (!categoryToDelete) return; // Should not happen if UI is consistent
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/categories/${categoryId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete category: HTTP ${response.status}`));}
      setAllCategories(prev => prev.filter(cat => cat.id !== categoryId));
      // Remove category from activities (client-side only, backend should handle cascade or leave as is)
      const updateActivitiesCategory = (acts: Activity[]) => acts.map(act => act.categoryId === categoryId ? { ...act, categoryId: 0 } : act); // Example: set to uncat.
      setPersonalActivities(prev => updateActivitiesCategory(prev));
      setWorkActivities(prev => updateActivitiesCategory(prev));
      toast({ title: t('toastCategoryDeletedTitle'), description: t('toastCategoryDeletedDescription', { categoryName: categoryToDelete.name }) });
      addHistoryLogEntry('historyLogDeleteCategory', { name: categoryToDelete.name, mode: categoryToDelete.mode as string }, 'category');
    } catch (err) { createApiErrorToast(err, toast, "toastCategoryDeletedTitle", "deleting", t, `${API_BASE_URL}/categories/${categoryId}`); setError((err as Error).message); throw err; }
  }, [fetchWithAuth, allCategories, toast, t, addHistoryLogEntry]);

  // Assignee (User) CRUD
  const addAssignee = useCallback(async (name: string, username: string, password?: string, isAdmin?: boolean) => {
    setError(null);
    if (!password) { // Password is required by backend for UserCreate
        toast({variant: "destructive", title: t('loginErrorTitle'), description: "Password is required to create a user."}); // Use a more generic error or specific one
        throw new Error("Password is required to create a user.");
    }
    const payload: BackendUserCreatePayload = { name, username, password, is_admin: isAdmin || false };

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/users`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add assignee: HTTP ${response.status}`));}
      const newBackendUser: BackendUser = await response.json();
      setAllAssignees(prev => [...prev, backendToFrontendAssignee(newBackendUser)]);
      toast({ title: t('toastAssigneeAddedTitle'), description: t('toastAssigneeAddedDescription', { assigneeName: name }) });
      addHistoryLogEntry('historyLogAddAssignee', { name, isAdmin: newBackendUser.is_admin ? 1 : 0 }, 'assignee');
    } catch (err) { createApiErrorToast(err, toast, "toastAssigneeAddedTitle", "adding", t, `${API_BASE_URL}/users`); setError((err as Error).message); throw err; }
  }, [fetchWithAuth, toast, t, addHistoryLogEntry]);

  const updateAssignee = useCallback(async (assigneeId: number, updates: Partial<Pick<Assignee, 'name' | 'username' | 'isAdmin'>>, newPassword?: string) => {
    setError(null);
    const currentAssignee = assignees.find(a => a.id === assigneeId);
    
    // Construct payload based on UserUpdate schema
    const payload: BackendUserUpdatePayload = { /* name: string, username: string, password: Optional[str], is_admin: Optional[bool] */ };
    if (updates.name) payload.name = updates.name;
    if (updates.username) payload.username = updates.username;
    if (newPassword) payload.password = newPassword; // Backend UserUpdate accepts optional password
    if (updates.isAdmin !== undefined) payload.is_admin = updates.isAdmin;


    try {
      // The backend /users/{user_id} PUT endpoint expects a JSON body
      const response = await fetchWithAuth(`${API_BASE_URL}/users/${assigneeId}`, {
         method: 'PUT',
         body: JSON.stringify(payload) // Send as JSON
      });

      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update assignee: HTTP ${response.status}`));}
      const updatedBackendUser: BackendUser = await response.json();
      const frontendAssignee = backendToFrontendAssignee(updatedBackendUser);
      
      setAllAssignees(prev => prev.map(asg => (asg.id === assigneeId ? frontendAssignee : asg)));
      toast({ title: t('toastAssigneeUpdatedTitle'), description: t('toastAssigneeUpdatedDescription', { assigneeName: updatedBackendUser.name }) });
      
      // Detailed history logging for assignee update
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
      // Password change is not explicitly logged here beyond "update assignee" for privacy/security.
      addHistoryLogEntry('historyLogUpdateAssignee', historyDetails, 'assignee');

    } catch (err) {
        // Specific error handling for username taken, if backend returns a distinct error
        if (!(err instanceof Error && err.message.includes(t('usernameTakenErrorDescription', {username: updates.username || ''})))) {
            createApiErrorToast(err, toast, "toastAssigneeUpdatedTitle", "updating", t, `${API_BASE_URL}/users/${assigneeId}`);
        }
        setError((err as Error).message); throw err;
    }
  }, [fetchWithAuth, assignees, toast, t, addHistoryLogEntry]);

  const deleteAssignee = useCallback(async (assigneeId: number) => {
    setError(null);
    const assigneeToDelete = assignees.find(asg => asg.id === assigneeId);
    if (!assigneeToDelete) return; // Should not happen
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/users/${assigneeId}`, { method: 'DELETE' });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to delete assignee: HTTP ${response.status}`));}
      setAllAssignees(prev => prev.filter(asg => asg.id !== assigneeId));
      // Update activities: remove deleted assignee from responsiblePersonIds (client-side)
      // Backend might handle this differently (e.g., cascade, set null, restrict delete)
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
  }, [fetchWithAuth, assignees, toast, t, addHistoryLogEntry]);


  // Activity CRUD
  const addActivity = useCallback(async (
      activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'completedAt' | 'notes' | 'recurrence' | 'completedOccurrences' | 'responsiblePersonIds' | 'categoryId'| 'appMode'| 'masterActivityId' | 'isRecurringInstance' | 'originalInstanceDate'> & {
        todos?: Omit<Todo, 'id' | 'completed'>[]; time?: string; notes?: string; recurrence?: RecurrenceRule | null; responsiblePersonIds?: number[]; categoryId: number; appMode: AppMode;
      }, customCreatedAt?: number
    ) => {
    setError(null);
    // Construct a shell of the frontend Activity to pass to the payload converter
    const frontendActivityShell: Activity = {
      id: 0, // Placeholder, backend will assign
      title: activityData.title,
      categoryId: activityData.categoryId,
      todos: (activityData.todos || []).map(t => ({ id: 0, text: t.text, completed: false })), // Placeholder IDs
      createdAt: customCreatedAt !== undefined ? customCreatedAt : Date.now(), // Use custom or now
      time: activityData.time,
      notes: activityData.notes,
      recurrence: activityData.recurrence,
      responsiblePersonIds: activityData.responsiblePersonIds,
      appMode: activityData.appMode,
      completedOccurrences: {}, // Initialize empty
    };

    const payload = frontendToBackendActivityPayload(frontendActivityShell) as BackendActivityCreatePayload;
    // Ensure todos are in the correct format for BackendActivityCreatePayload
    payload.todos = (activityData.todos || []).map(t => ({text: t.text, complete: false}));


    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/activities`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add activity: HTTP ${response.status}`));}
      
      const newBackendActivity: BackendActivity | null | undefined = await response.json().catch(() => null);
      // If newBackendActivity is null or undefined here, backendToFrontendActivity will handle it.
      const newFrontendActivity = backendToFrontendActivity(newBackendActivity, appModeState); // Pass current appMode for context
      
      // Add to the correct list based on its mode (which should be set by backend or inferred)
      if (newFrontendActivity.appMode === 'personal') {
        setPersonalActivities(prev => [...prev, newFrontendActivity]);
      } else {
        setWorkActivities(prev => [...prev, newFrontendActivity]);
      }
      toast({ title: t('toastActivityAddedTitle'), description: t('toastActivityAddedDescription') });
      addHistoryLogEntry(appModeState === 'personal' ? 'historyLogAddActivityPersonal' : 'historyLogAddActivityWork', { title: newFrontendActivity.title }, appModeState);
    } catch (err) { createApiErrorToast(err, toast, "toastActivityAddedTitle", "adding", t, `${API_BASE_URL}/activities`); setError((err as Error).message); throw err; }
  }, [fetchWithAuth, appModeState, toast, t, addHistoryLogEntry]);

 const updateActivity = useCallback(async (activityId: number, updates: Partial<Omit<Activity, 'id'>>, originalActivity?: Activity) => {
    setError(null);
    // Determine which list the activity currently resides in
    let currentActivitiesList = personalActivities.find(a => a.id === activityId) ? personalActivities : workActivities;
    let activityToUpdate = currentActivitiesList.find(a => a.id === activityId);
    let targetSetter = personalActivities.find(a => a.id === activityId) ? setPersonalActivities : setWorkActivities;

    if (!activityToUpdate) {
      console.error("[AppProvider] Activity not found for update:", activityId);
      toast({variant: "destructive", title: "Error", description: "Activity not found for update."});
      return;
    }
    
    // Determine the appMode for the payload: use updated mode if present, else current activity's mode
    const effectiveAppMode = updates.appMode || activityToUpdate.appMode;
    const payload = frontendToBackendActivityPayload({ ...activityToUpdate, ...updates, appMode: effectiveAppMode }, true) as BackendActivityUpdatePayload;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to update activity: HTTP ${response.status}`));}
      const updatedBackendActivity: BackendActivity = await response.json();
      
      // Convert backend response to frontend format.
      // Pass appModeState as currentAppMode, but backendActivity.mode should reflect the true mode if changed.
      let processedActivityFromBackend = backendToFrontendActivity(updatedBackendActivity, appModeState);
      
      // If the 'updates' object (from the form) included a 'todos' array,
      // prioritize that for the local state update, as the PUT /activities/{id}
      // backend endpoint might not return/process todos directly for updates.
      // Individual todo changes are handled by POST/PUT/DELETE to /todos endpoints.
      if (updates.todos && Array.isArray(updates.todos)) {
         // Ensure todo IDs are numbers if they exist
         processedActivityFromBackend.todos = updates.todos.map(t => ({
            id: t.id as number, // Assume ID is present if it's an existing todo from form
            text: t.text,
            completed: !!t.completed
         }));
      } else if (activityToUpdate && (!processedActivityFromBackend.todos || processedActivityFromBackend.todos.length === 0) && activityToUpdate.todos.length > 0) {
          // If backend response didn't include todos, but original activity had them, retain original todos (unless explicitly cleared by updates)
          processedActivityFromBackend.todos = activityToUpdate.todos;
      }
      
      const finalFrontendActivity = {
        ...processedActivityFromBackend,
        // Preserve client-side managed states not returned by backend PUT /activities/{id}
        completedOccurrences: activityToUpdate.completedOccurrences || {}, // Preserve existing completed occurrences
        // Overall 'completed' status for non-recurring or series master (client concept)
        completed: updates.completed !== undefined ? updates.completed : activityToUpdate.completed,
        completedAt: updates.completedAt !== undefined ? updates.completedAt : activityToUpdate.completedAt,
      };

      // Handle if 'completedOccurrences' was part of the direct updates from client (e.g. toggle)
      if (updates.completedOccurrences) {
        finalFrontendActivity.completedOccurrences = { ...finalFrontendActivity.completedOccurrences, ...updates.completedOccurrences };
      }

      // Handle activity moving between personal/work lists if appMode changed
      if (originalActivity && finalFrontendActivity.appMode !== originalActivity.appMode) {
        // Remove from old list
        if (originalActivity.appMode === 'personal') setPersonalActivities(prev => prev.filter(act => act.id !== activityId));
        else setWorkActivities(prev => prev.filter(act => act.id !== activityId));
        // Add to new list
        if (finalFrontendActivity.appMode === 'personal') setPersonalActivities(prev => [...prev, finalFrontendActivity]);
        else setWorkActivities(prev => [...prev, finalFrontendActivity]);
      } else {
         // Update in its current list
         targetSetter(prev => prev.map(act => (act.id === activityId ? finalFrontendActivity : act)));
      }

      toast({ title: t('toastActivityUpdatedTitle'), description: t('toastActivityUpdatedDescription') });
      addHistoryLogEntry(finalFrontendActivity.appMode === 'personal' ? 'historyLogUpdateActivityPersonal' : 'historyLogUpdateActivityWork', { title: finalFrontendActivity.title }, finalFrontendActivity.appMode);
    } catch (err) { createApiErrorToast(err, toast, "toastActivityUpdatedTitle", "updating", t, `${API_BASE_URL}/activities/${activityId}`); setError((err as Error).message); throw err; }
  }, [fetchWithAuth, appModeState, personalActivities, workActivities, toast, t, addHistoryLogEntry]);

  const deleteActivity = useCallback(async (activityId: number) => {
    setError(null);
    
    // Find which list the activity is in to determine its mode for logging and which state to update
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
      addHistoryLogEntry(modeForLog === 'personal' ? 'historyLogDeleteActivityPersonal' : 'historyLogDeleteActivityWork', { title: activityToDelete.title }, modeForLog);
    } catch (err) { createApiErrorToast(err, toast, "toastActivityDeletedTitle", "deleting", t, `${API_BASE_URL}/activities/${activityId}`); setError((err as Error).message); throw err; }
  }, [fetchWithAuth, personalActivities, workActivities, toast, t, addHistoryLogEntry]);


  // Todo CRUD within an Activity
  const addTodoToActivity = useCallback(async (activityId: number, todoText: string, completed: boolean = false) => {
    setError(null);
    const payload: BackendTodoCreate = { text: todoText, complete: completed };
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/activities/${activityId}/todos`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) { const errorData = await response.json().catch(() => ({ detail: response.statusText })); throw new Error(formatBackendError(errorData, `Failed to add todo: HTTP ${response.status}`));}
      const newBackendTodo: BackendTodo = await response.json();
      const newFrontendTodo: Todo = {
        id: newBackendTodo.id, // Use ID from backend response
        text: newBackendTodo.text,
        completed: newBackendTodo.complete // Use completion status from backend
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
      // Optionally add history log for todo addition
    } catch (err) { createApiErrorToast(err, toast, "toastTodoAddedTitle", "adding", t, `${API_BASE_URL}/activities/${activityId}/todos`); setError((err as Error).message); throw err; }
  }, [fetchWithAuth, personalActivities, workActivities, toast, t]); // addHistoryLogEntry if needed

  const updateTodoInActivity = useCallback(async (activityId: number, todoId: number, updates: Partial<Todo>) => {
    setError(null);
    const payload: Partial<BackendTodo> = {}; // Use BackendTodo for payload keys
    if (updates.text !== undefined) payload.text = updates.text;
    if (updates.completed !== undefined) payload.complete = updates.completed;

    if (Object.keys(payload).length === 0) return; // No actual updates to send

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
                // Toast only if text changed, completion toggle is usually silent or has its own feedback
                if (updates.text) {
                    toast({ title: t('toastTodoUpdatedTitle'), description: t('toastTodoUpdatedDescription', { todoText: updates.text || "" }) });
                }
            }
        };
        updateInList(personalActivities, setPersonalActivities);
        updateInList(workActivities, setWorkActivities);
        // Optionally add history log for todo update
    } catch (err) {
        createApiErrorToast(err, toast, "toastTodoUpdatedTitle", "updating", t, `${API_BASE_URL}/todos/${todoId}`);
        setError((err as Error).message);
        throw err;
    }
  }, [fetchWithAuth, personalActivities, workActivities, t, toast]); // addHistoryLogEntry if needed

  const deleteTodoFromActivity = useCallback(async (activityId: number, todoId: number) => {
    setError(null);
    // Find the todo text for the toast message before it's removed from state
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
      // Optionally add history log for todo deletion
    } catch (err) { createApiErrorToast(err, toast, "toastTodoDeletedTitle", "deleting", t, `${API_BASE_URL}/todos/${todoId}`); setError((err as Error).message); throw err; }
  }, [fetchWithAuth, personalActivities, workActivities, toast, t]); // addHistoryLogEntry if needed

  // Toggle completion for a specific occurrence of a recurring activity
  const toggleOccurrenceCompletion = useCallback((masterActivityId: number, occurrenceDateTimestamp: number, completedState: boolean) => {
    // This is primarily a client-side concept for now, as the backend doesn't store individual occurrence completions.
    // If it were to be synced, an API call would be needed here.
    let activityTitleForLog = 'Unknown Activity';
    // Determine which list and setter to use
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
            delete updatedOccurrences[occurrenceDateKey]; // Remove the key if un-completed
          }
          return { ...act, completedOccurrences: updatedOccurrences };
        }
        return act;
      })
    );
    // Log this client-side action
    addHistoryLogEntry(modeForLog === 'personal' ? 'historyLogToggleActivityCompletionPersonal' : 'historyLogToggleActivityCompletionWork', { title: activityTitleForLog, completed: completedState ? 1 : 0 }, modeForLog);
  }, [personalActivities, workActivities, addHistoryLogEntry]); // Dependencies


  // --- Helper Getters ---
  const getCategoryById = useCallback((categoryId: number) => allCategories.find(cat => cat.id === categoryId), [allCategories]);
  const getAssigneeById = useCallback((assigneeId: number) => assignees.find(asg => asg.id === assigneeId), [assignees]);

  // --- UI Notification Management ---
  const markUINotificationAsRead = useCallback((notificationId: string) => setUINotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n)), []);
  const markAllUINotificationsAsRead = useCallback(() => setUINotifications(prev => prev.map(n => ({ ...n, read: true }))), []);
  const clearAllUINotifications = useCallback(() => setUINotifications([]), []);
  // --- App Lock ---
  const unlockApp = useCallback((pinAttempt: string): boolean => { if (appPinState && pinAttempt === appPinState) { setIsAppLocked(false); return true; } return false; }, [appPinState]);
  const setAppPin = useCallback((pin: string | null) => {
    setAppPinState(pin);
    if (typeof window !== 'undefined') { if (pin) localStorage.setItem(LOCAL_STORAGE_KEY_APP_PIN, pin); else { localStorage.removeItem(LOCAL_STORAGE_KEY_APP_PIN); setIsAppLocked(false);}}
  }, []);

  // App lock on visibility change
   useEffect(() => {
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible' && isAuthenticated && appPinState) setIsAppLocked(true);};
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, appPinState]);

  // Combined loading state for the app
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
        isAuthenticated, login, logout, changePassword, getCurrentUserId,
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

