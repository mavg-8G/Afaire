
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { Activity, Todo, Category, AppMode } from '@/lib/types';
import { INITIAL_CATEGORIES } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { isSameDay } from 'date-fns';
import * as Icons from 'lucide-react';
import { useTranslations } from '@/contexts/language-context';

export interface AppContextType {
  activities: Activity[];
  categories: Category[];
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  addActivity: (
    activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'notes'> & {
      todos?: Omit<Todo, 'id' | 'completed'>[];
      time?: string;
      notes?: string;
    },
    customCreatedAt?: number
  ) => void;
  updateActivity: (activityId: string, updates: Partial<Activity>) => void;
  deleteActivity: (activityId: string) => void;
  addTodoToActivity: (activityId: string, todoText: string) => void;
  updateTodoInActivity: (activityId: string, todoId: string, updates: Partial<Todo>) => void;
  deleteTodoFromActivity: (activityId: string, todoId: string) => void;
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

const LOCAL_STORAGE_KEY_PERSONAL_ACTIVITIES = 'todoFlowPersonalActivities';
const LOCAL_STORAGE_KEY_WORK_ACTIVITIES = 'todoFlowWorkActivities';
const LOCAL_STORAGE_KEY_ALL_CATEGORIES = 'todoFlowAllCategories';
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


  const activities = useMemo(() => {
    return appMode === 'work' ? workActivities : personalActivities;
  }, [appMode, personalActivities, workActivities]);

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
      if (storedPersonalActivities) {
        setPersonalActivities(JSON.parse(storedPersonalActivities));
      }
      const storedWorkActivities = localStorage.getItem(LOCAL_STORAGE_KEY_WORK_ACTIVITIES);
      if (storedWorkActivities) {
        setWorkActivities(JSON.parse(storedWorkActivities));
      }

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
        setIsAuthenticatedState(false);
        setSessionExpiryTimestampState(null);
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
  }, [logout]);

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
      const currentDay = now.getDate();

      if (lastNotificationCheckDay !== null && lastNotificationCheckDay !== currentDay) {
        setNotifiedToday(new Set());
      }
      setLastNotificationCheckDay(currentDay);

      activities.forEach(activity => {
        if (!activity.time || notifiedToday.has(activity.id) || activity.completed) {
          return;
        }
        const activityDatePart = new Date(activity.createdAt);
        if (!isSameDay(activityDatePart, now)) {
          return;
        }
        const [hours, minutes] = activity.time.split(':').map(Number);
        const activityDateTime = new Date(activityDatePart);
        activityDateTime.setHours(hours, minutes, 0, 0);
        const fiveMinutesInMs = 5 * 60 * 1000;
        const timeDiffMs = activityDateTime.getTime() - now.getTime();

        if (timeDiffMs >= 0 && timeDiffMs <= fiveMinutesInMs) {
          toast({
            title: t('toastActivityStartingSoonTitle'),
            description: t('toastActivityStartingSoonDescription', { activityTitle: activity.title, activityTime: activity.time })
          });
          setNotifiedToday(prev => new Set(prev).add(activity.id));
        }
      });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [activities, isLoading, toast, notifiedToday, lastNotificationCheckDay, isAuthenticated, t]);

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
      const now = Date.now();
      const expiryDuration = rememberMe ? SESSION_DURATION_30_DAYS_MS : SESSION_DURATION_24_HOURS_MS;
      const newExpiryTimestamp = now + expiryDuration;
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
      activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'notes'> & {
        todos?: Omit<Todo, 'id' | 'completed'>[];
        time?: string;
        notes?: string;
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
    };
    currentActivitySetter(prev => [...prev, newActivity]);
  }, [currentActivitySetter]);

  const updateActivity = useCallback((activityId: string, updates: Partial<Activity>) => {
    currentActivitySetter(prev =>
      prev.map(act => (act.id === activityId ? { ...act, ...updates } : act))
    );
  }, [currentActivitySetter]);

  const deleteActivity = useCallback((activityId: string) => {
    currentActivitySetter(prev => prev.filter(act => act.id !== activityId));
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
        activities,
        categories: filteredCategories,
        appMode,
        setAppMode,
        addActivity,
        updateActivity,
        deleteActivity,
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
