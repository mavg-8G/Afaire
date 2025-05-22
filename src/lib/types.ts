
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
  createdAt: number; 
  time?: string; 
  completed?: boolean; 
  notes?: string; 
  recurrence?: RecurrenceRule | null;
  completedOccurrences?: Record<string, boolean>;
  isRecurringInstance?: boolean; 
  originalInstanceDate?: number; 
  masterActivityId?: string; 
}

export type AppMode = 'personal' | 'work';

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  iconName: string;
  mode?: AppMode | 'all';
}

export interface UINotification {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  activityId?: string; // Optional: to link notification to an activity
  instanceDate?: number; // Optional: if it's for a specific recurring instance
}
