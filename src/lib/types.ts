
import type { LucideIcon } from 'lucide-react';

// --- JWT ---
export interface Token {
  access_token: string;
  refresh_token: string; // Added refresh_token
  token_type: string;
  user_id: number;
  username: string;
  is_admin: boolean;
}

export interface DecodedToken {
  sub: string; // User ID (from token's 'sub' claim)
  exp: number; // Expiry timestamp
  // Store additional user info directly from login response if needed
  userId?: number; // Actual user ID from backend
  username?: string;
  isAdmin?: boolean;
}

// --- Backend Enums (mirroring FastAPI) ---
export type BackendCategoryMode = "personal" | "work" | "both";
export type BackendRepeatMode = "none" | "daily" | "weekly" | "monthly";

// --- Frontend Enums ---
export type AppMode = 'personal' | 'work';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

// --- TODO ---
export interface Todo {
  id: number;
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

// --- ACTIVITY OCCURRENCE ---
export interface BackendActivityOccurrence {
  id: number;
  activity_id: number;
  date: string; // ISO datetime string from backend
  complete: boolean;
  activity_title?: string; // Optional, as per ActivityOccurrenceResponse
}

export interface BackendActivityOccurrenceCreate {
  activity_id: number;
  date: string; // ISO datetime string to send to backend
  complete?: boolean;
}

export interface BackendActivityOccurrenceUpdate {
  date?: string; // ISO datetime string
  complete?: boolean;
}


// --- ACTIVITY ---
export interface Activity {
  id: number;
  title: string;
  categoryId: number;
  todos: Todo[];
  createdAt: number; // Start date timestamp
  time?: string;
  completed?: boolean; // Overall completion status for non-recurring, or if all todos are done.
  completedAt?: number | null;
  notes?: string;
  recurrence?: RecurrenceRule | null;
  completedOccurrences: Record<string, boolean>; // Key: YYYY-MM-DD date string, Value: completion status
  isRecurringInstance?: boolean;
  originalInstanceDate?: number;
  masterActivityId?: number;
  responsiblePersonIds?: number[];
  appMode: AppMode;
}

// Represents the data structure from GET /activities (list view)
// Aligned with backend's ActivityResponse
export interface BackendActivityListItem {
  id: number;
  title: string;
  start_date: string; // ISO string
  time: string;
  category_id: number;
  repeat_mode: BackendRepeatMode;
  end_date?: string | null; // ISO string
  days_of_week?: string | null; // Comma-separated string "0,1,2"
  day_of_month?: number | null;
  notes?: string | null;
  mode: BackendCategoryMode;
  responsible_ids: number[];
}

// Represents the richer data structure from GET /activities/{id} (now ActivityResponse),
// and POST /activities, PUT /activities/{id} (still ORM model)
export interface BackendActivity {
  id: number;
  title: string;
  start_date: string; // ISO string
  time: string;
  category_id: number;
  repeat_mode: BackendRepeatMode;
  end_date?: string | null; // ISO string
  days_of_week?: string | null; // Comma-separated string "0,1,2"
  day_of_month?: number | null;
  notes?: string | null;
  mode: BackendCategoryMode;

  // These fields are present in the rich ORM model (e.g., POST/PUT response)
  // but might be absent or different in ActivityResponse (e.g., GET /activities/{id})
  category?: BackendCategory;
  responsibles?: BackendUser[];
  todos?: BackendTodo[];
  occurrences?: BackendActivityOccurrence[]; // Added for initial occurrences

