
import type { Category } from '@/lib/types';
import { Home, Dumbbell, Briefcase, ShoppingCart, User, Settings, BookOpen } from 'lucide-react';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat_home', name: 'Casa', icon: Home, iconName: 'Home', mode: 'personal' },
  { id: 'cat_gym', name: 'Gimnasio', icon: Dumbbell, iconName: 'Dumbbell', mode: 'personal' },
  { id: 'cat_work', name: 'Trabajo', icon: Briefcase, iconName: 'Briefcase', mode: 'work' },
  { id: 'cat_shopping', name: 'Compras', icon: ShoppingCart, iconName: 'ShoppingCart', mode: 'personal' },
  { id: 'cat_personal', name: 'Personal', icon: User, iconName: 'User', mode: 'personal' },
  { id: 'cat_learning', name: 'Aprender', icon: BookOpen, iconName: 'BookOpen', mode: 'all' },
  { id: 'cat_chores', name: 'Tareas', icon: Settings, iconName: 'Settings', mode: 'all' },
];

export const APP_NAME = 'À faire';

// Hardcoded credentials for login
export const HARDCODED_USERNAME = "pruebas";
export const HARDCODED_PASSWORD = "pruebas123";

// Hardcoded PIN for app lock (prototype only - NOT SECURE FOR PRODUCTION)
// Set to null to disable PIN lock feature
export const HARDCODED_APP_PIN: string | null = "1234";
    
