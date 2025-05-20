
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useCallback, useEffect } from 'react';
import type { Activity, Todo, Category, ActivityStatus, AppMode } from '@/lib/types';
import { INITIAL_CATEGORIES } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { useToast } from '@/hooks/use-toast';
import { isSameDay } from 'date-fns';
import * as Icons from 'lucide-react'; // Import all lucide-react icons

export interface AppContextType {
  activities: Activity[];
  categories: Category[];
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  addActivity: (
    activityData: Omit<Activity, 'id' | 'todos' | 'status' | 'createdAt' | 'completed'> & { 
      todos?: Omit<Todo, 'id' | 'completed'>[];
      time?: string; 
    }, 
    customCreatedAt?: number
  ) => void;
  updateActivity: (activityId: string, updates: Partial<Activity>) => void;
  deleteActivity: (activityId: string) => void;
  addTodoToActivity: (activityId: string, todoText: string) => void;
  updateTodoInActivity: (activityId: string, todoId: string, updates: Partial<Todo>) => void;
  deleteTodoFromActivity: (activityId: string, todoId: string) => void;
  moveActivity: (activityId: string, newStatus: ActivityStatus) => void;
  getCategoryById: (categoryId: string) => Category | undefined;
  addCategory: (name: string, iconName: string) => void;
  updateCategory: (categoryId: string, updates: { name?: string; iconName?: string }) => void;
  deleteCategory: (categoryId: string) => void;
  isLoading: boolean;
  error: string | null;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_ACTIVITIES = 'todoFlowActivities';
const LOCAL_STORAGE_KEY_CATEGORIES = 'todoFlowCategories';
const LOCAL_STORAGE_KEY_APP_MODE = 'todoFlowAppMode';


// Helper to get icon component by name
const getIconComponent = (iconName: string): Icons.LucideIcon => {
  const capitalizedIconName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
  // Ensure it's a valid Lucide icon name (PascalCase)
  const pascalCaseIconName = capitalizedIconName.replace(/[^A-Za-z0-9]/g, '');
  return (Icons as any)[pascalCaseIconName] || Icons.Package; // Default to Package icon if not found
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [appMode, setAppModeState] = useState<AppMode>('personal');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [lastNotificationCheckDay, setLastNotificationCheckDay] = useState<number | null>(null);
  const [notifiedToday, setNotifiedToday] = useState<Set<string>>(new Set());


  useEffect(() => {
    setIsLoading(true);
    try {
      const storedActivities = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVITIES);
      if (storedActivities) {
        setActivities(JSON.parse(storedActivities));
      }

      const storedCategories = localStorage.getItem(LOCAL_STORAGE_KEY_CATEGORIES);
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories).map((cat: Omit<Category, 'icon'> & { iconName: string }) => ({
          ...cat,
          icon: getIconComponent(cat.iconName || 'Package') 
        })));
      } else {
        setCategories(INITIAL_CATEGORIES);
      }

