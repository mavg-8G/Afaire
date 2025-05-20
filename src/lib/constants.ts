
import type { Category } from '@/lib/types';
import { Home, Dumbbell, Briefcase, ShoppingCart, User, Settings, BookOpen } from 'lucide-react';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat_home', name: 'Home', icon: Home, iconName: 'Home', mode: 'all' },
  { id: 'cat_gym', name: 'Gym', icon: Dumbbell, iconName: 'Dumbbell', mode: 'all' },
  { id: 'cat_work', name: 'Work', icon: Briefcase, iconName: 'Briefcase', mode: 'all' },
  { id: 'cat_shopping', name: 'Shopping', icon: ShoppingCart, iconName: 'ShoppingCart', mode: 'all' },
  { id: 'cat_personal', name: 'Personal', icon: User, iconName: 'User', mode: 'all' },
  { id: 'cat_learning', name: 'Learning', icon: BookOpen, iconName: 'BookOpen', mode: 'all' },
  { id: 'cat_chores', name: 'Chores', icon: Settings, iconName: 'Settings', mode: 'all' },
];

export const APP_NAME = 'TodoFlow';

// Hardcoded credentials for login
export const HARDCODED_USERNAME = "prueba";
export const HARDCODED_PASSWORD = "prueba123";
