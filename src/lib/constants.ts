
import type { Category, ActivityStatus } from '@/lib/types';
import { Home, Dumbbell, Briefcase, ShoppingCart, User, Settings, BookOpen } from 'lucide-react';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat_home', name: 'Home', icon: Home, iconName: 'Home' },
  { id: 'cat_gym', name: 'Gym', icon: Dumbbell, iconName: 'Dumbbell' },
  { id: 'cat_work', name: 'Work', icon: Briefcase, iconName: 'Briefcase' },
  { id: 'cat_shopping', name: 'Shopping', icon: ShoppingCart, iconName: 'ShoppingCart' },
  { id: 'cat_personal', name: 'Personal', icon: User, iconName: 'User' },
  { id: 'cat_learning', name: 'Learning', icon: BookOpen, iconName: 'BookOpen' },
  { id: 'cat_chores', name: 'Chores', icon: Settings, iconName: 'Settings' },
];

export const KANBAN_STATUSES: { id: ActivityStatus; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'inProgress', title: 'In Progress' },
  { id: 'completed', title: 'Completed' },
];

export const APP_NAME = 'TodoFlow';

// Hardcoded credentials for login
export const HARDCODED_USERNAME = "prueba";
export const HARDCODED_PASSWORD = "prueba123";