  // These fields are specifically from ActivityResponse (for GET /activities/{id})
  responsible_ids?: number[];
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
    new_password: string;
}


// --- UI NOTIFICATION (Client-side) ---
export interface UINotification {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  activityId?: number | string;
  instanceDate?: number;
}

// --- HISTORY ---
export type HistoryLogActionKey =
  | 'historyLogLogin'
  | 'historyLogLogout'
  | 'historyLogAddActivity'
  | 'historyLogUpdateActivity'
  | 'historyLogDeleteActivity'
  | 'historyLogToggleActivityCompletion'
  | 'historyLogAddCategory'
  | 'historyLogUpdateCategory'
  | 'historyLogDeleteCategory'
  | 'historyLogSwitchMode' // Consolidated switch mode
  | 'historyLogPasswordChangeAttempt'
  | 'historyLogAddAssignee'
  | 'historyLogUpdateAssignee'
  | 'historyLogDeleteAssignee';

export interface HistoryLogEntry {
  id: number;
  timestamp: number;
  actionKey: HistoryLogActionKey;
  details?: Record<string, string | number | boolean | undefined | null>;
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
  activities: Activity[];
  getRawActivities: () => Activity[];
  categories: Category[];
  assignees: Assignee[];
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  addActivity: (
    activityData: Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'completedAt' | 'notes' | 'recurrence' | 'completedOccurrences' | 'responsiblePersonIds' | 'categoryId'| 'appMode'| 'masterActivityId' | 'isRecurringInstance' | 'originalInstanceDate'> & {
      todos?: Omit<Todo, 'id'>[]; time?: string; notes?: string; recurrence?: RecurrenceRule | null; responsiblePersonIds?: number[]; categoryId: number; appMode: AppMode;
    }, customCreatedAt?: number
  ) => Promise<void>;
  updateActivity: (activityId: number, updates: Partial<Omit<Activity, 'id' | 'todos'>>, originalActivity?: Activity) => Promise<void>;
  deleteActivity: (activityId: number) => Promise<void>;
  toggleOccurrenceCompletion: (masterActivityId: number, occurrenceDateTimestamp: number, completedState: boolean) => Promise<void>;
  addTodoToActivity: (activityId: number, todoText: string, completed?: boolean) => Promise<Todo | null>;
  updateTodoInActivity: (activityId: number, todoId: number, updates: Partial<Todo>) => Promise<void>;
  deleteTodoFromActivity: (activityId: number, todoId: number) => Promise<void>;
  getCategoryById: (categoryId: number) => Category | undefined;
  addCategory: (name: string, iconName: string, mode: AppMode | 'all') => Promise<void>;
  updateCategory: (categoryId: number, updates: Partial<Omit<Category, 'id' | 'icon'>>, oldCategoryData?: Category) => Promise<void>;
  deleteCategory: (categoryId: number) => Promise<void>;
  addAssignee: (name: string, username: string, password?: string, isAdmin?: boolean) => Promise<void>;
  updateAssignee: (assigneeId: number, updates: Partial<Pick<Assignee, 'name' | 'username' | 'isAdmin'>>, newPassword?: string) => Promise<void>;
  deleteAssignee: (assigneeId: number) => Promise<void>;
  getAssigneeById: (assigneeId: number) => Assignee | undefined;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  getCurrentUserId: () => number | null;
  uiNotifications: UINotification[];
  addUINotification: (data: Omit<UINotification, 'id' | 'timestamp' | 'read'>) => void;
  markUINotificationAsRead: (notificationId: string) => void;
  markAllUINotificationsAsRead: () => void;
  clearAllUINotifications: () => void;
  historyLog: HistoryLogEntry[];
  addHistoryLogEntry: (actionKey: HistoryLogActionKey, details?: Record<string, string | number | boolean | undefined | null>, scope?: HistoryLogEntry['scope']) => Promise<void>;
  systemNotificationPermission: NotificationPermission | null;
  requestSystemNotificationPermission: () => Promise<void>;
  pomodoroPhase: PomodoroPhase;
  pomodoroTimeRemaining: number;
  pomodoroIsRunning: boolean;
  pomodoroCyclesCompleted: number;
  startPomodoroWork: () => void;
  startPomodoroShortBreak: () => void;
  startPomodoroLongBreak: () => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  resetPomodoro: () => void;
  isPomodoroReady: boolean;
  isAppLocked: boolean;
  appPinState: string | null;
  unlockApp: (pinAttempt: string) => boolean;
  setAppPin: (pin: string | null) => void;
  fetchAndSetSpecificActivityDetails: (activityId: number) => Promise<Activity | null>;
}
