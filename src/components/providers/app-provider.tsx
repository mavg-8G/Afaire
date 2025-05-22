
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
  setDate as setDayOfMonth,
  addYears, isEqual,
  formatDistanceToNowStrict,
} from 'date-fns';
import * as Icons from 'lucide-react';
import { useTranslations } from '@/contexts/language-context';
import { enUS, es } from 'date-fns/locale';


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

  if (isBefore(currentDate, new Date(masterActivity.createdAt))) {
    currentDate = new Date(masterActivity.createdAt);
  }
  
  let alignmentIterations = 0;
  const maxAlignmentIterations = 366 * 2; 

  while (isBefore(currentDate, rangeStartDate) && alignmentIterations < maxAlignmentIterations) {
      alignmentIterations++;
      let nextPossibleDate = currentDate;
      if (recurrence.type === 'daily') {
          nextPossibleDate = addDays(currentDate, 1);
      } else if (recurrence.type === 'weekly') {
          nextPossibleDate = addDays(currentDate, 1); 
      } else if (recurrence.type === 'monthly') {
          if (recurrence.dayOfMonth) {
            let tempDate = addDays(currentDate, 1); 
            if (getDate(tempDate) > recurrence.dayOfMonth && getDate(tempDate) !== getDate(currentDate) ) { // check if we jumped past desired day of month
                tempDate = addMonths(tempDate, 1);
            }
            nextPossibleDate = setDayOfMonth(tempDate, recurrence.dayOfMonth);
          } else {
            nextPossibleDate = addDays(currentDate, 1); 
          }
      } else {
          break; 
      }
      
      if (isEqual(nextPossibleDate, currentDate) && recurrence.type !== 'daily' && alignmentIterations > 1) {
        console.warn("generateFutureInstancesForNotifications: Date did not advance during alignment for activity:", masterActivity.id, "currentDate:", currentDate, "recurrence:", recurrence);
        break;
      }
      currentDate = nextPossibleDate;
  }
  if (alignmentIterations >= maxAlignmentIterations) {
    console.warn("generateFutureInstancesForNotifications: Exceeded safety limit during date alignment for activity:", masterActivity.id);
    return []; 
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
             if (recurrence.dayOfMonth) {
                let nextMonth = addMonths(currentDate, 1);
                currentDate = setDayOfMonth(nextMonth, recurrence.dayOfMonth);
                // Ensure if original start day was e.g. 31st, and currentMonth is Feb, we go to March 31st not Feb 28 then March 28
                if(getDay(new Date(masterActivity.createdAt)) !== getDay(currentDate) && getDate(new Date(masterActivity.createdAt)) === recurrence.dayOfMonth) {
                     if(isBefore(currentDate, setDayOfMonth(new Date(masterActivity.createdAt), recurrence.dayOfMonth))) {
                         currentDate = setDayOfMonth(addMonths(new Date(masterActivity.createdAt), iterations), recurrence.dayOfMonth);
                     }
                }

             } else {
                currentDate = addDays(currentDate,1); 
             }
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
            // ensure we are in the correct month first by adding a month, then setting day
            const targetMonthCurrentDay = setDayOfMonth(currentDate, recurrence.dayOfMonth);
            if(isAfter(targetMonthCurrentDay, currentDate) && getDate(targetMonthCurrentDay) === recurrence.dayOfMonth){
                 nextIterationDate = targetMonthCurrentDay; // Still in current month, next valid day
            } else {
                 nextIterationDate = setDayOfMonth(addMonths(currentDate, 1), recurrence.dayOfMonth);
            }
            // If original day was e.g. 31, and next month is Feb, date-fns sets to Feb 28/29.
            // We need to ensure we respect the original dayOfMonth intention if the month allows it.
            if(getDate(nextIterationDate) !== recurrence.dayOfMonth && getDate(new Date(masterActivity.createdAt)) === recurrence.dayOfMonth) {
                 let monthCounter = 1;
                 let potentialDate = setDayOfMonth(addMonths(currentDate, monthCounter), recurrence.dayOfMonth);
                 while(getDate(potentialDate) !== recurrence.dayOfMonth && monthCounter < 13) { // safety break for 12 months
                    monthCounter++;
                    potentialDate = setDayOfMonth(addMonths(currentDate, monthCounter), recurrence.dayOfMonth);
                 }
                 nextIterationDate = potentialDate;
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


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [personalActivities, setPersonalActivities] = useState<Activity[]>([]);
  const [workActivities, setWorkActivities] = useState<Activity[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [appMode, setAppModeState] = useState<AppMode>('personal');
  const [isLoading, setIsLoading] = useState<boolean>(true); // Initialize to true
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


  const getRawActivities = useCallback(() => {
    return appMode === 'work' ? workActivities : personalActivities;
  }, [appMode, workActivities, personalActivities]);

  const currentActivitySetter = useMemo(() => {
    return appMode === 'work' ? setWorkActivities : setPersonalActivities;
  }, [appMode]);

  const filteredCategories = useMemo(() => {
    if (isLoading) return [];
    return allCategories.filter(cat =>
      !cat.mode || cat.mode === 'all' || cat.mode === appMode
    );
  }, [allCategories, appMode, isLoading]);

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

  // Effect for initial loading from localStorage - runs once on mount
  useEffect(() => {
    let initialAuth = false;
    try {
      const storedPersonalActivities = localStorage.getItem(LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES);
      if (storedPersonalActivities) setPersonalActivities(JSON.parse(storedPersonalActivities));

      const storedWorkActivities = localStorage.getItem(LOCAL_STORAGE_KEY_WORK_ACTIVITIES);
      if (storedWorkActivities) setWorkActivities(JSON.parse(storedWorkActivities));
      
      const storedAllCategories = localStorage.getItem(LOCAL_STORAGE_KEY_ALL_CATEGORIES);
       if (storedAllCategories) {
        const parsedCategories = JSON.parse(storedAllCategories);
        if (Array.isArray(parsedCategories) && parsedCategories.length > 0) {
          setAllCategories(parsedCategories.map((cat: Omit<Category, 'icon'> & { iconName: string }) => ({
            ...cat,
            icon: getIconComponent(cat.iconName || 'Package'),
            mode: cat.mode || 'all'
          })));
        } else {
           setAllCategories(INITIAL_CATEGORIES.map(cat => ({...cat, icon: getIconComponent(cat.iconName)})));
        }
      } else {
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
          // Session expired, trigger logout logic but don't call logout() directly here to avoid state update during render
          initialAuth = false; 
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
      setAllCategories(INITIAL_CATEGORIES.map(cat => ({...cat, icon: getIconComponent(cat.iconName)})));
    } finally {
      setIsLoading(false); // Set isLoading to false after all initial loading logic
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs only once on mount


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
      localStorage.setItem(LOCAL_STORAGE_KEY_APP_MODE, appMode);
      const root = document.documentElement;
      root.classList.remove('mode-personal', 'mode-work');
      root.classList.add(appMode === 'work' ? 'mode-work' : 'mode-personal');
    }
  }, [appMode, isLoading]);

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
    setUINotifications(prev => [newNotification, ...prev.slice(0, 49)]); // Keep max 50 notifications
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

      const activitiesToScan = appMode === 'work' ? workActivities : personalActivities;

      activitiesToScan.forEach(masterActivity => {
        const activityTitle = masterActivity.title;
        const masterId = masterActivity.id;

        // 5-minute "starting soon" notification
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
                toast({ title: t('toastActivityStartingSoonTitle'), description: toastDesc });
                addUINotification({ title: t('toastActivityStartingSoonTitle'), description: toastDesc, activityId: masterId, instanceDate: instance.instanceDate.getTime() });
                setNotifiedToday(prev => new Set(prev).add(notificationKey5Min));
              }
            }
          });
        }
        
        // Advanced notifications for recurring tasks
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
                toast({ title: notifTitle, description: notifDesc });
                addUINotification({ title: notifTitle, description: notifDesc, activityId: masterId, instanceDate: instance.instanceDate.getTime() });
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
  }, [personalActivities, workActivities, appMode, isLoading, isAuthenticated, toast, t, lastNotificationCheckDay, notifiedToday, addUINotification]);


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
      time: activityData.time || undefined,
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
    (categoryId: string) => allCategories.find(cat => cat.id === categoryId),
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
    // addUINotification({ title: t('toastCategoryAddedTitle'), description: toastDesc }); // Example if you want category changes in notification center
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
    // addUINotification({ title: t('toastCategoryUpdatedTitle'), description: toastDesc });
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
    // addUINotification({ title: t('toastCategoryDeletedTitle'), description: toastDesc });
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
        activities: getRawActivities(), // getRawActivities() to ensure it switches based on appMode
        getRawActivities,
        categories: filteredCategories,
        appMode,
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
