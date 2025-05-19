import type { Category, ActivityStatus } from '@/lib/types';
import { Home, Dumbbell, Briefcase, ShoppingCart, User, Settings, BookOpen } from 'lucide-react';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat_home', name: 'Home', icon: Home },
  { id: 'cat_gym', name: 'Gym', icon: Dumbbell },
  { id: 'cat_work', name: 'Work', icon: Briefcase },
  { id: 'cat_shopping', name: 'Shopping', icon: ShoppingCart },
  { id: 'cat_personal', name: 'Personal', icon: User },
  { id: 'cat_learning', name: 'Learning', icon: BookOpen },
  { id: 'cat_chores', name: 'Chores', icon: Settings },
];

export const KANBAN_STATUSES: { id: ActivityStatus; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'inProgress', title: 'In Progress' },
  { id: 'completed', title: 'Completed' },
];

export const APP_NAME = 'TodoFlow';
