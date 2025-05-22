
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
  // Future: interval (e.g., every 2 weeks)
}

export interface Activity {
  id: string;
  title: string;
  categoryId: string;
  todos: Todo[];
  createdAt: number; // For non-recurring: the date of the activity. For recurring: the start date of the recurrence.
  time?: string; // Optional time in HH:MM format
  completed?: boolean; // For non-recurring activities or to mark a whole recurring series as "finished/archived"
  notes?: string; // Optional field for additional notes

  recurrence?: RecurrenceRule | null;

  // For recurring activities, to track completion of specific instances
  // Key: YYYY-MM-DD ISO string of the occurrence date
  // Value: boolean indicating completion
  completedOccurrences?: Record<string, boolean>;

  // --- Fields used for displaying generated instances of recurring activities ---
  // These are not stored on the master activity but are populated on the fly for display.
  isRecurringInstance?: boolean; // True if this activity object represents a generated occurrence
  originalInstanceDate?: number; // Timestamp of this specific occurrence's date
  masterActivityId?: string; // ID of the original recurring activity
}

export type AppMode = 'personal' | 'work';

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  iconName: string;
  mode?: AppMode | 'all';
}
