
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { Activity, Todo, Category, AppMode, RecurrenceRule } from '@/lib/types';
import { INITIAL_CATEGORIES } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import {
  isSameDay, formatISO, parseISO,
  addDays, addWeeks, addMonths,
  subDays, subWeeks,
  startOfDay, endOfDay,
  isBefore, isAfter,
  getDay, getDate, // getDate is for day of month
  isWithinInterval,
  setDate as setDayOfMonth,
  addYears, isEqual
} from 'date-fns';
import * as Icons from 'lucide-react';
import { useTranslations } from '@/contexts/language-context';

export interface AppContextType {
  activities: Activity[]; // This will be the combined list of original and generated recurring instances for display
  getRawActivities: () => Activity[]; // Function to get only the stored (master) activities
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
  deleteActivity: (activityId: string) => void; // If recurring, deletes the whole series
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

// Helper to create a clean Date object representing the start of a given date
const getStartOfDay = (date: Date): Date => {
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
  rangeStartDate: Date, // Start of the period to look for instances
  rangeEndDate: Date    // End of the period
): FutureInstance[] {
  if (!masterActivity.recurrence || masterActivity.recurrence.type === 'none') {
    // For non-recurring, if it falls within range and is not completed
    const activityDate = new Date(masterActivity.createdAt);
    if (isWithinInterval(activityDate, { start: rangeStartDate, end: rangeEndDate }) && !masterActivity.completed) {
        return [{ instanceDate: activityDate, masterActivityId: masterActivity.id }];
    }
    return [];
  }

  const instances: FutureInstance[] = [];
  const recurrence = masterActivity.recurrence;
  let currentDate = new Date(masterActivity.createdAt);

  // Ensure currentDate is not before the master activity's own start date
  // and align it to be at or after rangeStartDate for efficient generation.
  if (isBefore(currentDate, new Date(masterActivity.createdAt))) {
    currentDate = new Date(masterActivity.createdAt);
  }
  
  // Advance currentDate to be at least rangeStartDate, respecting recurrence pattern start
  // This part is complex and needs to correctly find the first valid occurrence >= rangeStartDate
  // For simplicity in this context, we'll advance day by day and check validity.
  // A more optimized version would jump by week/month.
  let alignmentIterations = 0;
  const maxAlignmentIterations = 366 * 2; // Max 2 years for alignment

  while (isBefore(currentDate, rangeStartDate) && alignmentIterations < maxAlignmentIterations) {
      alignmentIterations++;
      let nextPossibleDate = currentDate;
      if (recurrence.type === 'daily') {
          nextPossibleDate = addDays(currentDate, 1);
      } else if (recurrence.type === 'weekly') {
          // Simply advance by one day; validity check below will handle daysOfWeek
          nextPossibleDate = addDays(currentDate, 1); 
      } else if (recurrence.type === 'monthly') {
          // For monthly, need more careful advancement to find next valid day
          if (recurrence.dayOfMonth) {
            let tempDate = addDays(currentDate, 1); // Start checking from the next day
            // Go to the next month if current day is already past the target dayOfMonth
            if (getDate(tempDate) > recurrence.dayOfMonth) {
                tempDate = addMonths(tempDate, 1);
            }
            // Set to the specific dayOfMonth
            nextPossibleDate = setDayOfMonth(tempDate, recurrence.dayOfMonth);
          } else {
            nextPossibleDate = addDays(currentDate, 1); // Fallback if dayOfMonth not set
          }
      } else {
          break; 
      }
      
      if (isEqual(nextPossibleDate, currentDate) && recurrence.type !== 'daily') {
        // If date didn't advance (e.g. monthly logic couldn't find a new date), break to prevent infinite loop
        // For daily, it's okay if it's equal if we are already at rangeStartDate
        console.warn("generateFutureInstancesForNotifications: Date did not advance during alignment for activity:", masterActivity.id, "currentDate:", currentDate, "recurrence:", recurrence);
        break;
      }
      currentDate = nextPossibleDate;
  }
  if (alignmentIterations >= maxAlignmentIterations) {
    console.warn("generateFutureInstancesForNotifications: Exceeded safety limit during date alignment for activity:", masterActivity.id);
    return []; // Return empty if alignment takes too long
  }


  const seriesEndDate = recurrence.endDate ? new Date(recurrence.endDate) : null;
  let iterations = 0;
  const maxIterations = 366 * 1; // Look ahead up to 1 year for notifications

  while (iterations < maxIterations && !isAfter(currentDate, rangeEndDate)) {
    iterations++;

    if (seriesEndDate && isAfter(currentDate, seriesEndDate)) break;
    
    // Ensure we don't generate instances before the original start date of the recurring activity.
    if (isBefore(currentDate, new Date(masterActivity.createdAt))) {
        if (recurrence.type === 'daily') currentDate = addDays(currentDate, 1);
        else if (recurrence.type === 'weekly') currentDate = addDays(currentDate, 1); // Check next day
        else if (recurrence.type === 'monthly') { // More careful advance for monthly
             if (recurrence.dayOfMonth) {
                let nextMonth = addMonths(currentDate, 1);
                currentDate = setDayOfMonth(nextMonth, recurrence.dayOfMonth);
             } else {
                currentDate = addDays(currentDate,1); // fallback
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
      // Check if this specific instance is completed
      const occurrenceDateKey = formatISO(currentDate, { representation: 'date' });
      const isInstanceCompleted = !!masterActivity.completedOccurrences?.[occurrenceDateKey];
      
      if (!isInstanceCompleted) {
           instances.push({
            instanceDate: new Date(currentDate.getTime()), // Important to create new Date objects
            masterActivityId: masterActivity.id,
          });
      }
    }

    // Advance current date
    if (recurrence.type === 'daily') {
        currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'weekly') {
        currentDate = addDays(currentDate, 1); // Check next day, loop will handle dayOfWeek
    } else if (recurrence.type === 'monthly') {
        if (recurrence.dayOfMonth) {
            let nextMonthDate = addMonths(currentDate, 1); // Go to next month
            currentDate = setDayOfMonth(nextMonthDate, recurrence.dayOfMonth); // Set to the specific day
            // If setting dayOfMonth made it jump to *another* month (e.g. day 31 in Feb -> Mar 3)
            // or if the month isn't what we expect, we might need adjustment,
            // but usually date-fns handles this gracefully by landing on the correct day in the target month.
            // However, for safety if dayOfMonth is, e.g. 31 and next month is Feb, it will become Feb 28/29.
            // This could be an issue if we strict-check month. For notifications, it might be okay.
            // A simpler advance to ensure we cross into the next month then find the day:
            // currentDate = addDays(currentDate, 1); // Go to next day
            // while(getDate(currentDate) !== recurrence.dayOfMonth && !isAfter(currentDate, rangeEndDate)){
            //   currentDate = addDays(currentDate, 1)
            // }
            // The current logic (setDayOfMonth(addMonths(...))) is usually more direct for monthly fixed day.
        } else {
            currentDate = addDays(currentDate, 1); // Fallback if no dayOfMonth
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslations();

  const [lastNotificationCheckDay, setLastNotificationCheckDay] = useState<number | null>(null);
  const [notifiedToday, setNotifiedToday] = useState<Set<string>>(new Set());

  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(false);
  const [loginAttempts, setLoginAttemptsState] = useState<number>(0);
  const [lockoutEndTime, setLockoutEndTimeState] = useState<number | null>(null);
  const [sessionExpiryTimestamp, setSessionExpiryTimestampState] = useState<number | null>(null);


   const currentRawActivities = useMemo(() => {
    return appMode === 'work' ? workActivities : personalActivities;
  }, [appMode, personalActivities, workActivities]);

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

  useEffect(() => {
    setIsLoading(true);
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
          logout();
        } else {
          setIsAuthenticatedState(true);
          setSessionExpiryTimestampState(expiryTime);
        }
      } else {
        // If no auth or no expiry, ensure user is logged out.
        if(isAuthenticated) logout(); 
      }

      const storedAttempts = localStorage.getItem(LOCAL_STORAGE_KEY_LOGIN_ATTEMPTS);
      setLoginAttemptsState(storedAttempts ? parseInt(storedAttempts, 10) : 0);

      const storedLockoutTime = localStorage.getItem(LOCAL_STORAGE_KEY_LOCKOUT_END_TIME);
      setLockoutEndTimeState(storedLockoutTime ? parseInt(storedLockoutTime, 10) : null);

    } catch (err) {
      console.error("Failed to load data from local storage", err);
      setError("Failed to load saved data.");
      setAllCategories(INITIAL_CATEGORIES.map(cat => ({...cat, icon: getIconComponent(cat.iconName)})));
    } finally {
      setIsLoading(false);
    }
  }, [logout, isAuthenticated]); // Added isAuthenticated to dependency array for the auth check

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
    if (isLoading || !isAuthenticated) return;

    const intervalId = setInterval(() => {
      const now = new Date();
      const today = getStartOfDay(now);
      const currentDayOfMonthFromNow = now.getDate();

      if (lastNotificationCheckDay !== null && lastNotificationCheckDay !== currentDayOfMonthFromNow) {
        setNotifiedToday(new Set());
      }
      setLastNotificationCheckDay(currentDayOfMonthFromNow);

      const activitiesToScan = appMode === 'work' ? workActivities : personalActivities;

      activitiesToScan.forEach(masterActivity => {
        const activityTitle = masterActivity.title;

        const todayInstances = generateFutureInstancesForNotifications(masterActivity, today, endOfDay(today));
        const futureCheckEndDate = addDays(today, 8); 
        const upcomingInstances = generateFutureInstancesForNotifications(masterActivity, addDays(today,1), futureCheckEndDate);

        if (masterActivity.time) {
          todayInstances.forEach(instance => {
            const occurrenceDateKey = formatISO(instance.instanceDate, { representation: 'date' });
            const notificationKey5Min = `${instance.masterActivityId}:${occurrenceDateKey}:5min_soon`;
            const isOccurrenceCompleted = !!masterActivity.completedOccurrences?.[occurrenceDateKey];

            if (!isOccurrenceCompleted && !notifiedToday.has(notificationKey5Min)) {
              const [hours, minutes] = masterActivity.time!.split(':').map(Number);
              const activityDateTime = new Date(instance.instanceDate);
              activityDateTime.setHours(hours, minutes, 0, 0);
              const fiveMinutesInMs = 5 * 60 * 1000;
              const timeDiffMs = activityDateTime.getTime() - now.getTime();

              if (timeDiffMs >= 0 && timeDiffMs <= fiveMinutesInMs) {
                toast({
                  title: t('toastActivityStartingSoonTitle'),
                  description: t('toastActivityStartingSoonDescription', { activityTitle, activityTime: masterActivity.time! })
                });
                setNotifiedToday(prev => new Set(prev).add(notificationKey5Min));
              }
            }
          });
        }
        
        if (masterActivity.recurrence && masterActivity.recurrence.type !== 'none') {
          const recurrenceType = masterActivity.recurrence.type;

          upcomingInstances.forEach(instance => {
            const instanceDateKey = formatISO(instance.instanceDate, { representation: 'date' });
            const isOccurrenceCompleted = !!masterActivity.completedOccurrences?.[instanceDateKey];
            if(isOccurrenceCompleted) return;


            if (recurrenceType === 'weekly') {
              const oneDayBefore = subDays(instance.instanceDate, 1);
              if (isSameDay(today, oneDayBefore)) {
                const notificationKey = `${instance.masterActivityId}:${instanceDateKey}:1day_weekly`;
                if (!notifiedToday.has(notificationKey)) {
                  toast({ title: t('toastActivityTomorrowTitle'), description: t('toastActivityTomorrowDescription', { activityTitle }) });
                  setNotifiedToday(prev => new Set(prev).add(notificationKey));
                }
              }
            } else if (recurrenceType === 'monthly') {
              const oneWeekBefore = subWeeks(instance.instanceDate, 1);
              if (isSameDay(today, oneWeekBefore)) {
                const notificationKey = `${instance.masterActivityId}:${instanceDateKey}:1week_monthly`;
                if (!notifiedToday.has(notificationKey)) {
                  toast({ title: t('toastActivityInOneWeekTitle'), description: t('toastActivityInOneWeekDescription', { activityTitle }) });
                  setNotifiedToday(prev => new Set(prev).add(notificationKey));
                }
              }
              
              const twoDaysBefore = subDays(instance.instanceDate, 2);
              if (isSameDay(today, twoDaysBefore)) {
                const notificationKey = `${instance.masterActivityId}:${instanceDateKey}:2days_monthly`;
                if (!notifiedToday.has(notificationKey)) {
                  toast({ title: t('toastActivityInTwoDaysTitle'), description: t('toastActivityInTwoDaysDescription', { activityTitle }) });
                  setNotifiedToday(prev => new Set(prev).add(notificationKey));
                }
              }

              const oneDayBefore = subDays(instance.instanceDate, 1);
              if (isSameDay(today, oneDayBefore)) {
                const notificationKey = `${instance.masterActivityId}:${instanceDateKey}:1day_monthly`;
                if (!notifiedToday.has(notificationKey)) {
                  toast({ title: t('toastActivityTomorrowTitle'), description: t('toastActivityTomorrowDescription', { activityTitle }) });
                  setNotifiedToday(prev => new Set(prev).add(notificationKey));
                }
              }
            }
          });
        }
      });
    }, 60000); 

    return () => clearInterval(intervalId);
  }, [personalActivities, workActivities, appMode, isLoading, isAuthenticated, toast, t, lastNotificationCheckDay, notifiedToday]);


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
          // If recurrence settings are cleared, clear completedOccurrences as well.
          if (updates.recurrence && updates.recurrence.type === 'none') {
            updatedCompletedOccurrences = {};
          } else if (updates.recurrence && 
                     (updates.recurrence.type !== act.recurrence?.type || 
                      updates.recurrence.dayOfMonth !== act.recurrence?.dayOfMonth ||
                      JSON.stringify(updates.recurrence.daysOfWeek) !== JSON.stringify(act.recurrence?.daysOfWeek) ||
                      new Date(updates.createdAt || act.createdAt).getTime() !== new Date(act.createdAt).getTime()
                      )) {
            // If recurrence rule (type, specific days/dates) or start date changes, clear old completions
            // as they might no longer be valid for the new rule.
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
    toast({
      title: t('toastCategoryAddedTitle'),
      description: t('toastCategoryAddedDescription', { categoryName: name })
    });
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
    toast({
      title: t('toastCategoryUpdatedTitle'),
      description: t('toastCategoryUpdatedDescription', { categoryName: updates.name || "" })
    });
  }, [toast, t]);


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
    toast({
      title: t('toastCategoryDeletedTitle'),
      description: t('toastCategoryDeletedDescription', { categoryName: categoryToDelete.name })
    });
  }, [toast, allCategories, t]);


  return (
    <AppContext.Provider
      value={{
        activities: currentRawActivities,
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
