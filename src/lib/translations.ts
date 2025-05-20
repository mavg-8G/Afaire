
export type Locale = 'en' | 'es';

export type Translations = {
  // AppHeader
  addActivity: string;
  manageCategories: string;
  language: string;
  english: string;
  spanish: string;
  theme: string;
  lightTheme: string;
  darkTheme: string;
  systemTheme: string;
  moreOptions: string; 
  personalMode: string;
  workMode: string;
  switchToPersonalMode: string;
  switchToWorkMode: string;
  logout: string;
  changePassword: string;


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


  // ActivityModal
  editActivityTitle: string;
  addActivityTitle: string;
  editActivityDescription: string;
  addActivityDescription: (params: { initialDateMsg: string }) => string;
  activityTitleLabel: string;
  categoryLabel: string;
  selectCategoryPlaceholder: string;
  activityDateLabel: string;
  pickADate: string;
  activityTimeLabel: string;
  todosLabel: string;
  suggestTodos: string;
  addTodo: string;
  newTodoPlaceholder: string;
  toastActivityUpdatedTitle: string;
  toastActivityUpdatedDescription: string;
  toastActivityAddedTitle: string;
  toastActivityAddedDescription: string;
  toastTitleNeeded: string;
  toastTitleNeededDescription: string;
  toastTodosSuggested: string;
  toastTodosSuggestedDescription: string;
  toastNoSuggestions: string;
  toastNoSuggestionsDescription: string;
  toastSuggestionError: string;
  toastSuggestionErrorDescription: string;


  // ActivityCalendarView
  activitiesForDate: (params: { date: string }) => string;
  activitiesForWeek: (params: { startDate: string; endDate: string }) => string;
  activitiesForMonth: (params: { month: string }) => string;
  loadingDate: string;
  noActivitiesForDay: string; 
  noActivitiesForPeriod: string; 
  selectDateToSeeActivities: string;
  addActivityForDate: (params: { date: string }) => string;
  confirmDeleteActivityTitle: string;
  confirmDeleteActivityDescription: (params: { activityTitle: string }) => string;
  toastActivityDeletedTitle: string;
  toastActivityDeletedDescription: (params: { activityTitle: string }) => string;
  todayButton: string;
  viewDaily: string;
  viewWeekly: string;
  viewMonthly: string;

  // ActivityListItem
  editActivitySr: string; 
  deleteActivitySr: string;
  todosCompleted: (params: { completed: number, total: number }) => string;
  noDetailsAvailable: string;
  noTodosForThisActivity: string;

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
  toastCategoryUpdatedDescription: string;
  toastCategoryDeletedTitle: string;
  toastCategoryDeletedDescription: (params: { categoryName: string }) => string;
  toastActivityStartingSoonTitle: string;
  toastActivityStartingSoonDescription: (params: { activityTitle: string, activityTime: string }) => string;

};

