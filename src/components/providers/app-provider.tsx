
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { Activity, Todo, Category, AppMode, RecurrenceRule, UINotification } from '@/lib/types';
import { INITIAL_CATEGORIES } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import {
  isSameDay, formatISO, parseISO,
  addDays, addWeeks, addMonths,
  subDays, subWeeks,
  startOfDay, endOfDay,
  isBefore, isAfter,
  getDay, getDate,
  isWithinInterval,
  setDate as setDayOfMonthFn, 
  addYears, isEqual,
  formatDistanceToNowStrict,
} from 'date-fns';
import * as Icons from 'lucide-react';
import { useTranslations } from '@/contexts/language-context';
import { enUS, es } from 'date-fns/locale';
import { useTheme } from 'next-themes';


export interface AppContextType {
  activities: Activity[];
  getRawActivities: () => Activity[];
  categories: Category[];
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  addActivity: (
    activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'notes' | 'recurrence' | 'completedOccurrences'> & {
      todos?: Omit<Todo, 'id' | 'completed'>[];
      time?: string;
      notes?: string;
      recurrence?: RecurrenceRule | null;
    },
    customCreatedAt?: number
  ) => void;
  updateActivity: (activityId: string, updates: Partial<Activity>) => void;
  deleteActivity: (activityId: string) => void;
  toggleOccurrenceCompletion: (masterActivityId: string, occurrenceDateTimestamp: number, completed: boolean) => void;
  addTodoToActivity: (activityId: string, todoText: string) => void;
  updateTodoInActivity: (activityId: string, todoId: string, updates: Partial<Todo>) => void;
  deleteTodoFromActivity: (activityId: string, todoId: string, masterActivityId?: string) => void;
  getCategoryById: (categoryId: string) => Category | undefined;
  addCategory: (name: string, iconName: string, mode: AppMode | 'all') => void;
  updateCategory: (categoryId: string, updates: Partial<Omit<Category, 'id' | 'icon'>>) => void;
  deleteCategory: (categoryId: string) => void;
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