      const storedAppMode = localStorage.getItem(LOCAL_STORAGE_KEY_APP_MODE) as AppMode | null;
      if (storedAppMode && (storedAppMode === 'personal' || storedAppMode === 'work')) {
        setAppModeState(storedAppMode);
      }

    } catch (err) {
      console.error("Failed to load data from local storage", err);
      setError("Failed to load saved data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) { 
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVITIES, JSON.stringify(activities));
      } catch (err) {
        console.error("Failed to save activities to local storage", err);
        setError("Failed to save activities. Changes might not persist.");
      }
    }
  }, [activities, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      try {
        // Store iconName directly as it's part of the Category type now
        const serializableCategories = categories.map(({ icon, ...rest }) => rest);
        localStorage.setItem(LOCAL_STORAGE_KEY_CATEGORIES, JSON.stringify(serializableCategories));
      } catch (err) {
        console.error("Failed to save categories to local storage", err);
        setError("Failed to save categories. Changes might not persist.");
      }
    }
  }, [categories, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_APP_MODE, appMode);
      } catch (err) {
        console.error("Failed to save app mode to local storage", err);
        // Optionally set an error state or notify the user
      }
    }
  }, [appMode, isLoading]);

  // Effect to apply mode-specific class to HTML element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('mode-personal', 'mode-work'); // Clean up previous mode classes

    if (appMode === 'work') {
      root.classList.add('mode-work');
    } else {
      root.classList.add('mode-personal'); // Default to personal
    }
  }, [appMode]);


  // Effect for activity notifications
  useEffect(() => {
    if (isLoading) return; 

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
            title: "Activity Starting Soon!",
            description: `"${activity.title}" is scheduled for ${activity.time}.`
          });
          setNotifiedToday(prev => new Set(prev).add(activity.id));
        }
      });
    }, 60000); 

    return () => clearInterval(intervalId);
  }, [activities, isLoading, toast, notifiedToday, lastNotificationCheckDay]);

  const setAppMode = useCallback((mode: AppMode) => {
    setAppModeState(mode);
  }, []);


  const addActivity = useCallback((
      activityData: Omit<Activity, 'id' | 'todos' | 'status' | 'createdAt' | 'completed'> & { 
        todos?: Omit<Todo, 'id' | 'completed'>[];
        time?: string;
      },
      customCreatedAt?: number
    ) => {
    const newActivity: Activity = {
      id: uuidv4(),
      title: activityData.title,
      categoryId: activityData.categoryId,
      todos: (activityData.todos || []).map(todo => ({ ...todo, id: uuidv4(), completed: false })),
      status: 'todo',
      createdAt: customCreatedAt !== undefined ? customCreatedAt : Date.now(),
      time: activityData.time || undefined,
      completed: false,
    };
    setActivities(prev => [...prev, newActivity]);
  }, []);

  const updateActivity = useCallback((activityId: string, updates: Partial<Activity>) => {
    setActivities(prev =>
      prev.map(act => (act.id === activityId ? { ...act, ...updates } : act))
    );
  }, []);

  const deleteActivity = useCallback((activityId: string) => {
    setActivities(prev => prev.filter(act => act.id !== activityId));
  }, []);

  const addTodoToActivity = useCallback((activityId: string, todoText: string) => {
    const newTodo: Todo = { id: uuidv4(), text: todoText, completed: false };
    setActivities(prev =>
      prev.map(act =>
        act.id === activityId ? { ...act, todos: [...act.todos, newTodo] } : act
      )
    );
  }, []);

  const updateTodoInActivity = useCallback(
    (activityId: string, todoId: string, updates: Partial<Todo>) => {
      setActivities(prev =>
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
    []
  );

  const deleteTodoFromActivity = useCallback((activityId: string, todoId: string) => {
    setActivities(prev =>
      prev.map(act =>
        act.id === activityId
          ? { ...act, todos: act.todos.filter(todo => todo.id !== todoId) }
          : act
      )
    );
  }, []);
  
  const moveActivity = useCallback((activityId: string, newStatus: ActivityStatus) => {
    setActivities(prev =>
      prev.map(act => (act.id === activityId ? { ...act, status: newStatus } : act)
    ));
  }, []);

  const getCategoryById = useCallback(
    (categoryId: string) => categories.find(cat => cat.id === categoryId),
    [categories]
  );

  const addCategory = useCallback((name: string, iconName: string) => {
    const IconComponent = getIconComponent(iconName);
    const newCategory: Category = {
      id: `cat_${uuidv4()}`,
      name,
      icon: IconComponent,
      iconName,
    };
    setCategories(prev => [...prev, newCategory]);
    toast({ title: "Category Added", description: `"${name}" has been added.` });
  }, [toast]);

  const updateCategory = useCallback((categoryId: string, updates: { name?: string; iconName?: string }) => {
    setCategories(prev =>
      prev.map(cat => {
        if (cat.id === categoryId) {
          const newName = updates.name !== undefined ? updates.name : cat.name;
          const newIconName = updates.iconName !== undefined ? updates.iconName : cat.iconName;
          return {
            ...cat,
            name: newName,
            iconName: newIconName,
            icon: updates.iconName !== undefined ? getIconComponent(newIconName) : cat.icon,
          };
        }
        return cat;
      })
    );
    toast({ title: "Category Updated", description: "The category has been updated." });
  }, [toast]);


  const deleteCategory = useCallback((categoryId: string) => {
    const categoryToDelete = categories.find(cat => cat.id === categoryId);
    if (!categoryToDelete) return;

    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
    setActivities(prevActivities => 
      prevActivities.map(act => 
        act.categoryId === categoryId ? { ...act, categoryId: '' } : act 
      )
    );
    toast({ title: "Category Deleted", description: `"${categoryToDelete.name}" has been removed.` });
  }, [toast, categories]);


  return (
    <AppContext.Provider
      value={{
        activities,
        categories,
        appMode,
        setAppMode,
        addActivity,
        updateActivity,
        deleteActivity,
        addTodoToActivity,
        updateTodoInActivity,
        deleteTodoFromActivity,
        moveActivity,
        getCategoryById,
        addCategory,
        updateCategory,
        deleteCategory,
        isLoading,
        error
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

