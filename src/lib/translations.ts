
export type Locale = 'en' | 'es' | 'fr';

export type Translations = {
  // AppHeader
  addActivity: string;
  manageCategories: string;
  language: string;
  english: string;
  spanish: string;
  french: string;
  theme: string;
  lightTheme: string;
  darkTheme: string;
  systemTheme: string;
  moreOptions: string;
  moreOptionsDesktop: string;
  personalMode: string;
  workMode: "Work"; // Keep as "Work" for type consistency, translation will handle "Trabajo"
  switchToPersonalMode: string;
  switchToWorkMode: string;
  logout: string;
  changePassword: string;
  dashboard: string;
  notificationsTitle: string;
  noNotificationsYet: string;
  notificationUnread: string;
  markAllAsRead: string;
  clearAllNotifications: string;
  notificationBellLabel: string;
  viewHistory: string;
  enableSystemNotifications: string;
  systemNotificationsEnabled: string;
  systemNotificationsBlocked: string;
  enableSystemNotificationsDescription: string;
  systemNotificationsNowActive: string;
  systemNotificationsUserDenied: string;
  systemNotificationsNotYetEnabled: string;
  systemNotificationsDismissed: string;
  manageAssignees: string;
  pomodoroTimerMenuLabel: string;


  // CategoriesPage
  backToCalendar: string;
  addCategory: string;
  editCategory: string;
  addNewCategory: string;
  updateCategoryDetails: string;
  createCategoryDescription: string;
  categoryName: string;
  iconName: string;
  iconNameDescriptionLink: string;
  categoryMode: string;
  modePersonal: string;
  modeWork: string;
  modeAll: string;
  saveChanges: string;
  cancel: string;
  existingCategories: string;
  viewEditManageCategories: string;
  delete: string;
  confirmDelete: string;
  confirmDeleteCategoryDescription: (params: { categoryName: string }) => string;
  categoriesCount: (params: { count: number }) => string;
  noCategoriesYet: string;

  // AssigneesPage
  addNewAssignee: string;
  editAssignee: string;
  assigneeNameLabel: string;
  assigneeNamePlaceholder: string;
  createAssigneeDescription: string;
  updateAssigneeDetails: string;
  existingAssignees: string;
  viewEditManageAssignees: string;
  confirmDeleteAssigneeDescription: (params: { assigneeName: string }) => string;
  assigneesCount: (params: { count: number }) => string;
  noAssigneesYet: string;


  // ActivityModal
  editActivityTitle: string;
  addActivityTitle: string;
  editActivityDescription: (params: { formattedInitialDate: string }) => string;
  addActivityDescription: (params: { formattedInitialDate: string }) => string;
  activityTitleLabel: string;
  categoryLabel: string;
  selectCategoryPlaceholder: string;
  loadingCategoriesPlaceholder: string;
  activityDateLabel: string;
  pickADate: string;
  activityTimeLabel: string;
  activityTimeDescription24Hour: string;
  activityNotesLabel: string;
  activityNotesPlaceholder: string;
  todosLabel: string;
  addTodo: string;
  newTodoPlaceholder: string;
  toastActivityUpdatedTitle: string;
  toastActivityUpdatedDescription: string;
  toastActivityAddedTitle: string;
  toastActivityAddedDescription: string;
  recurrenceLabel: string;
  recurrenceTypeLabel: string;
  recurrenceNone: string;
  recurrenceDaily: string;
  recurrenceWeekly: string;
  recurrenceMonthly: string;
  recurrenceEndDateLabel: string;
  recurrenceNoEndDate: string;
  recurrencePickEndDate: string;
  recurrenceDaysOfWeekLabel: string;
  recurrenceDayOfMonthLabel: string;
  recurrenceDayOfMonthPlaceholder: string;
  recurrenceClearEndDate: string;
  daySun: string;
  dayMon: string;
  dayTue: string;
  dayWed: string;
  dayThu: string;
  dayFri: string;
  daySat: string;
  invalidTimeFormat24Hour: string;
  responsiblePersonLabel: string;
  selectResponsiblePersonPlaceholder: string;
  unassigned: string;


  // ActivityCalendarView
  activitiesForDate: (params: { date: string }) => string;
  activitiesForWeek: (params: { startDate: string; endDate: string }) => string;
  activitiesForMonth: (params: { month: string }) => string;
  loadingDate: string;
  noActivitiesForDay: string;
  noActivitiesForPeriod: string;
  selectDateToSeeActivities: string;
  confirmDeleteActivityTitle: string;
  confirmDeleteActivityDescription: (params: { activityTitle: string }) => string;
  toastActivityDeletedTitle: string;
  toastActivityDeletedDescription: (params: { activityTitle: string }) => string;
  todayButton: string;
  viewDaily: string;
  viewWeekly: string;
  viewMonthly: string;
  allActivitiesCompleted: string;


  // ActivityListItem
  editActivitySr: string;
  deleteActivitySr: string;
  addToCalendarSr: string; // New translation
  todosCompleted: (params: { completed: number, total: number }) => string;
  noDetailsAvailable: string;
  noTodosForThisActivity: string;
  recurrenceDailyText: string;
  recurrenceWeeklyText: string;
  recurrenceMonthlyText: string;


  // LoginPage
  loginWelcomeMessage: string;
  loginUsernameLabel: string;
  loginPasswordLabel: string;
  loginUsernamePlaceholder: string;
  loginPasswordPlaceholder: string;
  loginButtonText: string;
  loginLoggingIn: string;
  loginInvalidCredentials: string;
  loginErrorTitle: string;
  loginLockoutTitle: string;
  loginLockoutMessage: (params: { seconds: number }) => string;
  loginUsernameRequired: string;
  loginPasswordRequired: string;
  loginSecurityNotice: string;
  loginRedirecting: string;
  rememberMeLabel: string;
  showPassword?: string;
  hidePassword?: string;


  // ChangePasswordModal
  changePasswordModalTitle: string;
  changePasswordModalDescription: string;
  currentPasswordLabel: string;
  newPasswordLabel: string;
  confirmNewPasswordLabel: string;
  currentPasswordPlaceholder: string;
  newPasswordPlaceholder: string;
  confirmNewPasswordPlaceholder: string;
  updatePasswordButton: string;
  passwordUpdateSuccessTitle: string;
  passwordUpdateSuccessDescription: string;
  passwordUpdateErrorIncorrectCurrent: string;
  passwordUpdateErrorNewPasswordRequired: string;
  passwordUpdateErrorConfirmPasswordRequired: string;
  passwordUpdateErrorPasswordsDoNotMatch: string;
  passwordUpdateErrorCurrentEqualsNew: string;
  passwordMinLength: (params: { length: number }) => string;

  // AppProvider Toasts
  toastCategoryAddedTitle: string;
  toastCategoryAddedDescription: (params: { categoryName: string }) => string;
  toastCategoryUpdatedTitle: string;
  toastCategoryUpdatedDescription: (params: { categoryName: string }) => string;
  toastCategoryDeletedTitle: string;
  toastCategoryDeletedDescription: (params: { categoryName: string }) => string;
  toastActivityStartingSoonTitle: string;
  toastActivityStartingSoonDescription: (params: { activityTitle: string, activityTime: string }) => string;
  toastActivityTomorrowTitle: string;
  toastActivityTomorrowDescription: (params: { activityTitle: string }) => string;
  toastActivityInTwoDaysTitle: string;
  toastActivityInTwoDaysDescription: (params: { activityTitle: string }) => string;
  toastActivityInOneWeekTitle: string;
  toastActivityInOneWeekDescription: (params: { activityTitle: string }) => string;
  loginSuccessNotificationTitle: string;
  loginSuccessNotificationDescription: string;
  toastAssigneeAddedTitle: string;
  toastAssigneeAddedDescription: (params: { assigneeName: string }) => string;
  toastAssigneeUpdatedTitle: string;
  toastAssigneeUpdatedDescription: (params: { assigneeName: string }) => string;
  toastAssigneeDeletedTitle: string;
  toastAssigneeDeletedDescription: (params: { assigneeName: string }) => string;


  // Dashboard Page
  dashboardTitle: string;
  dashboardMainDescription: string;
  dashboardChartView: string;
  dashboardListView: string;
  dashboardViewWeekly: string;
  dashboardViewMonthly: string;
  dashboardChartTotalActivities: string;
  dashboardChartCompletedActivities: string;
  dashboardWeekLabel: string;
  dashboardNoData: string;
  dashboardListLast7Days: string;
  dashboardListCurrentMonth: string;
  dashboardNoActivitiesForList: string;
  dashboardNotesLabel: string;
  dashboardProductivityView: string;
  dashboardCategoryBreakdown: string;
  dashboardCompletionStats: string;
  dashboardActivityCountLabel: string; // For BarChart legend
  dashboardOverallCompletionRate: string;
  dashboardTotalActivitiesLabel: string;
  dashboardTotalCompletedLabel: string;
  dashboardNoDataForAnalysis: string;

  // History Page
  historyPageTitle: string;
  historyPageDescription: string;
  noHistoryYet: string;
  historyLogLogin: string;
  historyLogLogout: string;
  historyLogAddActivityPersonal: (params: { title: string }) => string;
  historyLogAddActivityWork: (params: { title: string }) => string;
  historyLogUpdateActivityPersonal: (params: { title: string }) => string;
  historyLogUpdateActivityWork: (params: { title: string }) => string;
  historyLogDeleteActivityPersonal: (params: { title: string }) => string;
  historyLogDeleteActivityWork: (params: { title: string }) => string;
  historyLogToggleActivityCompletionPersonal: (params: { title: string, completed: boolean }) => string;
  historyLogToggleActivityCompletionWork: (params: { title: string, completed: boolean }) => string;
  historyLogAddCategoryPersonal: (params: { name: string }) => string;
  historyLogAddCategoryWork: (params: { name: string }) => string;
  historyLogAddCategoryAll: (params: { name: string }) => string;
  historyLogUpdateCategoryPersonal: (params: { name: string, oldName?: string, oldMode?: string }) => string;
  historyLogUpdateCategoryWork: (params: { name: string, oldName?: string, oldMode?: string }) => string;
  historyLogUpdateCategoryAll: (params: { name: string, oldName?: string, oldMode?: string }) => string;
  historyLogDeleteCategory: (params: { name: string, mode: string }) => string;
  historyLogSwitchToPersonalMode: string;
  historyLogSwitchToWorkMode: string;
  historyLogPasswordChange: string;
  historyLogAddAssignee: (params: { name: string }) => string;
  historyLogUpdateAssignee: (params: { name: string, oldName?: string }) => string;
  historyLogDeleteAssignee: (params: { name: string }) => string;
  historyScopeAccount: string;
  historyScopePersonal: string;
  historyScopeWork: string;
  historyScopeCategory: string;
  historyScopeAssignee: string;

  // Motivational Phrases
  motivationalPhrases: string[];

  // Pomodoro Timer
  pomodoroTitle: string;
  pomodoroStartWork: string;
  pomodoroStartShortBreak: string;
  pomodoroStartLongBreak: string;
  pomodoroPause: string;
  pomodoroResume: string;
  pomodoroReset: string;
  pomodoroWorkSession: string;
  pomodoroShortBreakSession: string;
  pomodoroLongBreakSession: string;
  pomodoroReadyToStart: string;
  pomodoroWorkSessionEnded: string;
  pomodoroShortBreakEnded: string;
  pomodoroLongBreakEnded: string;
  pomodoroTakeABreakOrStartNext: string;
  pomodoroFocusOnTask: string;
  pomodoroShortRelaxation: string;
  pomodoroLongRelaxation: string;
  pomodoroCyclesCompleted: (params: { cycles: number }) => string;
  pomodoroTakeAShortBreak: string;
  pomodoroTakeALongBreak: string;
  pomodoroBackToWork: string;
  pomodoroErrorTitle: string;
  pomodoroSWNotReady: string;
  pomodoroInitializing: string;
};

