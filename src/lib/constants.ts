
import type { Category } from '@/lib/types';
import { Home, Dumbbell, Briefcase, ShoppingCart, User, Settings, BookOpen } from 'lucide-react';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 1, name: 'Home', icon: Home, iconName: 'Home', mode: 'personal' },
  { id: 2, name: 'Gym', icon: Dumbbell, iconName: 'Dumbbell', mode: 'personal' },
  { id: 3, name: 'Work', icon: Briefcase, iconName: 'Briefcase', mode: 'work' },
  { id: 4, name: 'Shopping', icon: ShoppingCart, iconName: 'ShoppingCart', mode: 'personal' },
  { id: 5, name: 'Personal', icon: User, iconName: 'User', mode: 'personal' },
  { id: 6, name: 'Learning', icon: BookOpen, iconName: 'BookOpen', mode: 'all' },
  { id: 7, name: 'Chores', icon: Settings, iconName: 'Settings', mode: 'all' },
];

export const APP_NAME = 'À faire';

// This username can be used for initial testing if you create a user with this username in your DB.
export const HARDCODED_USERNAME_FOR_TESTING = "pruebas"; 

// Hardcoded PIN for app lock (prototype only - NOT SECURE FOR PRODUCTION)
// Set to null to disable PIN lock feature
export const HARDCODED_APP_PIN: string | null = "1234";
    
// Default JWT secret key if not set in .env. IMPORTANT: Change this for production.
export const DEFAULT_JWT_SECRET_KEY = "your-secret-key-change-in-production";