  uiNotifications: UINotification[];
  addUINotification: (data: Omit<UINotification, 'id' | 'timestamp' | 'read'>) => void;
  markUINotificationAsRead: (notificationId: string) => void;
  markAllUINotificationsAsRead: () => void;
  clearAllUINotifications: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES = 'todoFlowPersonalActivities_v2';
const LOCAL_STORAGE_KEY_WORK_ACTIVITIES = 'todoFlowWorkActivities_v2';
const LOCAL_STORAGE_KEY_ALL_CATEGORIES = 'todoFlowAllCategories_v1';
const LOCAL_STORAGE_KEY_APP_MODE = 'todoFlowAppMode';
const LOCAL_STORAGE_KEY_IS_AUTHENTICATED = 'todoFlowIsAuthenticated';
const LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS = 'todoFlowLoginAttempts';
const LOCAL_STORAGE_KEY_LOCKOUT_END_TIME = 'todoFlowLockoutEndTime';
const LOCAL_STORAGE_KEY_SESSION_EXPIRY = 'todoFlowSessionExpiry';
const LOCAL_STORAGE_KEY_UI_NOTIFICATIONS = 'todoFlowUINotifications_v1';


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
  masterActivityId: string;
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
          let tempDate = startOfDay(rangeStartDate); 
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
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const toHexByte = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHexByte(f(0))}${toHexByte(f(8))}${toHexByte(f(4))}`;
}


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [personalActivities, setPersonalActivities] = useState<Activity[]>([]);
  const [workActivities, setWorkActivities] = useState<Activity[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [appModeState, setAppModeState] = useState<AppMode>('personal');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, locale } = useTranslations();
  const dateLocale = locale === 'es' ? es : enUS;

  const [lastNotificationCheckDay, setLastNotificationCheckDay] = useState<number | null>(null);
  const [notifiedToday, setNotifiedToday] = useState<Set<string>>(new Set());

  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(false);
  const [loginAttempts, setLoginAttemptsState] = useState<number>(0);
  const [lockoutEndTime, setLockoutEndTimeState] = useState<number | null>(null);
  const [sessionExpiryTimestamp, setSessionExpiryTimestampState] = useState<number | null>(null);

  const [uiNotifications, setUINotifications] = useState<UINotification[]>([]);
  const { theme, resolvedTheme } = useTheme();


  useEffect(() => {
    if (typeof window === 'undefined' || isLoading) {
      return;
    }
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
            console.warn("Could not parse --background HSL string:", backgroundHslString);
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
    if (isLoading) { // Ensure categories are empty if AppProvider is still loading
      return [];
    }
    return allCategories.filter(cat =>
      !cat.mode || cat.mode === 'all' || cat.mode === appModeState
    );
  }, [allCategories, appModeState, isLoading]);

  const logout = useCallback(() => {
    setIsAuthenticatedState(false);
    setLoginAttemptsState(0);
    setLockoutEndTimeState(null);
    setSessionExpiryTimestampState(null);

    if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);
        localStorage.removeItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS);
        localStorage.removeItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME);
        localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY);
    }

    if (logoutChannel) {
      logoutChannel.postMessage('logout_event');
    }
  }, []);

 useEffect(() => {
    let initialAuth = false;
    try {
      const storedPersonalActivities = localStorage.getItem(LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES);
      if (storedPersonalActivities) setPersonalActivities(JSON.parse(storedPersonalActivities));

      const storedWorkActivities = localStorage.getItem(LOCAL_STORAGE_KEY_WORK_ACTIVITIES);
      if (storedWorkActivities) setWorkActivities(JSON.parse(storedWorkActivities));

      const storedAllCategories = localStorage.getItem(LOCAL_STORAGE_KEY_ALL_CATEGORIES);
      let useInitialCategoriesAsFallback = true;

      if (storedAllCategories) {
        try {
          const parsedCategories = JSON.parse(storedAllCategories) as Array<Omit<Category, 'icon'>>;
          if (Array.isArray(parsedCategories) && parsedCategories.length > 0) {
            setAllCategories(parsedCategories.map((cat) => ({
              ...cat,
              icon: getIconComponent(cat.iconName || 'Package'),
              mode: cat.mode || 'all'
            })));
            useInitialCategoriesAsFallback = false;
          }
        } catch (e) {
          console.error("Failed to parse categories from localStorage, using defaults.", e);
        }
      }

      if (useInitialCategoriesAsFallback) {
        setAllCategories(INITIAL_CATEGORIES.map(cat => ({...cat, icon: getIconComponent(cat.iconName)})));
      }

      const storedAppMode = localStorage.getItem(LOCAL_STORAGE_KEY_APP_MODE) as AppMode | null;
      if (storedAppMode && (storedAppMode === 'personal' || storedAppMode === 'work')) {
        setAppModeState(storedAppMode);
      }

      const storedAuth = localStorage.getItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);
      const storedExpiry = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY);

      if (storedAuth === 'true' && storedExpiry) {
        const expiryTime = parseInt(storedExpiry, 10);
        if (Date.now() > expiryTime) {
          initialAuth = false; // Session expired
           // No need to call full logout() here, just clear the flags
          localStorage.removeItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);
          localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY);
        } else {
          initialAuth = true;
          setSessionExpiryTimestampState(expiryTime);
        }
      }
      setIsAuthenticatedState(initialAuth);


      const storedAttempts = localStorage.getItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS);
      setLoginAttemptsState(storedAttempts ? parseInt(storedAttempts, 10) : 0);

      const storedLockoutTime = localStorage.getItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME);
      setLockoutEndTimeState(storedLockoutTime ? parseInt(storedLockoutTime, 10) : null);

      const storedUINotifications = localStorage.getItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS);
      if (storedUINotifications) setUINotifications(JSON.parse(storedUINotifications));

    } catch (err) {
      console.error("Failed to load data from local storage", err);
      setError("Failed to load saved data.");
       if (allCategories.length === 0) { 
        setAllCategories(INITIAL_CATEGORIES.map(cat => ({...cat, icon: getIconComponent(cat.iconName)})));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    if (!isLoading) {
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
      const serializableCategories = allCategories.map(({ icon, ...rest }) => rest);
      localStorage.setItem(LOCAL_STORAGE_KEY_ALL_CATEGORIES, JSON.stringify(serializableCategories));
    }
  }, [allCategories, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(LOCAL_STORAGE_KEY_APP_MODE, appModeState);
      const root = document.documentElement;
      root.classList.remove('mode-personal', 'mode-work');
      root.classList.add(appModeState === 'work' ? 'mode-work' : 'mode-personal');
    }
  }, [appModeState, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        localStorage.setItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED, 'true');
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_IS_AUTHENTICATED);
      }
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS, String(loginAttempts));
    }
  }, [loginAttempts, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (lockoutEndTime === null) {
        localStorage.removeItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME);
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME, String(lockoutEndTime));
      }
    }
  }, [lockoutEndTime, isLoading]);

   useEffect(() => {
    if (!isLoading) {
      if (sessionExpiryTimestamp === null) {
        localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY);
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY_SESSION_EXPIRY, String(sessionExpiryTimestamp));
      }
    }
  }, [sessionExpiryTimestamp, isLoading]);

  useEffect(() => {
    if(!isLoading) {
        localStorage.setItem(LOCAL_STORAGE_KEY_UI_NOTIFICATIONS, JSON.stringify(uiNotifications));
    }
  }, [uiNotifications, isLoading]);


  const addUINotification = useCallback((data: Omit<UINotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: UINotification = {
      ...data,
      id: uuidv4(),
      timestamp: Date.now(),
      read: false,
    };
    setUINotifications(prev => [newNotification, ...prev.slice(0, 49)]);
  }, []);


  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

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
          const todayInstances = generateFutureInstancesForNotifications(masterActivity, today, endOfDay(today));
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
                const toastDesc = t('toastActivityStartingSoonDescription', { activityTitle, activityTime: masterActivity.time! });
                addUINotification({ title: t('toastActivityStartingSoonTitle'), description: toastDesc, activityId: masterId, instanceDate: instance.instanceDate.getTime() });
                toast({ title: t('toastActivityStartingSoonTitle'), description: toastDesc });
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
                addUINotification({ title: notifTitle, description: notifDesc, activityId: masterId, instanceDate: instance.instanceDate.getTime() });
                toast({ title: notifTitle, description: notifDesc });
                setNotifiedToday(prev => new Set(prev).add(notificationFullKey));
              }
            };

            if (recurrenceType === 'weekly') {
              const oneDayBefore = subDays(instance.instanceDate, 1);
              if (isSameDay(today, oneDayBefore)) {
                notify('1day_weekly', 'toastActivityTomorrowTitle', 'toastActivityTomorrowDescription', { activityTitle });
              }
            } else if (recurrenceType === 'monthly') {
              const oneWeekBefore = subWeeks(instance.instanceDate, 1);
              if (isSameDay(today, oneWeekBefore)) {
                 notify('1week_monthly', 'toastActivityInOneWeekTitle', 'toastActivityInOneWeekDescription', { activityTitle });
              }

              const twoDaysBefore = subDays(instance.instanceDate, 2);
              if (isSameDay(today, twoDaysBefore)) {
                 notify('2days_monthly', 'toastActivityInTwoDaysTitle', 'toastActivityInTwoDaysDescription', { activityTitle });
              }

              const oneDayBefore = subDays(instance.instanceDate, 1);
              if (isSameDay(today, oneDayBefore)) {
                 notify('1day_monthly', 'toastActivityTomorrowTitle', 'toastActivityTomorrowDescription', { activityTitle });
              }
            }
          });
        }
      });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [personalActivities, workActivities, appModeState, isLoading, isAuthenticated, toast, t, lastNotificationCheckDay, notifiedToday, addUINotification, dateLocale]);


  useEffect(() => {
    if (!logoutChannel) return;
    const handleLogoutMessage = (event: MessageEvent) => {
      if (event.data === 'logout_event' && isAuthenticated) {
        logout();
      }
    };
    logoutChannel.addEventListener('message', handleLogoutMessage);
    return () => {
      if (logoutChannel) {
        logoutChannel.removeEventListener('message', handleLogoutMessage);
      }
    };
  }, [isAuthenticated, logout]);

  const setAppMode = useCallback((mode: AppMode) => {
    setAppModeState(mode);
  }, []);

  const setIsAuthenticated = useCallback((value: boolean, rememberMe: boolean = false) => {
    setIsAuthenticatedState(value);
    if (value) {
      const nowTime = Date.now();
      const expiryDuration = rememberMe ? SESSION_DURATION_30_DAYS_MS : SESSION_DURATION_24_HOURS_MS;
      const newExpiryTimestamp = nowTime + expiryDuration;
      setSessionExpiryTimestampState(newExpiryTimestamp);
    } else {
      setSessionExpiryTimestampState(null);
    }
  }, []);

  const setLoginAttempts = useCallback((attempts: number) => {
    setLoginAttemptsState(attempts);
  }, []);

  const setLockoutEndTime = useCallback((timestamp: number | null) => {
    setLockoutEndTimeState(timestamp);
  }, []);

  const addActivity = useCallback((
      activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'notes' | 'recurrence' | 'completedOccurrences'> & {
        todos?: Omit<Todo, 'id' | 'completed'>[];
        time?: string;
        notes?: string;
        recurrence?: RecurrenceRule | null;
      },
      customCreatedAt?: number
    ) => {
    const newActivity: Activity = {
      id: uuidv4(),
      title: activityData.title,
      categoryId: activityData.categoryId,
      todos: (activityData.todos || []).map(todo => ({ ...todo, id: uuidv4(), completed: false })),
      createdAt: customCreatedAt !== undefined ? customCreatedAt : Date.now(),
      time: activityData.time === "" ? undefined : activityData.time,
      notes: activityData.notes || undefined,
      completed: false,
      recurrence: activityData.recurrence || { type: 'none' },
      completedOccurrences: {},
    };
    currentActivitySetter(prev => [...prev, newActivity]);
  }, [currentActivitySetter]);

  const updateActivity = useCallback((activityId: string, updates: Partial<Activity>) => {
    currentActivitySetter(prev =>
      prev.map(act => {
        if (act.id === activityId) {
          const updatedRecurrence = updates.recurrence?.type === 'none'
            ? { type: 'none' }
            : updates.recurrence || act.recurrence;

          let updatedCompletedOccurrences = act.completedOccurrences;
          if (updates.recurrence && updates.recurrence.type === 'none') {
            updatedCompletedOccurrences = {};
          } else if (updates.recurrence &&
                     (updates.recurrence.type !== act.recurrence?.type ||
                      updates.recurrence.dayOfMonth !== act.recurrence?.dayOfMonth ||
                      JSON.stringify(updates.recurrence.daysOfWeek) !== JSON.stringify(act.recurrence?.daysOfWeek) ||
                      (updates.createdAt && new Date(updates.createdAt).getTime() !== new Date(act.createdAt).getTime())
                      )) {
            updatedCompletedOccurrences = {};
          }
          return { ...act, ...updates, recurrence: updatedRecurrence as RecurrenceRule | undefined, completedOccurrences: updatedCompletedOccurrences };
        }
        return act;
      })
    );
  }, [currentActivitySetter]);

  const deleteActivity = useCallback((activityId: string) => {
    currentActivitySetter(prev => prev.filter(act => act.id !== activityId));
  }, [currentActivitySetter]);

  const toggleOccurrenceCompletion = useCallback((masterActivityId: string, occurrenceDateTimestamp: number, completedState: boolean) => {
    const occurrenceDateKey = formatISO(new Date(occurrenceDateTimestamp), { representation: 'date' });
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
  }, [currentActivitySetter]);


  const addTodoToActivity = useCallback((activityId: string, todoText: string) => {
    const newTodo: Todo = { id: uuidv4(), text: todoText, completed: false };
    currentActivitySetter(prev =>
      prev.map(act =>
        act.id === activityId ? { ...act, todos: [...act.todos, newTodo] } : act
      )
    );
  }, [currentActivitySetter]);

  const updateTodoInActivity = useCallback(
    (activityId: string, todoId: string, updates: Partial<Todo>) => {
      currentActivitySetter(prev =>
        prev.map(act =>
          act.id === activityId
            ? {
                ...act,
                todos: act.todos.map(todo =>
                  todo.id === todoId ? { ...todo, ...updates } : todo
                ),
              }
            : act
        )
      );
    },
    [currentActivitySetter]
  );

  const deleteTodoFromActivity = useCallback((activityId: string, todoId: string) => {
    currentActivitySetter(prev =>
      prev.map(act =>
        act.id === activityId
          ? { ...act, todos: act.todos.filter(todo => todo.id !== todoId) }
          : act
      )
    );
  }, [currentActivitySetter]);

  const getCategoryById = useCallback(
    (categoryId: string) => {
      // Use allCategories here because filteredCategories might not yet be updated if appMode changed recently
      return allCategories.find(cat => cat.id === categoryId)
    },
    [allCategories]
  );

  const addCategory = useCallback((name: string, iconName: string, mode: AppMode | 'all') => {
    const IconComponent = getIconComponent(iconName);
    const newCategory: Category = {
      id: `cat_${uuidv4()}`,
      name,
      icon: IconComponent,
      iconName,
      mode: mode,
    };
    setAllCategories(prev => [...prev, newCategory]);
    const toastDesc = t('toastCategoryAddedDescription', { categoryName: name });
    toast({ title: t('toastCategoryAddedTitle'), description: toastDesc });
  }, [toast, t]);

  const updateCategory = useCallback((categoryId: string, updates: Partial<Omit<Category, 'id' | 'icon'>>) => {
    setAllCategories(prev =>
      prev.map(cat => {
        if (cat.id === categoryId) {
          const newName = updates.name !== undefined ? updates.name : cat.name;
          const newIconName = updates.iconName !== undefined ? updates.iconName : cat.iconName;
          const newMode = updates.mode !== undefined ? updates.mode : cat.mode;
          return {
            ...cat,
            name: newName,
            iconName: newIconName,
            icon: updates.iconName !== undefined ? getIconComponent(newIconName) : cat.icon,
            mode: newMode,
          };
        }
        return cat;
      })
    );
    const catName = updates.name || allCategories.find(c=>c.id === categoryId)?.name || "";
    const toastDesc = t('toastCategoryUpdatedDescription', { categoryName: catName });
    toast({ title: t('toastCategoryUpdatedTitle'), description: toastDesc });
  }, [toast, t, allCategories]);


  const deleteCategory = useCallback((categoryId: string) => {
    const categoryToDelete = allCategories.find(cat => cat.id === categoryId);
    if (!categoryToDelete) return;

    setAllCategories(prev => prev.filter(cat => cat.id !== categoryId));

    setPersonalActivities(prevActivities =>
      prevActivities.map(act =>
        act.categoryId === categoryId ? { ...act, categoryId: '' } : act
      )
    );
    setWorkActivities(prevActivities =>
      prevActivities.map(act =>
        act.categoryId === categoryId ? { ...act, categoryId: '' } : act
      )
    );
    const toastDesc = t('toastCategoryDeletedDescription', { categoryName: categoryToDelete.name });
    toast({ title: t('toastCategoryDeletedTitle'), description: toastDesc });
  }, [toast, allCategories, t]);

  const markUINotificationAsRead = useCallback((notificationId: string) => {
    setUINotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const markAllUINotificationsAsRead = useCallback(() => {
    setUINotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAllUINotifications = useCallback(() => {
    setUINotifications([]);
  }, []);


  return (
    <AppContext.Provider
      value={{
        activities: getRawActivities(),
        getRawActivities,
        categories: filteredCategories,
        appMode: appModeState,
        setAppMode,
        addActivity,
        updateActivity,
        deleteActivity,
        toggleOccurrenceCompletion,
        addTodoToActivity,
        updateTodoInActivity,
        deleteTodoFromActivity,
        getCategoryById,
        addCategory,
        updateCategory,
        deleteCategory,
        isLoading,
        error,
        isAuthenticated,
        setIsAuthenticated,
        loginAttempts,
        setLoginAttempts,
        lockoutEndTime,
        setLockoutEndTime,
        sessionExpiryTimestamp,
        logout,
        uiNotifications,
        addUINotification,
        markUINotificationAsRead,
        markAllUINotificationsAsRead,
        clearAllUINotifications,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

    