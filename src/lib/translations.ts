
export type Locale = 'en' | 'es';

export type Translations = {
  // AppHeader
  addActivity: string;
  manageCategories: string;
  language: string;
  english: string;
  spanish: string;

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
  saveChanges: string;
  cancel: string;
  existingCategories: string;
  viewEditManageCategories: string;
  delete: string;
  confirmDelete: string;
  confirmDeleteCategoryDescription: string; 
  categoriesCount: (count: number) => string;
  noCategoriesYet: string;


  // ActivityModal
  editActivityTitle: string;
  addActivityTitle: string;
  editActivityDescription: string;
  addActivityDescription: (initialDateMsg: string) => string;
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
  activitiesForDate: (date: string) => string;
  loadingDate: string;
  noActivitiesForDay: string;
  selectDateToSeeActivities: string;
  addActivityForDate: (date: string) => string;
  confirmDeleteActivityTitle: string;
  confirmDeleteActivityDescription: (activityTitle: string) => string;
  toastActivityDeletedTitle: string;
  toastActivityDeletedDescription: (activityTitle: string) => string;

  // ActivityListItem
  editActivitySr: string; // Sr for Screen Reader
  deleteActivitySr: string;
  todosCompleted: (completed: number, total: number) => string;
  noDetailsAvailable: string;
  noTodosForThisActivity: string;

};

export const translations: Record<Locale, Translations> = {
  en: {
    addActivity: "Add Activity",
    manageCategories: "Categories",
    language: "Language",
    english: "English",
    spanish: "Spanish",
    backToCalendar: "Back to Calendar",
    addCategory: "Add Category",
    editCategory: "Edit Category",
    addNewCategory: "Add New Category",
    updateCategoryDetails: "Update the details of your category.",
    createCategoryDescription: "Create a new category for your activities.",
    categoryName: "Category Name",
    iconName: "Icon Name (from Lucide)",
    iconNameDescriptionLink: "Enter a PascalCase icon name from <a>lucide.dev/icons</a>.",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    existingCategories: "Existing Categories",
    viewEditManageCategories: "View, edit, and manage your current categories.",
    delete: "Delete",
    confirmDelete: "Are you sure?",
    confirmDeleteCategoryDescription: "This action will delete the category \"{categoryName}\". Activities using this category will no longer be associated with it. This cannot be undone.",
    categoriesCount: (count) => `You have ${count} categor${count === 1 ? 'y' : 'ies'}.`,
    noCategoriesYet: "No categories added yet. Use the form to add your first category.",
    editActivityTitle: "Edit Activity",
    addActivityTitle: "Add New Activity",
    editActivityDescription: "Update the details of your activity.",
    addActivityDescription: (initialDateMsg) => `Fill in the details for your new activity. ${initialDateMsg}`,
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
    activitiesForDate: (date) => `Activities for ${date}`,
    loadingDate: "Loading date...",
    noActivitiesForDay: "No activities scheduled for this day.",
    selectDateToSeeActivities: "Select a date to see activities.",
    addActivityForDate: (date) => `Add Activity for ${date}`,
    confirmDeleteActivityTitle: "Are you sure?",
    confirmDeleteActivityDescription: (activityTitle) => `This action cannot be undone. This will permanently delete the activity "${activityTitle}" and all its associated todos.`,
    toastActivityDeletedTitle: "Activity Deleted",
    toastActivityDeletedDescription: (activityTitle) => `"${activityTitle}" has been removed.`,
    editActivitySr: "Edit Activity",
    deleteActivitySr: "Delete Activity",
    todosCompleted: (completed, total) => `${completed} / ${total} todos completed`,
    noDetailsAvailable: "No details available.",
    noTodosForThisActivity: "No todos for this activity.",
  },
  es: {
    addActivity: "Añadir Actividad",
    manageCategories: "Categorías",
    language: "Idioma",
    english: "Inglés",
    spanish: "Español",
    backToCalendar: "Volver al Calendario",
    addCategory: "Añadir Categoría",
    editCategory: "Editar Categoría",
    addNewCategory: "Añadir Nueva Categoría",
    updateCategoryDetails: "Actualiza los detalles de tu categoría.",
    createCategoryDescription: "Crea una nueva categoría para tus actividades.",
    categoryName: "Nombre de la Categoría",
    iconName: "Nombre del Icono (de Lucide)",
    iconNameDescriptionLink: "Introduce un nombre de icono en PascalCase de <a>lucide.dev/icons</a>.",
    saveChanges: "Guardar Cambios",
    cancel: "Cancelar",
    existingCategories: "Categorías Existentes",
    viewEditManageCategories: "Ver, editar y gestionar tus categorías actuales.",
    delete: "Eliminar",
    confirmDelete: "¿Estás seguro?",
    confirmDeleteCategoryDescription: "Esta acción eliminará la categoría \"{categoryName}\". Las actividades que usan esta categoría ya no estarán asociadas a ella. Esto no se puede deshacer.",
    categoriesCount: (count) => `Tienes ${count} categorí${count === 1 ? 'a' : 'as'}.`,
    noCategoriesYet: "Aún no has añadido categorías. Usa el formulario para añadir tu primera categoría.",
    editActivityTitle: "Editar Actividad",
    addActivityTitle: "Añadir Nueva Actividad",
    editActivityDescription: "Actualiza los detalles de tu actividad.",
    addActivityDescription: (initialDateMsg) => `Completa los detalles de tu nueva actividad. ${initialDateMsg}`,
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
    activitiesForDate: (date) => `Actividades para ${date}`,
    loadingDate: "Cargando fecha...",
    noActivitiesForDay: "No hay actividades programadas para este día.",
    selectDateToSeeActivities: "Selecciona una fecha para ver actividades.",
    addActivityForDate: (date) => `Añadir Actividad para ${date}`,
    confirmDeleteActivityTitle: "¿Estás seguro?",
    confirmDeleteActivityDescription: (activityTitle) => `Esta acción no se puede deshacer. Esto eliminará permanentemente la actividad "${activityTitle}" y todas sus tareas asociadas.`,
    toastActivityDeletedTitle: "Actividad Eliminada",
    toastActivityDeletedDescription: (activityTitle) => `Se ha eliminado "${activityTitle}".`,
    editActivitySr: "Editar Actividad",
    deleteActivitySr: "Eliminar Actividad",
    todosCompleted: (completed, total) => `${completed} / ${total} tareas completadas`,
    noDetailsAvailable: "No hay detalles disponibles.",
    noTodosForThisActivity: "No hay tareas para esta actividad.",
  },
};
