
import type { LucideIcon } from 'lucide-react';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export type ActivityStatus = 'todo' | 'inProgress' | 'completed';

export interface Activity {
  id: string;
  title: string;
  categoryId: string;
  todos: Todo[];
  status: ActivityStatus;
  createdAt: number; // Timestamp for the date
  time?: string; // Optional time in HH:MM format
  completed?: boolean; // Added for activity completion status
}

export type AppMode = 'personal' | 'work';

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  iconName: string; // Added for easier editing and consistent storage
  mode?: AppMode | 'all'; // Category can be personal, work, or available in all modes
}

export type ViewMode = 'all' | 'daily' | 'weekly' | 'monthly'; // For potential future filtering