export const translations: Record<Locale, Translations> = {
  en: {
    addActivity: "Add Activity",
    manageCategories: "Categories",
    language: "Language",
    english: "English",
    spanish: "Spanish",
    french: "French",
    theme: "Theme",
    lightTheme: "Light",
    darkTheme: "Dark",
    systemTheme: "System",
    moreOptions: "More options",
    moreOptionsDesktop: "Settings",
    personalMode: "Personal",
    workMode: "Work",
    switchToPersonalMode: "Switch to Personal Mode",
    switchToWorkMode: "Switch to Work Mode",
    logout: "Logout",
    changePassword: "Change Password",
    dashboard: "Dashboard",
    notificationsTitle: "Notifications",
    noNotificationsYet: "No new notifications.",
    notificationUnread: "unread",
    markAllAsRead: "Mark all as read",
    clearAllNotifications: "Clear all",
    notificationBellLabel: "View notifications",
    viewHistory: "View History",
    enableSystemNotifications: "Enable System Notifications",
    systemNotificationsEnabled: "System Notifications Enabled",
    systemNotificationsBlocked: "System Notifications Blocked",
    enableSystemNotificationsDescription: "To enable notifications, please check your browser and system settings.",
    systemNotificationsNowActive: "System notifications are now active!",
    systemNotificationsUserDenied: "You've denied notification permissions. Please change this in your browser settings if you wish to enable them.",
    systemNotificationsNotYetEnabled: "System notifications not yet enabled.",
    systemNotificationsDismissed: "You can enable notifications later from the options menu.",
    manageAssignees: "Manage Assignees",
    pomodoroTimerMenuLabel: "Pomodoro Timer",
    backToCalendar: "Back to Calendar",
    addCategory: "Add Category",
    editCategory: "Edit Category",
    addNewCategory: "Add New Category",
    updateCategoryDetails: "Update the details of your category.",
    createCategoryDescription: "Create a new category for your activities.",
    categoryName: "Category Name",
    iconName: "Icon Name (from Lucide)",
    iconNameDescriptionLink: "Enter a PascalCase icon name from <a>lucide.dev/icons</a>.",
    categoryMode: "Category Mode",
    modePersonal: "Personal",
    modeWork: "Work",
    modeAll: "All Modes",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    existingCategories: "Existing Categories",
    viewEditManageCategories: "View, edit, and manage your current categories.",
    delete: "Delete",
    confirmDelete: "Are you sure?",
    confirmDeleteCategoryDescription: (params) => `This action will delete the category "${params.categoryName}". Activities using this category will no longer be associated with it. This cannot be undone.`,
    categoriesCount: (params) => `You have ${params.count} categor${params.count === 1 ? 'y' : 'ies'}.`,
    noCategoriesYet: "No categories added yet. Use the form to add your first category.",
    addNewAssignee: "Add New Assignee",
    editAssignee: "Edit Assignee",
    assigneeNameLabel: "Assignee Name",
    assigneeNamePlaceholder: "e.g., John Doe, Partner",
    createAssigneeDescription: "Create a new assignee for your tasks.",
    updateAssigneeDetails: "Update the details of this assignee.",
    existingAssignees: "Existing Assignees",
    viewEditManageAssignees: "View, edit, and manage your assignees.",
    confirmDeleteAssigneeDescription: (params) => `This action will delete the assignee "${params.assigneeName}". Activities assigned to them will become unassigned. This cannot be undone.`,
    assigneesCount: (params) => `You have ${params.count} assignee${params.count === 1 ? '' : 's'}.`,
    noAssigneesYet: "No assignees added yet. Use the form to add your first assignee.",
    editActivityTitle: "Edit Activity",
    addActivityTitle: "Add New Activity",
    editActivityDescription: (params) => `Update the details of your activity. Default date: ${params.formattedInitialDate}.`,
    addActivityDescription: (params) => `Fill in the details for your new activity. Default date: ${params.formattedInitialDate}.`,
    activityTitleLabel: "Activity Title",
    categoryLabel: "Category",
    selectCategoryPlaceholder: "Select a category",
    loadingCategoriesPlaceholder: "Loading categories...",
    activityDateLabel: "Start Date / Date",
    pickADate: "Pick a date",
    activityTimeLabel: "Activity Time (HH:MM)",
    activityTimeDescription24Hour: "Use 24-hour format (e.g., 14:30).",
    activityNotesLabel: "Notes",
    activityNotesPlaceholder: "Add any additional details or links here...",
    todosLabel: "Todos",
    addTodo: "Add Todo",
    newTodoPlaceholder: "New todo item",
    toastActivityUpdatedTitle: "Activity Updated",
    toastActivityUpdatedDescription: "Your activity has been successfully updated.",
    toastActivityAddedTitle: "Activity Added",
    toastActivityAddedDescription: "Your new activity has been successfully added.",
    recurrenceLabel: "Recurrence",
    recurrenceTypeLabel: "Repeats",
    recurrenceNone: "None",
    recurrenceDaily: "Daily",
    recurrenceWeekly: "Weekly",
    recurrenceMonthly: "Monthly",
    recurrenceEndDateLabel: "End Date",
    recurrenceNoEndDate: "No end date",
    recurrencePickEndDate: "Pick end date",
    recurrenceDaysOfWeekLabel: "On Days",
    recurrenceDayOfMonthLabel: "Day of Month",
    recurrenceDayOfMonthPlaceholder: "e.g., 15",
    recurrenceClearEndDate: "Clear end date",
    daySun: "Sun",
    dayMon: "Mon",
    dayTue: "Tue",
    dayWed: "Wed",
    dayThu: "Thu",
    dayFri: "Fri",
    daySat: "Sat",
    invalidTimeFormat24Hour: "Invalid time format. Use HH:MM (24-hour).",
    responsiblePersonLabel: "Responsible Person",
    selectResponsiblePersonPlaceholder: "Select an assignee",
    unassigned: "Unassigned",
    activitiesForDate: (params) => `Activities for ${params.date}`,
    activitiesForWeek: (params) => `Activities for week: ${params.startDate} - ${params.endDate}`,
    activitiesForMonth: (params) => `Activities for ${params.month}`,
    loadingDate: "Loading date...",
    noActivitiesForDay: "No activities scheduled for this day.",
    noActivitiesForPeriod: "No activities scheduled for this period.",
    selectDateToSeeActivities: "Select a date to see activities.",
    confirmDeleteActivityTitle: "Are you sure?",
    confirmDeleteActivityDescription: (params) => `This action cannot be undone. This will permanently delete the activity "${params.activityTitle}" and all its associated todos. If it's a recurring activity, the entire series will be deleted.`,
    toastActivityDeletedTitle: "Activity Deleted",
    toastActivityDeletedDescription: (params) => `"${params.activityTitle}" has been removed.`,
    todayButton: "Today",
    viewDaily: "Daily",
    viewWeekly: "Weekly",
    viewMonthly: "Monthly",
    allActivitiesCompleted: "Well done! All activities for this period are complete.",
    editActivitySr: "Edit Activity",
    deleteActivitySr: "Delete Activity",
    addToCalendarSr: "Add to Calendar",
    todosCompleted: (params) => `${params.completed} / ${params.total} todos completed`,
    noDetailsAvailable: "No details available.",
    noTodosForThisActivity: "No todos for this activity.",
    recurrenceDailyText: "Daily",
    recurrenceWeeklyText: "Weekly",
    recurrenceMonthlyText: "Monthly",
    loginWelcomeMessage: "Log in to manage your activities.",
    loginUsernameLabel: "Username",
    loginPasswordLabel: "Password",
    loginUsernamePlaceholder: "Enter your username",
    loginPasswordPlaceholder: "Enter your password",
    loginButtonText: "Login",
    loginLoggingIn: "Logging in...",
    loginInvalidCredentials: "Invalid username or password.",
    loginErrorTitle: "Login Error",
    loginLockoutTitle: "Temporarily Locked Out",
    loginLockoutMessage: (params) => `Too many failed login attempts. Please try again in ${params.seconds} seconds.`,
    loginUsernameRequired: "Username is required.",
    loginPasswordRequired: "Password is required.",
    loginSecurityNotice: "This is a prototype. Do not use real credentials.",
    loginRedirecting: "Redirecting...",
    rememberMeLabel: "Keep me logged in for 30 days",
    showPassword: "Show password",
    hidePassword: "Hide password",
    changePasswordModalTitle: "Change Password",
    changePasswordModalDescription: "Enter your current password and a new password below.",
    currentPasswordLabel: "Current Password",
    newPasswordLabel: "New Password",
    confirmNewPasswordLabel: "Confirm New Password",
    currentPasswordPlaceholder: "Your current password",
    newPasswordPlaceholder: "Your new password",
    confirmNewPasswordPlaceholder: "Confirm your new password",
    updatePasswordButton: "Update Password",
    passwordUpdateSuccessTitle: "Password Updated",
    passwordUpdateSuccessDescription: "Your password has been successfully updated. (Prototype: Not actually changed)",
    passwordUpdateErrorIncorrectCurrent: "Incorrect current password.",
    passwordUpdateErrorNewPasswordRequired: "New password is required.",
    passwordUpdateErrorConfirmPasswordRequired: "Confirm new password is required.",
    passwordUpdateErrorPasswordsDoNotMatch: "New passwords do not match.",
    passwordUpdateErrorCurrentEqualsNew: "New password must be different from the current password.",
    passwordMinLength: (params) => `Password must be at least ${params.length} characters.`,
    toastCategoryAddedTitle: "Category Added",
    toastCategoryAddedDescription: (params) => `Category "${params.categoryName}" has been added.`,
    toastCategoryUpdatedTitle: "Category Updated",
    toastCategoryUpdatedDescription: (params) => `Category "${params.categoryName}" has been updated.`,
    toastCategoryDeletedTitle: "Category Deleted",
    toastCategoryDeletedDescription: (params) => `Category "${params.categoryName}" has been removed.`,
    toastActivityStartingSoonTitle: "Activity Starting Soon!",
    toastActivityStartingSoonDescription: (params) => `"${params.activityTitle}" is scheduled for ${params.activityTime}.`,
    toastActivityTomorrowTitle: "Activity Reminder: Tomorrow",
    toastActivityTomorrowDescription: (params) => `"${params.activityTitle}" is scheduled for tomorrow.`,
    toastActivityInTwoDaysTitle: "Activity Reminder: In 2 Days",
    toastActivityInTwoDaysDescription: (params) => `"${params.activityTitle}" is scheduled in 2 days.`,
    toastActivityInOneWeekTitle: "Activity Reminder: In 1 Week",
    toastActivityInOneWeekDescription: (params) => `"${params.activityTitle}" is scheduled in one week.`,
    loginSuccessNotificationTitle: "Login Successful",
    loginSuccessNotificationDescription: "Welcome back! You are now logged in.",
    toastAssigneeAddedTitle: "Assignee Added",
    toastAssigneeAddedDescription: (params) => `Assignee "${params.assigneeName}" has been added.`,
    toastAssigneeUpdatedTitle: "Assignee Updated",
    toastAssigneeUpdatedDescription: (params) => `Assignee "${params.assigneeName}" has been updated.`,
    toastAssigneeDeletedTitle: "Assignee Deleted",
    toastAssigneeDeletedDescription: (params) => `Assignee "${params.assigneeName}" has been removed.`,
    dashboardTitle: "Activity Dashboard",
    dashboardMainDescription: "Track your activity progress and view summaries.",
    dashboardChartView: "Chart View",
    dashboardListView: "List View",
    dashboardProductivityView: "Productivity",
    dashboardViewWeekly: "Last 7 Days",
    dashboardViewMonthly: "Current Month (by Week)",
    dashboardChartTotalActivities: "Total Activities",
    dashboardChartCompletedActivities: "Completed Activities",
    dashboardWeekLabel: "W",
    dashboardNoData: "No activity data available for the selected period.",
    dashboardListLast7Days: "Last 7 Days",
    dashboardListCurrentMonth: "Current Month",
    dashboardNoActivitiesForList: "No activities found for the selected period.",
    dashboardNotesLabel: "Notes",
    dashboardCategoryBreakdown: "Category Breakdown",
    dashboardCompletionStats: "Completion Statistics",
    dashboardActivityCountLabel: "Completed Activities",
    dashboardOverallCompletionRate: "Overall Completion Rate:",
    dashboardTotalActivitiesLabel: "Total Activities:",
    dashboardTotalCompletedLabel: "Total Completed:",
    dashboardNoDataForAnalysis: "Not enough data for analysis in this period.",
    historyPageTitle: "Activity History",
    historyPageDescription: "Recent actions performed during this session.",
    noHistoryYet: "No activity recorded in this session yet.",
    historyLogLogin: "Logged in.",
    historyLogLogout: "Logged out.",
    historyLogAddActivityPersonal: (params) => `Added Personal Activity: "${params.title}".`,
    historyLogAddActivityWork: (params) => `Added Work Activity: "${params.title}".`,
    historyLogUpdateActivityPersonal: (params) => `Updated Personal Activity: "${params.title}".`,
    historyLogUpdateActivityWork: (params) => `Updated Work Activity: "${params.title}".`,
    historyLogDeleteActivityPersonal: (params) => `Deleted Personal Activity: "${params.title}".`,
    historyLogDeleteActivityWork: (params) => `Deleted Work Activity: "${params.title}".`,
    historyLogToggleActivityCompletionPersonal: (params) => `Marked Personal Activity "${params.title}" as ${params.completed ? 'completed' : 'incomplete'}.`,
    historyLogToggleActivityCompletionWork: (params) => `Marked Work Activity "${params.title}" as ${params.completed ? 'completed' : 'incomplete'}.`,
    historyLogAddCategoryPersonal: (params) => `Added Personal Category: "${params.name}".`,
    historyLogAddCategoryWork: (params) => `Added Work Category: "${params.name}".`,
    historyLogAddCategoryAll: (params) => `Added Category (All Modes): "${params.name}".`,
    historyLogUpdateCategoryPersonal: (params) => `Updated Personal Category: "${params.oldName ? params.oldName + ' to ' : ''}${params.name}"${params.oldMode && params.oldMode !== 'personal' ? ` (mode changed from ${params.oldMode})` : ''}.`,
    historyLogUpdateCategoryWork: (params) => `Updated Work Category: "${params.oldName ? params.oldName + ' to ' : ''}${params.name}"${params.oldMode && params.oldMode !== 'work' ? ` (mode changed from ${params.oldMode})` : ''}.`,
    historyLogUpdateCategoryAll: (params) => `Updated Category (All Modes): "${params.oldName ? params.oldName + ' to ' : ''}${params.name}"${params.oldMode && params.oldMode !== 'all' ? ` (mode changed from ${params.oldMode})` : ''}.`,
    historyLogDeleteCategory: (params) => `Deleted Category: "${params.name}" (Mode: ${params.mode}).`,
    historyLogSwitchToPersonalMode: "Switched to Personal Mode.",
    historyLogSwitchToWorkMode: "Switched to Work Mode.",
    historyLogPasswordChange: "Password changed.",
    historyLogAddAssignee: (params) => `Added Assignee: "${params.name}".`,
    historyLogUpdateAssignee: (params) => `Updated Assignee: "${params.oldName ? params.oldName + ' to ' : ''}${params.name}".`,
    historyLogDeleteAssignee: (params) => `Deleted Assignee: "${params.name}".`,
    historyScopeAccount: "Account",
    historyScopePersonal: "Personal",
    historyScopeWork: "Work",
    historyScopeCategory: "Category",
    historyScopeAssignee: "Assignee",
    motivationalPhrases: [
      "The secret of getting ahead is getting started.",
      "Don't watch the clock; do what it does. Keep going.",
      "The only way to do great work is to love what you do.",
      "Believe you can and you're halfway there.",
      "Act as if what you do makes a difference. It does.",
      "Success is not final, failure is not fatal: It is the courage to continue that counts.",
      "Strive not to be a success, but rather to be of value.",
      "The future depends on what you do today.",
      "Well done is better than well said.",
      "You are never too old to set another goal or to dream a new dream."
    ],
    pomodoroTitle: "Pomodoro Timer",
    pomodoroStartWork: "Start Work (25 min)",
    pomodoroStartShortBreak: "Start Short Break (5 min)",
    pomodoroStartLongBreak: "Start Long Break (15 min)",
    pomodoroPause: "Pause",
    pomodoroResume: "Resume",
    pomodoroReset: "Reset",
    pomodoroWorkSession: "Work Session",
    pomodoroShortBreakSession: "Short Break",
    pomodoroLongBreakSession: "Long Break",
    pomodoroReadyToStart: "Ready to start?",
    pomodoroWorkSessionEnded: "Work Session Ended",
    pomodoroShortBreakEnded: "Short Break Ended",
    pomodoroLongBreakEnded: "Long Break Ended",
    pomodoroTakeABreakOrStartNext: "Time for a break or start the next session!",
    pomodoroFocusOnTask: "Focus on your task!",
    pomodoroShortRelaxation: "Time for a short relaxation.",
    pomodoroLongRelaxation: "Time for a longer rest.",
    pomodoroCyclesCompleted: (params) => `${params.cycles} work cycle(s) completed.`,
    pomodoroTakeAShortBreak: "Time for a short break!",
    pomodoroTakeALongBreak: "Time for a long break!",
    pomodoroBackToWork: "Time to get back to work!",
    pomodoroErrorTitle: "Pomodoro Error",
    pomodoroSWNotReady: "Service Worker for Pomodoro not ready. Please wait or reload.",
    pomodoroInitializing: "Initializing...",
  },
  es: {
    addActivity: "Añadir Actividad",
    manageCategories: "Categorías",
    language: "Idioma",
    english: "Inglés",
    spanish: "Español",
    french: "Français",
    theme: "Tema",
    lightTheme: "Claro",
    darkTheme: "Oscuro",
    systemTheme: "Sistema",
    moreOptions: "Más opciones",
    moreOptionsDesktop: "Configuración",
    personalMode: "Personal",
    workMode: "Trabajo",
    switchToPersonalMode: "Cambiar a Modo Personal",
    switchToWorkMode: "Cambiar a Modo Trabajo",
    logout: "Cerrar Sesión",
    changePassword: "Cambiar Contraseña",
    dashboard: "Dashboard",
    notificationsTitle: "Notificaciones",
    noNotificationsYet: "No hay notificaciones nuevas.",
    notificationUnread: "sin leer",
    markAllAsRead: "Marcar todas como leídas",
    clearAllNotifications: "Limpiar todas",
    notificationBellLabel: "Ver notificaciones",
    viewHistory: "Ver Historial",
    enableSystemNotifications: "Activar Notificaciones del Sistema",
    systemNotificationsEnabled: "Notificaciones del Sistema Activadas",
    systemNotificationsBlocked: "Notificaciones del Sistema Bloqueadas",
    enableSystemNotificationsDescription: "Para activar las notificaciones, revisa la configuración de tu navegador y sistema.",
    systemNotificationsNowActive: "¡Las notificaciones del sistema ahora están activas!",
    systemNotificationsUserDenied: "Has denegado los permisos de notificación. Por favor, cámbialo en la configuración de tu navegador si deseas activarlas.",
    systemNotificationsNotYetEnabled: "Notificaciones del sistema aún no activadas.",
    systemNotificationsDismissed: "Puedes activar las notificaciones más tarde desde el menú de opciones.",
    manageAssignees: "Gestionar Asignados",
    pomodoroTimerMenuLabel: "Temporizador Pomodoro",
    backToCalendar: "Volver al Calendario",
    addCategory: "Añadir Categoría",
    editCategory: "Editar Categoría",
    addNewCategory: "Añadir Nueva Categoría",
    updateCategoryDetails: "Actualiza los detalles de tu categoría.",
    createCategoryDescription: "Crea una nueva categoría para tus actividades.",
    categoryName: "Nombre de la Categoría",
    iconName: "Nombre del Icono (de Lucide)",
    iconNameDescriptionLink: "Introduce un nombre de icono en PascalCase de <a>lucide.dev/icons</a>.",
    categoryMode: "Modo de Categoría",
    modePersonal: "Personal",
    modeWork: "Trabajo",
    modeAll: "Todos los Modos",
    saveChanges: "Guardar Cambios",
    cancel: "Cancelar",
    existingCategories: "Categorías Existentes",
    viewEditManageCategories: "Ver, editar y gestionar tus categorías actuales.",
    delete: "Eliminar",
    confirmDelete: "¿Estás seguro?",
    confirmDeleteCategoryDescription: (params) => `Esta acción eliminará la categoría "${params.categoryName}". Las actividades que usan esta categoría ya no estarán asociadas a ella. Esto no se puede deshacer.`,
    categoriesCount: (params) => `Tienes ${params.count} categorí${params.count === 1 ? 'a' : 'as'}.`,
    noCategoriesYet: "Aún no has añadido categorías. Usa el formulario para añadir tu primera categoría.",
    addNewAssignee: "Añadir Nuevo Asignado",
    editAssignee: "Editar Asignado",
    assigneeNameLabel: "Nombre del Asignado",
    assigneeNamePlaceholder: "Ej: Juan Pérez, Compañero",
    createAssigneeDescription: "Crea un nuevo asignado para tus tareas.",
    updateAssigneeDetails: "Actualiza los detalles de este asignado.",
    existingAssignees: "Asignados Existentes",
    viewEditManageAssignees: "Ver, editar y gestionar tus asignados.",
    confirmDeleteAssigneeDescription: (params) => `Esta acción eliminará al asignado "${params.assigneeName}". Las actividades asignadas a esta persona quedarán sin asignar. Esto no se puede deshacer.`,
    assigneesCount: (params) => `Tienes ${params.count} asignado${params.count === 1 ? '' : 's'}.`,
    noAssigneesYet: "Aún no has añadido asignados. Usa el formulario para añadir tu primer asignado.",
    editActivityTitle: "Editar Actividad",
    addActivityTitle: "Añadir Nueva Actividad",
    editActivityDescription: (params) => `Actualiza los detalles de tu actividad. Fecha por defecto: ${params.formattedInitialDate}.`,
    addActivityDescription: (params) => `Completa los detalles de tu nueva actividad. Fecha por defecto: ${params.formattedInitialDate}.`,
    activityTitleLabel: "Título de la Actividad",
    categoryLabel: "Categoría",
    selectCategoryPlaceholder: "Selecciona una categoría",
    loadingCategoriesPlaceholder: "Cargando categorías...",
    activityDateLabel: "Fecha de Inicio / Fecha",
    pickADate: "Elige una fecha",
    activityTimeLabel: "Hora de la Actividad (HH:MM)",
    activityTimeDescription24Hour: "Usa el formato de 24 horas (ej: 14:30).",
    activityNotesLabel: "Notas",
    activityNotesPlaceholder: "Añade detalles adicionales o enlaces aquí...",
    todosLabel: "Tareas",
    addTodo: "Añadir Tarea",
    newTodoPlaceholder: "Nueva tarea",
    toastActivityUpdatedTitle: "Actividad Actualizada",
    toastActivityUpdatedDescription: "Tu actividad ha sido actualizada exitosamente.",
    toastActivityAddedTitle: "Actividad Añadida",
    toastActivityAddedDescription: "Tu nueva actividad ha sido añadida exitosamente.",
    recurrenceLabel: "Recurrencia",
    recurrenceTypeLabel: "Se repite",
    recurrenceNone: "Nunca",
    recurrenceDaily: "Diariamente",
    recurrenceWeekly: "Semanalmente",
    recurrenceMonthly: "Mensualmente",
    recurrenceEndDateLabel: "Fecha de Fin",
    recurrenceNoEndDate: "Sin fecha de fin",
    recurrencePickEndDate: "Elegir fecha de fin",
    recurrenceDaysOfWeekLabel: "En los días",
    recurrenceDayOfMonthLabel: "Día del Mes",
    recurrenceDayOfMonthPlaceholder: "ej: 15",
    recurrenceClearEndDate: "Quitar fecha de fin",
    daySun: "Dom",
    dayMon: "Lun",
    dayTue: "Mar",
    dayWed: "Mié",
    dayThu: "Jue",
    dayFri: "Vie",
    daySat: "Sáb",
    invalidTimeFormat24Hour: "Formato de hora inválido. Usa HH:MM (24 horas).",
    responsiblePersonLabel: "Persona Responsable",
    selectResponsiblePersonPlaceholder: "Selecciona un asignado",
    unassigned: "Sin asignar",
    activitiesForDate: (params) => `Actividades para ${params.date}`,
    activitiesForWeek: (params) => `Actividades para la semana: ${params.startDate} - ${params.endDate}`,
    activitiesForMonth: (params) => `Actividades para ${params.month}`,
    loadingDate: "Cargando fecha...",
    noActivitiesForDay: "No hay actividades programadas para este día.",
    noActivitiesForPeriod: "No hay actividades programadas para este período.",
    selectDateToSeeActivities: "Selecciona una fecha para ver actividades.",
    confirmDeleteActivityTitle: "¿Estás seguro?",
    confirmDeleteActivityDescription: (params) => `Esta acción no se puede deshacer. Esto eliminará permanentemente la actividad "${params.activityTitle}" y todas sus tareas asociadas. Si es una actividad recurrente, se eliminará toda la serie.`,
    toastActivityDeletedTitle: "Actividad Eliminada",
    toastActivityDeletedDescription: (params) => `Se ha eliminado "${params.activityTitle}".`,
    todayButton: "Hoy",
    viewDaily: "Diario",
    viewWeekly: "Semanal",
    viewMonthly: "Mensual",
    allActivitiesCompleted: "¡Bien hecho! Todas las actividades de este periodo están completas.",
    editActivitySr: "Editar Actividad",
    deleteActivitySr: "Eliminar Actividad",
    addToCalendarSr: "Añadir al Calendario",
    todosCompleted: (params) => `${params.completed} / ${params.total} tareas completadas`,
    noDetailsAvailable: "No hay detalles disponibles.",
    noTodosForThisActivity: "No hay tareas para esta actividad.",
    recurrenceDailyText: "Diariamente",
    recurrenceWeeklyText: "Semanalmente",
    recurrenceMonthlyText: "Mensualmente",
    loginWelcomeMessage: "Inicia sesión para gestionar tus actividades.",
    loginUsernameLabel: "Usuario",
    loginPasswordLabel: "Contraseña",
    loginUsernamePlaceholder: "Introduce tu usuario",
    loginPasswordPlaceholder: "Introduce tu contraseña",
    loginButtonText: "Iniciar Sesión",
    loginLoggingIn: "Iniciando sesión...",
    loginInvalidCredentials: "Usuario o contraseña incorrectos.",
    loginErrorTitle: "Error de Inicio de Sesión",
    loginLockoutTitle: "Bloqueado Temporalmente",
    loginLockoutMessage: (params) => `Demasiados intentos fallidos. Por favor, inténtalo de nuevo en ${params.seconds} segundos.`,
    loginUsernameRequired: "El nombre de usuario es obligatorio.",
    loginPasswordRequired: "La contraseña es obligatoria.",
    loginSecurityNotice: "Esto es un prototipo. No uses credenciales reales.",
    loginRedirecting: "Redirigiendo...",
    rememberMeLabel: "Mantenerme conectado por 30 días",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    changePasswordModalTitle: "Cambiar Contraseña",
    changePasswordModalDescription: "Introduce tu contraseña actual y una nueva contraseña a continuación.",
    currentPasswordLabel: "Contraseña Actual",
    newPasswordLabel: "Nueva Contraseña",
    confirmNewPasswordLabel: "Confirmar Nueva Contraseña",
    currentPasswordPlaceholder: "Tu contraseña actual",
    newPasswordPlaceholder: "Tu nueva contraseña",
    confirmNewPasswordPlaceholder: "Confirma tu nueva contraseña",
    updatePasswordButton: "Actualizar Contraseña",
    passwordUpdateSuccessTitle: "Contraseña Actualizada",
    passwordUpdateSuccessDescription: "Tu contraseña ha sido actualizada exitosamente. (Prototipo: No cambiada realmente)",
    passwordUpdateErrorIncorrectCurrent: "Contraseña actual incorrecta.",
    passwordUpdateErrorNewPasswordRequired: "La nueva contraseña es obligatoria.",
    passwordUpdateErrorConfirmPasswordRequired: "Confirmar la nueva contraseña es obligatorio.",
    passwordUpdateErrorPasswordsDoNotMatch: "Las nuevas contraseñas no coinciden.",
    passwordUpdateErrorCurrentEqualsNew: "La nueva contraseña debe ser diferente a la actual.",
    passwordMinLength: (params) => `La contraseña debe tener al menos ${params.length} caracteres.`,
    toastCategoryAddedTitle: "Categoría Añadida",
    toastCategoryAddedDescription: (params) => `La categoría "${params.categoryName}" ha sido añadida.`,
    toastCategoryUpdatedTitle: "Categoría Actualizada",
    toastCategoryUpdatedDescription: (params) => `La categoría "${params.categoryName}" ha sido actualizada.`,
    toastCategoryDeletedTitle: "Categoría Eliminada",
    toastCategoryDeletedDescription: (params) => `La categoría "${params.categoryName}" ha sido eliminada.`,
    toastActivityStartingSoonTitle: "¡Actividad Comienza Pronto!",
    toastActivityStartingSoonDescription: (params) => `"${params.activityTitle}" está programada para las ${params.activityTime}.`,
    toastActivityTomorrowTitle: "Recordatorio: Mañana",
    toastActivityTomorrowDescription: (params) => `"${params.activityTitle}" está programada para mañana.`,
    toastActivityInTwoDaysTitle: "Recordatorio: En 2 Días",
    toastActivityInTwoDaysDescription: (params) => `"${params.activityTitle}" está programada en 2 días.`,
    toastActivityInOneWeekTitle: "Recordatorio: En 1 Semana",
    toastActivityInOneWeekDescription: (params) => `"${params.activityTitle}" está programada en una semana.`,
    loginSuccessNotificationTitle: "Inicio de Sesión Exitoso",
    loginSuccessNotificationDescription: "¡Bienvenido de nuevo! Has iniciado sesión.",
    toastAssigneeAddedTitle: "Asignado Añadido",
    toastAssigneeAddedDescription: (params) => `El asignado "${params.assigneeName}" ha sido añadido.`,
    toastAssigneeUpdatedTitle: "Asignado Actualizado",
    toastAssigneeUpdatedDescription: (params) => `El asignado "${params.assigneeName}" ha sido actualizado.`,
    toastAssigneeDeletedTitle: "Asignado Eliminado",
    toastAssigneeDeletedDescription: (params) => `El asignado "${params.assigneeName}" ha sido eliminado.`,
    dashboardTitle: "Panel de Actividades",
    dashboardMainDescription: "Sigue el progreso de tus actividades y visualiza resúmenes.",
    dashboardChartView: "Vista de Gráfico",
    dashboardListView: "Vista de Lista",
    dashboardProductivityView: "Productividad",
    dashboardViewWeekly: "Últimos 7 Días",
    dashboardViewMonthly: "Mes Actual (por Semana)",
    dashboardChartTotalActivities: "Actividades Totales",
    dashboardChartCompletedActivities: "Actividades Completadas",
    dashboardWeekLabel: "S",
    dashboardNoData: "No hay datos de actividad disponibles para el período seleccionado.",
    dashboardListLast7Days: "Últimos 7 Días",
    dashboardListCurrentMonth: "Mes Actual",
    dashboardNoActivitiesForList: "No se encontraron actividades para el período seleccionado.",
    dashboardNotesLabel: "Notas",
    dashboardCategoryBreakdown: "Desglose por Categoría",
    dashboardCompletionStats: "Estadísticas de Finalización",
    dashboardActivityCountLabel: "Actividades Completadas",
    dashboardOverallCompletionRate: "Tasa de Finalización General:",
    dashboardTotalActivitiesLabel: "Actividades Totales:",
    dashboardTotalCompletedLabel: "Total Completadas:",
    dashboardNoDataForAnalysis: "No hay suficientes datos para el análisis en este período.",
    historyPageTitle: "Historial de Actividad",
    historyPageDescription: "Acciones recientes realizadas durante esta sesión.",
    noHistoryYet: "Aún no se ha registrado actividad en esta sesión.",
    historyLogLogin: "Sesión iniciada.",
    historyLogLogout: "Sesión cerrada.",
    historyLogAddActivityPersonal: (params) => `Actividad Personal añadida: "${params.title}".`,
    historyLogAddActivityWork: (params) => `Actividad de Trabajo añadida: "${params.title}".`,
    historyLogUpdateActivityPersonal: (params) => `Actividad Personal actualizada: "${params.title}".`,
    historyLogUpdateActivityWork: (params) => `Actividad de Trabajo actualizada: "${params.title}".`,
    historyLogDeleteActivityPersonal: (params) => `Actividad Personal eliminada: "${params.title}".`,
    historyLogDeleteActivityWork: (params) => `Actividad de Trabajo eliminada: "${params.title}".`,
    historyLogToggleActivityCompletionPersonal: (params) => `Actividad Personal "${params.title}" marcada como ${params.completed ? 'completada' : 'incompleta'}.`,
    historyLogToggleActivityCompletionWork: (params) => `Actividad de Trabajo "${params.title}" marcada como ${params.completed ? 'completada' : 'incompleta'}.`,
    historyLogAddCategoryPersonal: (params) => `Categoría Personal añadida: "${params.name}".`,
    historyLogAddCategoryWork: (params) => `Categoría de Trabajo añadida: "${params.name}".`,
    historyLogAddCategoryAll: (params) => `Categoría (Todos los Modos) añadida: "${params.name}".`,
    historyLogUpdateCategoryPersonal: (params) => `Categoría Personal actualizada: "${params.oldName ? params.oldName + ' a ' : ''}${params.name}"${params.oldMode && params.oldMode !== 'personal' ? ` (modo cambiado de ${params.oldMode})` : ''}.`,
    historyLogUpdateCategoryWork: (params) => `Categoría de Trabajo actualizada: "${params.oldName ? params.oldName + ' a ' : ''}${params.name}"${params.oldMode && params.oldMode !== 'work' ? ` (modo cambiado de ${params.oldMode})` : ''}.`,
    historyLogUpdateCategoryAll: (params) => `Categoría (Todos los Modos) actualizada: "${params.oldName ? params.oldName + ' a ' : ''}${params.name}"${params.oldMode && params.oldMode !== 'all' ? ` (modo cambiado de ${params.oldMode})` : ''}.`,
    historyLogDeleteCategory: (params) => `Categoría eliminada: "${params.name}" (Modo: ${params.mode}).`,
    historyLogSwitchToPersonalMode: "Cambiado a Modo Personal.",
    historyLogSwitchToWorkMode: "Cambiado a Modo Trabajo.",
    historyLogPasswordChange: "Contraseña cambiada.",
    historyLogAddAssignee: (params) => `Asignado añadido: "${params.name}".`,
    historyLogUpdateAssignee: (params) => `Asignado actualizado: "${params.oldName ? params.oldName + ' a ' : ''}${params.name}".`,
    historyLogDeleteAssignee: (params) => `Asignado eliminado: "${params.name}".`,
    historyScopeAccount: "Cuenta",
    historyScopePersonal: "Personal",
    historyScopeWork: "Trabajo",
    historyScopeCategory: "Categoría",
    historyScopeAssignee: "Asignado",
    motivationalPhrases: [
      "El secreto para salir adelante es empezar.",
      "No mires el reloj; haz lo que él hace. Sigue adelante.",
      "La única forma de hacer un gran trabajo es amar lo que haces.",
      "Cree que puedes y estarás a medio camino.",
      "Actúa como si lo que haces marca la diferencia. Lo hace.",
      "El éxito no es definitivo, el fracaso no es fatal: Lo que cuenta es el coraje para continuar.",
      "Esfuérzate no por ser un éxito, sino por ser de valor.",
      "El futuro depende de lo que hagas hoy.",
      "Bien hecho es mejor que bien dicho.",
      "Nunca eres demasiado viejo para establecer otra meta o para soñar un nuevo sueño."
    ],
    pomodoroTitle: "Temporizador Pomodoro",
    pomodoroStartWork: "Iniciar Trabajo (25 min)",
    pomodoroStartShortBreak: "Iniciar Descanso Corto (5 min)",
    pomodoroStartLongBreak: "Iniciar Descanso Largo (15 min)",
    pomodoroPause: "Pausar",
    pomodoroResume: "Reanudar",
    pomodoroReset: "Reiniciar",
    pomodoroWorkSession: "Sesión de Trabajo",
    pomodoroShortBreakSession: "Descanso Corto",
    pomodoroLongBreakSession: "Descanso Largo",
    pomodoroReadyToStart: "¿Listo para empezar?",
    pomodoroWorkSessionEnded: "Sesión de Trabajo Terminada",
    pomodoroShortBreakEnded: "Descanso Corto Terminado",
    pomodoroLongBreakEnded: "Descanso Largo Terminado",
    pomodoroTakeABreakOrStartNext: "¡Tiempo de un descanso o de iniciar la siguiente sesión!",
    pomodoroFocusOnTask: "¡Concéntrate en tu tarea!",
    pomodoroShortRelaxation: "Tiempo para una breve relajación.",
    pomodoroLongRelaxation: "Tiempo para un descanso más largo.",
    pomodoroCyclesCompleted: (params) => `${params.cycles} ciclo(s) de trabajo completado(s).`,
    pomodoroTakeAShortBreak: "¡Tiempo para un descanso corto!",
    pomodoroTakeALongBreak: "¡Tiempo para un descanso largo!",
    pomodoroBackToWork: "¡Hora de volver al trabajo!",
    pomodoroErrorTitle: "Error de Pomodoro",
    pomodoroSWNotReady: "Service Worker para Pomodoro no listo. Espera o recarga.",
    pomodoroInitializing: "Inicializando...",
  },
  fr: {
    addActivity: "Ajouter une activité",
    manageCategories: "Catégories",
    language: "Langue",
    english: "Anglais",
    spanish: "Espagnol",
    french: "Français",
    theme: "Thème",
    lightTheme: "Clair",
    darkTheme: "Sombre",
    systemTheme: "Système",
    moreOptions: "Plus d'options",
    moreOptionsDesktop: "Paramètres",
    personalMode: "Personnel",
    workMode: "Travail",
    switchToPersonalMode: "Passer en mode Personnel",
    switchToWorkMode: "Passer en mode Travail",
    logout: "Déconnexion",
    changePassword: "Changer de mot de passe",
    dashboard: "Tableau de bord",
    notificationsTitle: "Notifications",
    noNotificationsYet: "Aucune nouvelle notification.",
    notificationUnread: "non lue(s)",
    markAllAsRead: "Marquer tout comme lu",
    clearAllNotifications: "Tout effacer",
    notificationBellLabel: "Voir les notifications",
    viewHistory: "Voir l'historique",
    enableSystemNotifications: "Activer les notifications système",
    systemNotificationsEnabled: "Notifications système activées",
    systemNotificationsBlocked: "Notifications système bloquées",
    enableSystemNotificationsDescription: "Pour activer les notifications, veuillez vérifier les paramètres de votre navigateur et de votre système.",
    systemNotificationsNowActive: "Les notifications système sont maintenant actives !",
    systemNotificationsUserDenied: "Vous avez refusé les autorisations de notification. Veuillez modifier cela dans les paramètres de votre navigateur si vous souhaitez les activer.",
    systemNotificationsNotYetEnabled: "Notifications système pas encore activées.",
    systemNotificationsDismissed: "Vous pourrez activer les notifications plus tard depuis le menu des options.",
    manageAssignees: "Gérer les Personnes Assignées",
    pomodoroTimerMenuLabel: "Minuteur Pomodoro",
    backToCalendar: "Retour au calendrier",
    addCategory: "Ajouter une catégorie",
    editCategory: "Modifier la catégorie",
    addNewCategory: "Ajouter une nouvelle catégorie",
    updateCategoryDetails: "Mettez à jour les détails de votre catégorie.",
    createCategoryDescription: "Créez une nouvelle catégorie pour vos activités.",
    categoryName: "Nom de la catégorie",
    iconName: "Nom de l'icône (de Lucide)",
    iconNameDescriptionLink: "Entrez un nom d'icône en PascalCase depuis <a>lucide.dev/icons</a>.",
    categoryMode: "Mode de catégorie",
    modePersonal: "Personnel",
    modeWork: "Travail",
    modeAll: "Tous les modes",
    saveChanges: "Enregistrer les modifications",
    cancel: "Annuler",
    existingCategories: "Catégories existantes",
    viewEditManageCategories: "Visualisez, modifiez et gérez vos catégories actuelles.",
    delete: "Supprimer",
    confirmDelete: "Êtes-vous sûr ?",
    confirmDeleteCategoryDescription: (params) => `Cette action supprimera la catégorie "${params.categoryName}". Les activités utilisant cette catégorie ne lui seront plus associées. Cette action est irréversible.`,
    categoriesCount: (params) => `Vous avez ${params.count} catégorie${params.count === 1 ? '' : 's'}.`,
    noCategoriesYet: "Aucune catégorie ajoutée pour le moment. Utilisez le formulaire pour ajouter votre première catégorie.",
    addNewAssignee: "Ajouter une Nouvelle Personne Assignée",
    editAssignee: "Modifier la Personne Assignée",
    assigneeNameLabel: "Nom de la Personne Assignée",
    assigneeNamePlaceholder: "Ex : Jean Dupont, Partenaire",
    createAssigneeDescription: "Créez une nouvelle personne assignée pour vos tâches.",
    updateAssigneeDetails: "Mettez à jour les détails de cette personne assignée.",
    existingAssignees: "Personnes Assignées Existantes",
    viewEditManageAssignees: "Visualisez, modifiez et gérez vos personnes assignées.",
    confirmDeleteAssigneeDescription: (params) => `Cette action supprimera la personne assignée "${params.assigneeName}". Les activités qui lui sont assignées deviendront non assignées. Cette action est irréversible.`,
    assigneesCount: (params) => `Vous avez ${params.count} personne${params.count === 1 ? '' : 's'} assignée${params.count === 1 ? '' : 's'}.`,
    noAssigneesYet: "Aucune personne assignée pour le moment. Utilisez le formulaire pour en ajouter.",
    editActivityTitle: "Modifier l'activité",
    addActivityTitle: "Ajouter une nouvelle activité",
    editActivityDescription: (params) => `Mettez à jour les détails de votre activité. Date par défaut : ${params.formattedInitialDate}.`,
    addActivityDescription: (params) => `Remplissez les détails de votre nouvelle activité. Date par défaut : ${params.formattedInitialDate}.`,
    activityTitleLabel: "Titre de l'activité",
    categoryLabel: "Catégorie",
    selectCategoryPlaceholder: "Sélectionnez une catégorie",
    loadingCategoriesPlaceholder: "Chargement des catégories...",
    activityDateLabel: "Date de début / Date",
    pickADate: "Choisissez une date",
    activityTimeLabel: "Heure de l'activité (HH:MM)",
    activityTimeDescription24Hour: "Utilisez le format 24 heures (ex: 14:30).",
    activityNotesLabel: "Notes",
    activityNotesPlaceholder: "Ajoutez des détails supplémentaires ou des liens ici...",
    todosLabel: "Tâches",
    addTodo: "Ajouter une tâche",
    newTodoPlaceholder: "Nouvelle tâche",
    toastActivityUpdatedTitle: "Activité mise à jour",
    toastActivityUpdatedDescription: "Votre activité a été mise à jour avec succès.",
    toastActivityAddedTitle: "Activité ajoutée",
    toastActivityAddedDescription: "Votre nouvelle activité a été ajoutée avec succès.",
    recurrenceLabel: "Récurrence",
    recurrenceTypeLabel: "Répéter",
    recurrenceNone: "Jamais",
    recurrenceDaily: "Quotidiennement",
    recurrenceWeekly: "Hebdomadairement",
    recurrenceMonthly: "Mensuellement",
    recurrenceEndDateLabel: "Date de fin",
    recurrenceNoEndDate: "Pas de date de fin",
    recurrencePickEndDate: "Choisir une date de fin",
    recurrenceDaysOfWeekLabel: "Les jours",
    recurrenceDayOfMonthLabel: "Jour du mois",
    recurrenceDayOfMonthPlaceholder: "ex : 15",
    recurrenceClearEndDate: "Effacer la date de fin",
    daySun: "Dim",
    dayMon: "Lun",
    dayTue: "Mar",
    dayWed: "Mer",
    dayThu: "Jeu",
    dayFri: "Ven",
    daySat: "Sam",
    invalidTimeFormat24Hour: "Format d'heure invalide. Utilisez HH:MM (24 heures).",
    responsiblePersonLabel: "Personne Responsable",
    selectResponsiblePersonPlaceholder: "Sélectionnez une personne",
    unassigned: "Non assigné",
    activitiesForDate: (params) => `Activités pour ${params.date}`,
    activitiesForWeek: (params) => `Activités pour la semaine : ${params.startDate} - ${params.endDate}`,
    activitiesForMonth: (params) => `Activités pour ${params.month}`,
    loadingDate: "Chargement de la date...",
    noActivitiesForDay: "Aucune activité prévue pour ce jour.",
    noActivitiesForPeriod: "Aucune activité prévue pour cette période.",
    selectDateToSeeActivities: "Sélectionnez une date pour voir les activités.",
    confirmDeleteActivityTitle: "Êtes-vous sûr ?",
    confirmDeleteActivityDescription: (params) => `Cette action est irréversible. Cela supprimera définitivement l'activité "${params.activityTitle}" et toutes ses tâches associées. S'il s'agit d'une activité récurrente, toute la série sera supprimée.`,
    toastActivityDeletedTitle: "Activité supprimée",
    toastActivityDeletedDescription: (params) => `"${params.activityTitle}" a été supprimée.`,
    todayButton: "Aujourd'hui",
    viewDaily: "Journalier",
    viewWeekly: "Hebdomadaire",
    viewMonthly: "Mensuel",
    allActivitiesCompleted: "Bien joué ! Toutes les activités pour cette période sont terminées.",
    editActivitySr: "Modifier l'activité",
    deleteActivitySr: "Supprimer l'activité",
    addToCalendarSr: "Ajouter au calendrier",
    todosCompleted: (params) => `${params.completed} / ${params.total} tâches terminées`,
    noDetailsAvailable: "Aucun détail disponible.",
    noTodosForThisActivity: "Aucune tâche pour cette activité.",
    recurrenceDailyText: "Quotidiennement",
    recurrenceWeeklyText: "Hebdomadairement",
    recurrenceMonthlyText: "Mensuellement",
    loginWelcomeMessage: "Connectez-vous pour gérer vos activités.",
    loginUsernameLabel: "Nom d'utilisateur",
    loginPasswordLabel: "Mot de passe",
    loginUsernamePlaceholder: "Entrez votre nom d'utilisateur",
    loginPasswordPlaceholder: "Entrez votre mot de passe",
    loginButtonText: "Connexion",
    loginLoggingIn: "Connexion en cours...",
    loginInvalidCredentials: "Nom d'utilisateur ou mot de passe incorrect.",
    loginErrorTitle: "Erreur de connexion",
    loginLockoutTitle: "Temporairement verrouillé",
    loginLockoutMessage: (params) => `Trop de tentatives de connexion échouées. Veuillez réessayer dans ${params.seconds} secondes.`,
    loginUsernameRequired: "Le nom d'utilisateur est requis.",
    loginPasswordRequired: "Le mot de passe est requis.",
    loginSecurityNotice: "Ceci est un prototype. N'utilisez pas de vrais identifiants.",
    loginRedirecting: "Redirection...",
    rememberMeLabel: "Rester connecté pendant 30 jours",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    changePasswordModalTitle: "Changer de mot de passe",
    changePasswordModalDescription: "Entrez votre mot de passe actuel et un nouveau mot de passe ci-dessous.",
    currentPasswordLabel: "Mot de passe actuel",
    newPasswordLabel: "Nouveau mot de passe",
    confirmNewPasswordLabel: "Confirmer le nouveau mot de passe",
    currentPasswordPlaceholder: "Votre mot de passe actuel",
    newPasswordPlaceholder: "Votre nouveau mot de passe",
    confirmNewPasswordPlaceholder: "Confirmez votre nouveau mot de passe",
    updatePasswordButton: "Mettre à jour le mot de passe",
    passwordUpdateSuccessTitle: "Mot de passe mis à jour",
    passwordUpdateSuccessDescription: "Votre mot de passe a été mis à jour avec succès. (Prototype : non réellement changé)",
    passwordUpdateErrorIncorrectCurrent: "Mot de passe actuel incorrect.",
    passwordUpdateErrorNewPasswordRequired: "Le nouveau mot de passe est requis.",
    passwordUpdateErrorConfirmPasswordRequired: "La confirmation du nouveau mot de passe est requise.",
    passwordUpdateErrorPasswordsDoNotMatch: "Les nouveaux mots de passe ne correspondent pas.",
    passwordUpdateErrorCurrentEqualsNew: "Le nouveau mot de passe doit être différent du mot de passe actuel.",
    passwordMinLength: (params) => `Le mot de passe doit comporter au moins ${params.length} caractères.`,
    toastCategoryAddedTitle: "Catégorie ajoutée",
    toastCategoryAddedDescription: (params) => `La catégorie "${params.categoryName}" a été ajoutée.`,
    toastCategoryUpdatedTitle: "Catégorie mise à jour",
    toastCategoryUpdatedDescription: (params) => `La catégorie "${params.categoryName}" a été mise à jour.`,
    toastCategoryDeletedTitle: "Catégorie supprimée",
    toastCategoryDeletedDescription: (params) => `La catégorie "${params.categoryName}" a été supprimée.`,
    toastActivityStartingSoonTitle: "Activité commençant bientôt !",
    toastActivityStartingSoonDescription: (params) => `"${params.activityTitle}" est prévue pour ${params.activityTime}.`,
    toastActivityTomorrowTitle: "Rappel d'activité : Demain",
    toastActivityTomorrowDescription: (params) => `"${params.activityTitle}" est prévue pour demain.`,
    toastActivityInTwoDaysTitle: "Rappel d'activité : Dans 2 jours",
    toastActivityInTwoDaysDescription: (params) => `"${params.activityTitle}" est prévue dans 2 jours.`,
    toastActivityInOneWeekTitle: "Rappel d'activité : Dans 1 semaine",
    toastActivityInOneWeekDescription: (params) => `"${params.activityTitle}" est prévue dans une semaine.`,
    loginSuccessNotificationTitle: "Connexion réussie",
    loginSuccessNotificationDescription: "Bienvenue ! Vous êtes maintenant connecté.",
    toastAssigneeAddedTitle: "Personne Assignée Ajoutée",
    toastAssigneeAddedDescription: (params) => `La personne "${params.assigneeName}" a été ajoutée.`,
    toastAssigneeUpdatedTitle: "Personne Assignée Mise à Jour",
    toastAssigneeUpdatedDescription: (params) => `La personne "${params.assigneeName}" a été mise à jour.`,
    toastAssigneeDeletedTitle: "Personne Assignée Supprimée",
    toastAssigneeDeletedDescription: (params) => `La personne "${params.assigneeName}" a été supprimée.`,
    dashboardTitle: "Tableau de bord des activités",
    dashboardMainDescription: "Suivez la progression de vos activités et consultez des résumés.",
    dashboardChartView: "Vue graphique",
    dashboardListView: "Vue liste",
    dashboardProductivityView: "Productivité",
    dashboardViewWeekly: "7 derniers jours",
    dashboardViewMonthly: "Mois en cours (par semaine)",
    dashboardChartTotalActivities: "Total des activités",
    dashboardChartCompletedActivities: "Activités terminées",
    dashboardWeekLabel: "S",
    dashboardNoData: "Aucune donnée d'activité disponible pour la période sélectionnée.",
    dashboardListLast7Days: "7 derniers jours",
    dashboardListCurrentMonth: "Mois en cours",
    dashboardNoActivitiesForList: "Aucune activité trouvée pour la période sélectionnée.",
    dashboardNotesLabel: "Notes",
    dashboardCategoryBreakdown: "Répartition par catégorie",
    dashboardCompletionStats: "Statistiques d'achèvement",
    dashboardActivityCountLabel: "Activités terminées",
    dashboardOverallCompletionRate: "Taux d'achèvement global:",
    dashboardTotalActivitiesLabel: "Activités totales:",
    dashboardTotalCompletedLabel: "Total terminées:",
    dashboardNoDataForAnalysis: "Pas assez de données pour l'analyse sur cette période.",
    historyPageTitle: "Historique des activités",
    historyPageDescription: "Actions récentes effectuées pendant cette session.",
    noHistoryYet: "Aucune activité enregistrée dans cette session pour le moment.",
    historyLogLogin: "Connecté.",
    historyLogLogout: "Déconnecté.",
    historyLogAddActivityPersonal: (params) => `Activité personnelle ajoutée : "${params.title}".`,
    historyLogAddActivityWork: (params) => `Activité professionnelle ajoutée : "${params.title}".`,
    historyLogUpdateActivityPersonal: (params) => `Activité personnelle mise à jour : "${params.title}".`,
    historyLogUpdateActivityWork: (params) => `Activité professionnelle mise à jour : "${params.title}".`,
    historyLogDeleteActivityPersonal: (params) => `Activité personnelle supprimée : "${params.title}".`,
    historyLogDeleteActivityWork: (params) => `Activité professionnelle supprimée : "${params.title}".`,
    historyLogToggleActivityCompletionPersonal: (params) => `Activité personnelle "${params.title}" marquée comme ${params.completed ? 'terminée' : 'non terminée'}.`,
    historyLogToggleActivityCompletionWork: (params) => `Activité professionnelle "${params.title}" marquée comme ${params.completed ? 'terminée' : 'non terminée'}.`,
    historyLogAddCategoryPersonal: (params) => `Catégorie personnelle ajoutée : "${params.name}".`,
    historyLogAddCategoryWork: (params) => `Catégorie professionnelle ajoutée : "${params.name}".`,
    historyLogAddCategoryAll: (params) => `Catégorie (Tous modes) ajoutée : "${params.name}".`,
    historyLogUpdateCategoryPersonal: (params) => `Catégorie personnelle mise à jour : "${params.oldName ? params.oldName + ' à ' : ''}${params.name}"${params.oldMode && params.oldMode !== 'personal' ? ` (mode changé de ${params.oldMode})` : ''}.`,
    historyLogUpdateCategoryWork: (params) => `Catégorie professionnelle mise à jour : "${params.oldName ? params.oldName + ' à ' : ''}${params.name}"${params.oldMode && params.oldMode !== 'work' ? ` (mode changé de ${params.oldMode})` : ''}.`,
    historyLogUpdateCategoryAll: (params) => `Catégorie (Tous modes) mise à jour : "${params.oldName ? params.oldName + ' à ' : ''}${params.name}"${params.oldMode && params.oldMode !== 'all' ? ` (mode changé de ${params.oldMode})` : ''}.`,
    historyLogDeleteCategory: (params) => `Catégorie supprimée : "${params.name}" (Mode : ${params.mode}).`,
    historyLogSwitchToPersonalMode: "Passé en mode Personnel.",
    historyLogSwitchToWorkMode: "Passé en mode Travail.",
    historyLogPasswordChange: "Mot de passe changé.",
    historyLogAddAssignee: (params) => `Personne assignée ajoutée : "${params.name}".`,
    historyLogUpdateAssignee: (params) => `Personne assignée mise à jour : "${params.oldName ? params.oldName + ' à ' : ''}${params.name}".`,
    historyLogDeleteAssignee: (params) => `Personne assignée supprimée : "${params.name}".`,
    historyScopeAccount: "Compte",
    historyScopePersonal: "Personnel",
    historyScopeWork: "Travail",
    historyScopeCategory: "Catégorie",
    historyScopeAssignee: "Personne Assignée",
    motivationalPhrases: [
        "Le secret pour avancer, c'est de commencer.",
        "Ne regarde pas l'horloge ; fais ce qu'elle fait. Continue.",
        "La seule façon de faire du bon travail est d'aimer ce que vous faites.",
        "Crois que tu peux le faire et tu es à mi-chemin.",
        "Agis comme si ce que tu faisais faisait une différence. C'est le cas.",
        "Le succès n'est pas final, l'échec n'est pas fatal : C'est le courage de continuer qui compte.",
        "Efforce-toi non pas d'être un succès, mais plutôt d'être de valeur.",
        "L'avenir dépend de ce que vous faites aujourd'hui.",
        "Bien fait vaut mieux que bien dit.",
        "On n'est jamais trop vieux pour se fixer un autre but ou pour rêver un nouveau rêve."
    ],
    pomodoroTitle: "Minuteur Pomodoro",
    pomodoroStartWork: "Démarrer Travail (25 min)",
    pomodoroStartShortBreak: "Démarrer Pause Courte (5 min)",
    pomodoroStartLongBreak: "Démarrer Longue Pause (15 min)",
    pomodoroPause: "Pause",
    pomodoroResume: "Reprendre",
    pomodoroReset: "Réinitialiser",
    pomodoroWorkSession: "Session de Travail",
    pomodoroShortBreakSession: "Pause Courte",
    pomodoroLongBreakSession: "Longue Pause",
    pomodoroReadyToStart: "Prêt à commencer ?",
    pomodoroWorkSessionEnded: "Session de travail terminée",
    pomodoroShortBreakEnded: "Pause courte terminée",
    pomodoroLongBreakEnded: "Longue pause terminée",
    pomodoroTakeABreakOrStartNext: "C'est l'heure d'une pause ou de commencer la session suivante !",
    pomodoroFocusOnTask: "Concentrez-vous sur votre tâche !",
    pomodoroShortRelaxation: "Temps pour une courte relaxation.",
    pomodoroLongRelaxation: "Temps pour un repos plus long.",
    pomodoroCyclesCompleted: (params) => `${params.cycles} cycle(s) de travail terminé(s).`,
    pomodoroTakeAShortBreak: "C'est l'heure d'une courte pause !",
    pomodoroTakeALongBreak: "C'est l'heure d'une longue pause !",
    pomodoroBackToWork: "C'est l'heure de retourner au travail !",
    pomodoroErrorTitle: "Erreur Pomodoro",
    pomodoroSWNotReady: "Service Worker pour Pomodoro non prêt. Veuillez patienter ou recharger.",
    pomodoroInitializing: "Initialisation...",
  },
};

type PathImpl<T, Key extends keyof T> =
  Key extends string
  ? T[Key] extends Record<string, any>
    ? | `${Key}.${PathImpl<T[Key], Exclude<keyof T[Key], keyof any[]>> & string}`
      | `${Key}.${Exclude<keyof T[Key], keyof any[]> & string}`
    : never
  : never;

type Path<T> = PathImpl<T, keyof T> | keyof T;

export type TranslationKey = Path<Translations['en']>;

