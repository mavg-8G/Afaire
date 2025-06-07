
import type { Category } from '@/lib/types';
import { Home, Dumbbell, Briefcase, ShoppingCart, User, Settings, BookOpen } from 'lucide-react';

// INITIAL_CATEGORIES removed. Categories will be fetched from the backend.

export const APP_NAME = 'À faire';

// HARDCODED_APP_PIN is null, meaning PIN lock relies on user-set PIN or is disabled.
export const HARDCODED_APP_PIN: string | null = null;
    
// Default API Base URL. Can be overridden by NEXT_PUBLIC_API_BASE_URL environment variable.
export const DEFAULT_API_BASE_URL = "https://afaire.is-cool.dev";

// Default JWT secret key if not set in .env.
// This MUST match the SECRET_KEY used by the backend.
export const DEFAULT_JWT_SECRET_KEY = "-9$Kc}EbDkafT$)<9k+R0wl[S[m3dL3B~$Cj^Q}cD,HGa+$tO/`zW+HW[%lj2_";

// Pomodoro Timer Durations
export const POMODORO_WORK_DURATION_SECONDS = 25 * 60;
export const POMODORO_SHORT_BREAK_DURATION_SECONDS = 5 * 60;
export const POMODORO_LONG_BREAK_DURATION_SECONDS = 15 * 60;



