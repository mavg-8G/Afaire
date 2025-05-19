
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useState, useCallback, useEffect } from 'react';
import type { Activity, Todo, Category, ActivityStatus } from '@/lib/types';
import { INITIAL_CATEGORIES } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

export interface AppContextType {
  activities: Activity[];
  categories: Category[];
  addActivity: (activityData: Omit<Activity, 'id' | 'todos' | 'status' | 'createdAt'> & { todos?: Omit<Todo, 'id' | 'completed'>[] }) => void;
  updateActivity: (activityId: string, updates: Partial<Activity>) => void;
  deleteActivity: (activityId: string) => void;
  addTodoToActivity: (activityId: string, todoText: string) => void;
  updateTodoInActivity: (activityId: string, todoId: string, updates: Partial<Todo>) => void;
  deleteTodoFromActivity: (activityId: string, todoId: string) => void;
  moveActivity: (activityId: string, newStatus: ActivityStatus) => void;
  getCategoryById: (categoryId: string) => Category | undefined;
  isLoading: boolean;
  error: string | null;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_ACTIVITIES = 'todoFlowActivities';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedActivities = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVITIES);
      if (storedActivities) {
        setActivities(JSON.parse(storedActivities));
      }
    } catch (err) {
      console.error("Failed to load activities from local storage", err);
      setError("Failed to load saved activities.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) { // Only save when not initially loading
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVITIES, JSON.stringify(activities));
      } catch (err) {
        console.error("Failed to save activities to local storage", err);
        setError("Failed to save activities. Changes might not persist.");
      }
    }
  }, [activities, isLoading]);


  const addActivity = useCallback((activityData: Omit<Activity, 'id' | 'todos' | 'status' | 'createdAt'> & { todos?: Omit<Todo, 'id' | 'completed'>[] }) => {
    const newActivity: Activity = {
      ...activityData,
      id: uuidv4(),
      todos: (activityData.todos || []).map(todo => ({ ...todo, id: uuidv4(), completed: false })),
      status: 'todo',
      createdAt: Date.now(),
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

  return (
    <AppContext.Provider
      value={{
        activities,
        categories,
        addActivity,
        updateActivity,
        deleteActivity,
        addTodoToActivity,
        updateTodoInActivity,
        deleteTodoFromActivity,
        moveActivity,
        getCategoryById,
        isLoading,
        error
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