export const translations: Record<Locale, Translations> = {
  en: {
    addActivity: "Add Activity",
    manageCategories: "Categories",
    language: "Language",
    english: "English",
    spanish: "Spanish",
    theme: "Theme",
    lightTheme: "Light",
    darkTheme: "Dark",
    systemTheme: "System",
    moreOptions: "More options",
    personalMode: "Personal",
    workMode: "Work",
    switchToPersonalMode: "Switch to Personal Mode",
    switchToWorkMode: "Switch to Work Mode",
    logout: "Logout",
    changePassword: "Change Password",
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
    editActivityTitle: "Edit Activity",
    addActivityTitle: "Add New Activity",
    editActivityDescription: "Update the details of your activity.",
    addActivityDescription: (params) => `Fill in the details for your new activity.${params.initialDateMsg}`,
    activityTitleLabel: "Activity Title",
    categoryLabel: "Category",
    selectCategoryPlaceholder: "Select a category",
    activityDateLabel: "Activity Date",
    pickADate: "Pick a date",
    activityTimeLabel: "Activity Time (HH:MM)",
    todosLabel: "Todos",
    suggestTodos: "Suggest Todos",
    addTodo: "Add Todo",
    newTodoPlaceholder: "New todo item",
    toastActivityUpdatedTitle: "Activity Updated",
    toastActivityUpdatedDescription: "Your activity has been successfully updated.",
    toastActivityAddedTitle: "Activity Added",
    toastActivityAddedDescription: "Your new activity has been successfully added.",
    toastTitleNeeded: "Title Needed",
    toastTitleNeededDescription: "Please enter an activity title to get suggestions.",
    toastTodosSuggested: "Todos Suggested",
    toastTodosSuggestedDescription: "AI has added some todo suggestions.",
    toastNoSuggestions: "No Suggestions",
    toastNoSuggestionsDescription: "AI couldn't find any suggestions for this title.",
    toastSuggestionError: "Suggestion Error",
    toastSuggestionErrorDescription: "Could not fetch todo suggestions.",
    activitiesForDate: (params) => `Activities for ${params.date}`,
    activitiesForWeek: (params) => `Activities for week: ${params.startDate} - ${params.endDate}`,
    activitiesForMonth: (params) => `Activities for ${params.month}`,
    loadingDate: "Loading date...",
    noActivitiesForDay: "No activities scheduled for this day.",
    noActivitiesForPeriod: "No activities scheduled for this period.",
    selectDateToSeeActivities: "Select a date to see activities.",
    addActivityForDate: (params) => `Add Activity for ${params.date}`,
    confirmDeleteActivityTitle: "Are you sure?",
    confirmDeleteActivityDescription: (params) => `This action cannot be undone. This will permanently delete the activity "${params.activityTitle}" and all its associated todos.`,
    toastActivityDeletedTitle: "Activity Deleted",
    toastActivityDeletedDescription: (params) => `"${params.activityTitle}" has been removed.`,
    todayButton: "Today",
    viewDaily: "Daily",
    viewWeekly: "Weekly",
    viewMonthly: "Monthly",
    editActivitySr: "Edit Activity",
    deleteActivitySr: "Delete Activity",
    todosCompleted: (params) => `${params.completed} / ${params.total} todos completed`,
    noDetailsAvailable: "No details available.",
    noTodosForThisActivity: "No todos for this activity.",
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
    // AppProvider Toasts
    toastCategoryAddedTitle: "Category Added",
    toastCategoryAddedDescription: (params) => `Category "${params.categoryName}" has been added.`,
    toastCategoryUpdatedTitle: "Category Updated",
    toastCategoryUpdatedDescription: "The category details have been updated.",
    toastCategoryDeletedTitle: "Category Deleted",
    toastCategoryDeletedDescription: (params) => `Category "${params.categoryName}" has been removed.`,
    toastActivityStartingSoonTitle: "Activity Starting Soon!",
    toastActivityStartingSoonDescription: (params) => `"${params.activityTitle}" is scheduled for ${params.activityTime}.`,
  },
  es: {
    addActivity: "Añadir Actividad",
    manageCategories: "Categorías",
    language: "Idioma",
    english: "Inglés",
    spanish: "Español",
    theme: "Tema",
    lightTheme: "Claro",
    darkTheme: "Oscuro",
    systemTheme: "Sistema",
    moreOptions: "Más opciones",
    personalMode: "Personal",
    workMode: "Trabajo",
    switchToPersonalMode: "Cambiar a Modo Personal",
    switchToWorkMode: "Cambiar a Modo Trabajo",
    logout: "Cerrar Sesión",
    changePassword: "Cambiar Contraseña",
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
    editActivityTitle: "Editar Actividad",
    addActivityTitle: "Añadir Nueva Actividad",
    editActivityDescription: "Actualiza los detalles de tu actividad.",
    addActivityDescription: (params) => `Completa los detalles de tu nueva actividad.${params.initialDateMsg}`,
    activityTitleLabel: "Título de la Actividad",
    categoryLabel: "Categoría",
    selectCategoryPlaceholder: "Selecciona una categoría",
    activityDateLabel: "Fecha de la Actividad",
    pickADate: "Elige una fecha",
    activityTimeLabel: "Hora de la Actividad (HH:MM)",
    todosLabel: "Tareas",
    suggestTodos: "Sugerir Tareas",
    addTodo: "Añadir Tarea",
    newTodoPlaceholder: "Nueva tarea",
    toastActivityUpdatedTitle: "Actividad Actualizada",
    toastActivityUpdatedDescription: "Tu actividad ha sido actualizada exitosamente.",
    toastActivityAddedTitle: "Actividad Añadida",
    toastActivityAddedDescription: "Tu nueva actividad ha sido añadida exitosamente.",
    toastTitleNeeded: "Se Necesita un Título",
    toastTitleNeededDescription: "Por favor, introduce un título para la actividad para obtener sugerencias.",
    toastTodosSuggested: "Tareas Sugeridas",
    toastTodosSuggestedDescription: "La IA ha añadido algunas sugerencias de tareas.",
    toastNoSuggestions: "Sin Sugerencias",
    toastNoSuggestionsDescription: "La IA no pudo encontrar sugerencias para este título.",
    toastSuggestionError: "Error de Sugerencia",
    toastSuggestionErrorDescription: "No se pudieron obtener sugerencias de tareas.",
    activitiesForDate: (params) => `Actividades para ${params.date}`,
    activitiesForWeek: (params) => `Actividades para la semana: ${params.startDate} - ${params.endDate}`,
    activitiesForMonth: (params) => `Actividades para ${params.month}`,
    loadingDate: "Cargando fecha...",
    noActivitiesForDay: "No hay actividades programadas para este día.",
    noActivitiesForPeriod: "No hay actividades programadas para este período.",
    selectDateToSeeActivities: "Selecciona una fecha para ver actividades.",
    addActivityForDate: (params) => `Añadir Actividad para ${params.date}`,
    confirmDeleteActivityTitle: "¿Estás seguro?",
    confirmDeleteActivityDescription: (params) => `Esta acción no se puede deshacer. Esto eliminará permanentemente la actividad "${params.activityTitle}" y todas sus tareas asociadas.`,
    toastActivityDeletedTitle: "Actividad Eliminada",
    toastActivityDeletedDescription: (params) => `Se ha eliminado "${params.activityTitle}".`,
    todayButton: "Hoy",
    viewDaily: "Diario",
    viewWeekly: "Semanal",
    viewMonthly: "Mensual",
    editActivitySr: "Editar Actividad",
    deleteActivitySr: "Eliminar Actividad",
    todosCompleted: (params) => `${params.completed} / ${params.total} tareas completadas`,
    noDetailsAvailable: "No hay detalles disponibles.",
    noTodosForThisActivity: "No hay tareas para esta actividad.",
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
    // AppProvider Toasts
    toastCategoryAddedTitle: "Categoría Añadida",
    toastCategoryAddedDescription: (params) => `La categoría "${params.categoryName}" ha sido añadida.`,
    toastCategoryUpdatedTitle: "Categoría Actualizada",
    toastCategoryUpdatedDescription: "Los detalles de la categoría han sido actualizados.",
    toastCategoryDeletedTitle: "Categoría Eliminada",
    toastCategoryDeletedDescription: (params) => `La categoría "${params.categoryName}" ha sido eliminada.`,
    toastActivityStartingSoonTitle: "¡Actividad Comienza Pronto!",
    toastActivityStartingSoonDescription: (params) => `"${params.activityTitle}" está programada para las ${params.activityTime}.`,
  },
};

