
import type { LucideIcon } from 'lucide-react';

// --- JWT ---
export interface Token {
  access_token: string;
  token_type: string;
}

export interface DecodedToken {
  sub: string; // User ID
  exp: number; // Expiry timestamp
  // Add other claims if present
}

// --- Backend Enums (mirroring FastAPI) ---
export type BackendCategoryMode = "personal" | "work" | "both";
export type BackendRepeatMode = "none" | "daily" | "weekly" | "monthly";

// --- Frontend Enums ---
export type AppMode = 'personal' | 'work';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

// --- TODO ---
export interface Todo {
  id: number; // Can be string for temp UUIDs on client before save
  text: string;
  completed: boolean;
}

export interface BackendTodoCreate {
  text: string;
  complete?: boolean;
}

export interface BackendTodo {
  id: number;
  text: string;
  complete: boolean;
  activity_id: number;
}

// --- RECURRENCE (Frontend) ---
export interface RecurrenceRule {
  type: RecurrenceType;
  endDate?: number | null; // Timestamp
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

// --- ACTIVITY ---
export interface Activity {
  id: number;
  title: string;
  categoryId: number;
  todos: Todo[];
  createdAt: number; // Start date timestamp
  time?: string;
  completed?: boolean; 
  completedAt?: number | null;
  notes?: string;
  recurrence?: RecurrenceRule | null;
  completedOccurrences?: Record<string, boolean>; 
  isRecurringInstance?: boolean;
  originalInstanceDate?: number;
  masterActivityId?: number;
  responsiblePersonIds?: number[];
  appMode: AppMode;
}

export interface BackendActivityCreatePayload {
  title: string;
  start_date: string; 
  time: string;
  category_id: number;
  repeat_mode?: BackendRepeatMode;
  end_date?: string | null;
  days_of_week?: string[] | null; 
  day_of_month?: number | null;
  notes?: string | null;
  mode: BackendCategoryMode;
  responsible_ids?: number[];
  todos?: BackendTodoCreate[];
}

export interface BackendActivityUpdatePayload {
  title?: string;
  start_date?: string;
  time?: string;
  category_id?: number;
  repeat_mode?: BackendRepeatMode;
  end_date?: string | null;
  days_of_week?: string[] | null; 
  day_of_month?: number | null;
  notes?: string | null;
  mode?: BackendCategoryMode;
  responsible_ids?: number[];
  // Todos are not updated via this payload; use separate todo endpoints
}

export interface BackendActivity {
  id: number;
  title: string;
  start_date: string; 
  time: string;
  category_id: number;
  repeat_mode: BackendRepeatMode;
  end_date?: string | null; 
  days_of_week?: string | null; 
  day_of_month?: number | null;
  notes?: string | null;
  mode: BackendCategoryMode;
  category: BackendCategory; // Assuming backend sends this nested object
  responsibles: BackendUser[]; // Assuming backend sends this
  todos: BackendTodo[]; // Assuming backend sends this
}

// --- CATEGORY ---
export interface Category {
  id: number;
  name: string;
  icon: LucideIcon;
  iconName: string;
  mode: AppMode | 'all';
}

export interface BackendCategoryCreatePayload {
  name: string;
  icon_name: string;
  mode: BackendCategoryMode;
}

export interface BackendCategoryUpdatePayload {
    name?: string;
    icon_name?: string;
    mode?: BackendCategoryMode;
}

export interface BackendCategory {
  id: number;
  name: string;
  icon_name: string;
  mode: BackendCategoryMode;
}

// --- ASSIGNEE (User on Backend) ---
export interface Assignee {
  id: number;
  name: string;
  username?: string;
  isAdmin?: boolean;
}

export interface BackendUserCreatePayload {
  name: string;
  username: string;
  password?: string; 
  is_admin?: boolean;
}

export interface BackendUserUpdatePayload {
  name?: string;
  username?: string;
  password?: string; 
  is_admin?: boolean;
}

export interface BackendUser {
  id: number;
  name: string;
  username: string;
  is_admin: boolean; 
}

// --- CHANGE PASSWORD ---
export interface ChangePasswordRequest {
    old_password: string;
    new_password: string; // Corrected from str to string
}


// --- UI NOTIFICATION (Client-side) ---
export interface UINotification {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  activityId?: number | string; // Allow string for pomodoro IDs
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
  | 'historyLogPasswordChangeAttempt'
  | 'historyLogAddAssignee'
  | 'historyLogUpdateAssignee'
  | 'historyLogDeleteAssignee';

export interface HistoryLogEntry {
  id: number;
  timestamp: number;
  actionKey: HistoryLogActionKey;
  details?: Record<string, string | number | boolean | undefined>;
  scope: 'account' | 'personal' | 'work' | 'category' | 'assignee';
  backendAction?: string;
  backendUserId?: number;
}

export interface BackendHistoryCreatePayload {
    action: string;
    user_id: number;
}

export interface BackendHistory {
  id: number;
  timestamp: string; 
  action: string;
  user_id: number;
  user?: BackendUser;
}

// --- POMODORO (Client-side) ---
export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak' | 'off';

// --- TRANSLATIONS ---
export type { Translations } from '@/lib/translations';

// --- AppContextType additions ---
export interface AppContextType {
  // ... existing properties
  fetchAndSetSpecificActivityDetails: (activityId: number) => Promise<Activity | null>;
}
