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
  createdAt: number; // Timestamp
  completed?: boolean; // Added for activity completion status
}

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
}

export type ViewMode = 'all' | 'daily' | 'weekly' | 'monthly'; // For potential future filtering
