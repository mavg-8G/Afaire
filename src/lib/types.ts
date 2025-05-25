
import type { LucideIcon } from 'lucide-react';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export interface RecurrenceRule {
  type: 'none' | 'daily' | 'weekly' | 'monthly';
  endDate?: number | null; // Timestamp
  daysOfWeek?: number[]; // For weekly: 0 (Sun) to 6 (Sat)
  dayOfMonth?: number;   // For monthly: 1-31
}

export interface Activity {
  id: string;
  title: string;
  categoryId: string;
  todos: Todo[];
  createdAt: number; // This is the start date for non-recurring or the first occurrence date for recurring
  time?: string;
  completed?: boolean; // For non-recurring tasks or the master completion status if used differently
  completedAt?: number | null; // Timestamp for when a non-recurring activity was completed
  notes?: string;
  recurrence?: RecurrenceRule | null;
  completedOccurrences?: Record<string, boolean>; // Key: YYYY-MM-DD date string of occurrence
  isRecurringInstance?: boolean; // Client-side flag, not stored
  originalInstanceDate?: number; // Client-side flag for instance's specific date, not stored on master
  masterActivityId?: string; // Client-side flag, not stored
  responsiblePersonIds?: string[]; // Changed from responsiblePersonId
}

export type AppMode = 'personal' | 'work';

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  iconName: string;
  mode?: AppMode | 'all';
}

export interface Assignee {
  id: string;
  name: string;
  // mode property removed as assignees are now only for personal mode
}

export interface UINotification {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  activityId?: string;
  instanceDate?: number;
}

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

export interface HistoryLogEntry {
  id: string;
  timestamp: number;
  actionKey: HistoryLogActionKey;
  details?: Record<string, string | number | boolean | undefined>;
  scope: 'account' | 'personal' | 'work' | 'category' | 'assignee';
}

export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak' | 'off';
