
import type { LucideIcon } from 'lucide-react';

// --- Backend Enums (mirroring FastAPI) ---
export type BackendCategoryMode = "personal" | "work" | "both";
export type BackendRepeatMode = "none" | "daily" | "weekly" | "monthly";

// --- Frontend Enums ---
export type AppMode = 'personal' | 'work'; // Frontend concept, maps to CategoryMode for activities/categories
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly'; // Frontend concept

// --- TODO ---
export interface Todo {
  id: number; // Will be assigned by backend if synced
  text: string;
  completed: boolean; // Remains client-side as backend Todo doesn't have it
}

export interface BackendTodoCreate { // For sending to backend
  text: string;
}

export interface BackendTodo { // Received from backend
  id: number;
  text: string;
  activity_id: number;
}

// --- RECURRENCE (Frontend) ---
export interface RecurrenceRule {
  type: RecurrenceType;
  endDate?: number | null; // Timestamp
  daysOfWeek?: number[]; // For weekly: 0 (Sun) to 6 (Sat)
  dayOfMonth?: number;   // For monthly: 1-31
}

// --- ACTIVITY ---
export interface Activity {
  id: number; // Changed from string
  title: string;
  categoryId: number; // Already number
  todos: Todo[];
  createdAt: number; // Frontend: Start date timestamp or first occurrence for recurring
  time?: string; // Format HH:MM
  completed?: boolean; // For non-recurring tasks or master completion (client-side concept)
  completedAt?: number | null; // Timestamp for non-recurring completion (client-side)
  notes?: string;
  recurrence?: RecurrenceRule | null; // Frontend recurrence object
  completedOccurrences?: Record<string, boolean>; // Key: YYYY-MM-DD (client-side)
  isRecurringInstance?: boolean; // Client-side flag
  originalInstanceDate?: number; // Client-side flag (timestamp)
  masterActivityId?: number; // Client-side flag
  responsiblePersonIds?: number[]; // Changed from string[]
  appMode: AppMode; // To determine which mode this activity belongs to, helps map to backend 'mode'
}

// For creating an activity and sending to backend
export interface BackendActivityCreatePayload {
  title: string;
  start_date: string; // ISO datetime string
  time: string; // HH:MM
  category_id: number;
  repeat_mode?: BackendRepeatMode;
  end_date?: string | null; // ISO datetime string
  days_of_week?: string[]; // Array of strings "0", "1", ... "6"
  day_of_month?: number | null;
  notes?: string | null;
  mode: BackendCategoryMode; // 'personal' or 'work' (derived from frontend AppMode)
  responsible_ids?: number[];
  todos?: BackendTodoCreate[];
}

// For updating an activity and sending to backend
export interface BackendActivityUpdatePayload {
  title?: string;
  start_date?: string; // ISO datetime string
  time?: string;
  category_id?: number;
  repeat_mode?: BackendRepeatMode;
  end_date?: string | null;
  days_of_week?: string[] | null;
  day_of_month?: number | null;
  notes?: string | null;
  mode?: BackendCategoryMode;
  responsible_ids?: number[];
  // Todos are not directly updatable via this backend endpoint, would need separate logic or full replacement
}

// For activity received from backend
export interface BackendActivity {
  id: number;
  title: string;
  start_date: string; // ISO datetime string
  time: string;
  category_id: number;
  repeat_mode: BackendRepeatMode;
  end_date?: string | null;
  days_of_week?: string | null; // Comma-separated string "0,1,2"
  day_of_month?: number | null;
  notes?: string | null;
  mode: BackendCategoryMode;
  category: BackendCategory; // Nested category info
  responsibles: BackendUser[]; // List of responsible users
  todos: BackendTodo[]; // List of todos associated
}


// --- CATEGORY ---
export interface Category {
  id: number; // Already number
  name: string;
  icon: LucideIcon;
  iconName: string;
  mode: AppMode | 'all'; // Frontend concept, maps to BackendCategoryMode
}

export interface BackendCategoryCreatePayload { // For sending to backend
  name: string;
  icon_name: string;
  mode: BackendCategoryMode; // 'personal', 'work', or 'both'
}

export interface BackendCategory { // Received from backend
  id: number;
  name: string;
  icon_name: string;
  mode: BackendCategoryMode;
}

// --- ASSIGNEE (User on Backend) ---
export interface Assignee { // Frontend representation
  id: number; // Changed from string
  name: string;
  username?: string; // For creation, might not be displayed always
}

export interface BackendUserCreatePayload { // For sending to backend
  name: string;
  username: string;
  password?: string; // Password for creation
}
export interface BackendUserUpdatePayload { // For sending to backend
  name?: string;
  username?: string;
  password?: string;
}


export interface BackendUser { // Received from backend
  id: number;
  name: string;
  username: string;
  // hashed_password is not exposed to frontend
}


// --- UI NOTIFICATION (Client-side) ---
export interface UINotification {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  activityId?: number; // Changed from string
  instanceDate?: number;
}

// --- HISTORY ---
export type HistoryLogActionKey =
  | 'historyLogLogin'
  | 'historyLogLogout'
  | 'historyLogAddActivityPersonal'
  | 'historyLogAddActivityWork'
  | 'historyLogUpdateActivityPersonal'
  | 'historyLogUpdateActivityWork'
  | 'historyLogDeleteActivityPersonal'
  | 'historyLogDeleteActivityWork'
  | 'historyLogToggleActivityCompletionPersonal'
  | 'historyLogToggleActivityCompletionWork'
  | 'historyLogAddCategoryPersonal'
  | 'historyLogAddCategoryWork'
  | 'historyLogAddCategoryAll'
  | 'historyLogUpdateCategoryPersonal'
  | 'historyLogUpdateCategoryWork'
  | 'historyLogUpdateCategoryAll'
  | 'historyLogDeleteCategory'
  | 'historyLogSwitchToPersonalMode'
  | 'historyLogSwitchToWorkMode'
  | 'historyLogPasswordChange'
  | 'historyLogAddAssignee'
  | 'historyLogUpdateAssignee'
  | 'historyLogDeleteAssignee';

export interface HistoryLogEntry { // Frontend representation
  id: number; // Changed from string
  timestamp: number; // Unix Timestamp (ms)
  actionKey: HistoryLogActionKey; // Or string if using backend 'action' directly
  details?: Record<string, string | number | boolean | undefined>; // Frontend details
  scope: 'account' | 'personal' | 'work' | 'category' | 'assignee'; // Frontend scope
  backendAction?: string; // Store original backend action if different
  backendUserId?: number; // Store original backend user_id
}

export interface BackendHistory { // Received from backend
  id: number;
  timestamp: string; // ISO datetime string
  action: string;
  user_id: number;
  user?: BackendUser; // Optional user details
}

// --- POMODORO (Client-side) ---
export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak' | 'off';

// --- TRANSLATIONS ---
export type { Translations } from '@/lib/translations';
    
