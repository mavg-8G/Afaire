
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, CalendarIcon, Clock, X, Loader2, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity, Todo, RecurrenceRule, Assignee, AppMode, RecurrenceType } from '@/lib/types';
import CategorySelector from '@/components/shared/category-selector';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO, setDate as setDateOfMonth, addMonths, addDays, isValid } from 'date-fns';
import { useTranslations } from '@/contexts/language-context';
import { enUS, es, fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';


const todoSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(), 
  text: z.string().min(1, "Todo text cannot be empty."),
  completed: z.boolean().optional(),
});

const recurrenceSchema = z.object({
  type: z.enum(['none', 'daily', 'weekly', 'monthly'] as [RecurrenceType, ...RecurrenceType[]]).default('none'),
  endDate: z.date().nullable().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional().nullable(),
  dayOfMonth: z.number().min(1).max(31).optional().nullable(),
}).default({ type: 'none' });

const normalizeToLocalMidnight = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

export default function ActivityEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appStore = useAppStore(); // Get the whole store
  const {
    addActivity,
    updateActivity,
    addTodoToActivity,
    updateTodoInActivity,
    deleteTodoFromActivity,
    appMode,
    assignees,
    getRawActivities, // Still useful for initial check or if detail fetch fails
    getCategoryById,
    isLoading: isAppStoreLoading,
    categories,
    fetchAndSetSpecificActivityDetails, // Get the new function
  } = appStore;
  const { toast } = useToast();
  const { t, locale } = useTranslations();

  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isRecurrenceEndDatePopoverOpen, setIsRecurrenceEndDatePopoverOpen] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<Activity | undefined>(undefined);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [hasFetchedDetailsForId, setHasFetchedDetailsForId] = useState<number | null>(null);


  const activityIdParam = searchParams.get('id');
  const activityId = activityIdParam ? parseInt(activityIdParam, 10) : undefined;
  const initialDateParam = searchParams.get('initialDate');

  const dateLocale = useMemo(() => (locale === 'es' ? es : locale === 'fr' ? fr : enUS), [locale]);

  const activityFormSchema = z.object({
    title: z.string().min(1, t('activityTitleLabel')),
    categoryId: z.number({ required_error: t('categoryLabel'), invalid_type_error: t('categoryLabel') }).min(1, t('categoryLabel')),
    activityDate: z.date({ required_error: t('pickADate') }),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, t('invalidTimeFormat24Hour')).optional().or(z.literal('')),
    todos: z.array(todoSchema).optional(),
    notes: z.string().optional(),
    recurrence: recurrenceSchema,
    responsiblePersonIds: z.array(z.number()).optional(),
  });

  type ActivityFormData = z.infer<typeof activityFormSchema>;

  const defaultInitialDate = useMemo(() => {
    let dateToNormalize: Date;
    if (initialDateParam) {
      const timestamp = parseInt(initialDateParam, 10);
      if (!isNaN(timestamp) && isValid(new Date(timestamp))) {
        dateToNormalize = new Date(timestamp);
      } else {
        dateToNormalize = new Date();
      }
    } else {
      dateToNormalize = new Date();
    }
    return normalizeToLocalMidnight(dateToNormalize);
  }, [initialDateParam]);

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      title: "",
      activityDate: defaultInitialDate,
      time: "",
      todos: [],
      notes: "",
      recurrence: { type: 'none', endDate: null, daysOfWeek: [], dayOfMonth: defaultInitialDate.getDate() },
      responsiblePersonIds: [],
    }
  });

  // Effect to load activity details
  useEffect(() => {
    const loadActivity = async () => {
        setIsLoadingActivity(true);
        if (activityId !== undefined && !isNaN(activityId)) {
            let activityData: Activity | null | undefined = undefined;
            if (hasFetchedDetailsForId !== activityId) {
                activityData = await fetchAndSetSpecificActivityDetails(activityId);
                setHasFetchedDetailsForId(activityId); 
                if (!activityData) { 
                    toast({ variant: "destructive", title: "Error", description: "Failed to fetch activity details." });
                    router.replace('/');
                    setIsLoadingActivity(false);
                    return;
                }
            }
            
            const currentActivityToProcess = activityData || getRawActivities().find(a => a.id === activityId);

            if (currentActivityToProcess) {
                setActivityToEdit(currentActivityToProcess);
                const todosForForm = (Array.isArray(currentActivityToProcess.todos) ? currentActivityToProcess.todos : []).map(tItem => {
                    if (typeof tItem !== 'object' || tItem === null) {
                        return { id: `malformed_${uuidv4()}`, text: 'Invalid todo data', completed: false };
                    }
                    return {
                        id: tItem.id,
                        text: String(tItem.text || ''),
                        completed: !!tItem.completed
                    };
                });

                const activityCreatedAtDate = normalizeToLocalMidnight(new Date(currentActivityToProcess.createdAt));

                form.reset({
                    title: currentActivityToProcess.title,
                    categoryId: currentActivityToProcess.categoryId,
                    activityDate: activityCreatedAtDate,
                    time: currentActivityToProcess.time || "",
                    todos: todosForForm,
                    notes: currentActivityToProcess.notes || "",
                    recurrence: {
                        type: currentActivityToProcess.recurrence?.type || 'none',
                        endDate: currentActivityToProcess.recurrence?.endDate ? normalizeToLocalMidnight(new Date(currentActivityToProcess.recurrence.endDate)) : null,
                        daysOfWeek: currentActivityToProcess.recurrence?.daysOfWeek || [],
                        dayOfMonth: currentActivityToProcess.recurrence?.dayOfMonth || activityCreatedAtDate.getDate(),
                    },
                    responsiblePersonIds: currentActivityToProcess.responsiblePersonIds?.map(id => Number(id)) || [],
                });
            } else {
                toast({ variant: "destructive", title: "Error", description: "Activity not found." });
                router.replace('/');
            }
        } else { 
            const defaultCategory = categories.length > 0 ? categories[0] : undefined;
            form.reset({
                title: "",
                categoryId: defaultCategory ? defaultCategory.id : undefined,
                activityDate: defaultInitialDate, // Already normalized
                time: "",
                todos: [],
                notes: "",
                recurrence: { type: 'none', endDate: null, daysOfWeek: [], dayOfMonth: defaultInitialDate.getDate() },
                responsiblePersonIds: [],
            });
            setHasFetchedDetailsForId(null); 
        }
        setIsLoadingActivity(false);
    };

    loadActivity();
  }, [activityId, fetchAndSetSpecificActivityDetails, getRawActivities, form, defaultInitialDate, router, toast, categories, hasFetchedDetailsForId]);


  const { fields, append, remove } = useFieldArray({ control: form.control, name: "todos" });
  const recurrenceType = form.watch('recurrence.type');
  const activityStartDate = form.watch('activityDate');

  const onSubmit = async (data: ActivityFormData) => {
    setIsSubmittingForm(true);
    try {
      const recurrenceRule: RecurrenceRule | null = data.recurrence.type === 'none' ? null : {
        type: data.recurrence.type,
        endDate: data.recurrence.endDate ? data.recurrence.endDate.getTime() : null, // getTime() from normalized date
        daysOfWeek: data.recurrence.type === 'weekly' ? data.recurrence.daysOfWeek || [] : undefined,
        dayOfMonth: data.recurrence.type === 'monthly' ? data.recurrence.dayOfMonth || undefined : undefined,
      };

      const activityPayloadBase = {
        title: data.title,
        categoryId: data.categoryId,
        time: data.time === "" ? undefined : data.time,
        notes: data.notes,
        recurrence: recurrenceRule,
        responsiblePersonIds: (appMode === 'personal') ? data.responsiblePersonIds?.map(id => Number(id)) : [],
        appMode: appMode,
        createdAt: data.activityDate.getTime(), // getTime() from normalized date
      };

      if (activityToEdit && activityToEdit.id !== undefined) {
        const currentActivityId = activityToEdit.id;
        const formTodos = data.todos || [];
        const originalTodos = activityToEdit.todos || [];

        const newTodosToAdd = formTodos.filter(ft => ft.id === undefined || ft.id === null || (typeof ft.id === 'string' && (ft.id.startsWith('malformed_') || !Number.isFinite(parseInt(String(ft.id), 10))  ) ));
        for (const newTodo of newTodosToAdd) {
            if (newTodo.text.trim() !== "" && newTodo.text !== 'Invalid todo data') {
                await addTodoToActivity(currentActivityId, newTodo.text, !!newTodo.completed);
            }
        }

        const formTodoIds = new Set(formTodos.map(ft => ft.id).filter(id => typeof id === 'number'));
        const todosToDelete = originalTodos.filter(ot => typeof ot.id === 'number' && !formTodoIds.has(ot.id));
        for (const deletedTodo of todosToDelete) {
            await deleteTodoFromActivity(currentActivityId, deletedTodo.id as number);
        }

        const potentiallyUpdatedTodos = formTodos.filter(ft => typeof ft.id === 'number');
        for (const formTodo of potentiallyUpdatedTodos) {
            const originalTodo = originalTodos.find(ot => ot.id === formTodo.id);
            if (originalTodo && (originalTodo.text !== formTodo.text || originalTodo.completed !== formTodo.completed)) {
                await updateTodoInActivity(currentActivityId, formTodo.id as number, { text: formTodo.text, completed: !!formTodo.completed });
            }
        }
        
        const { todos, ...updatePayloadForCore } = activityPayloadBase; 
        await updateActivity(currentActivityId, updatePayloadForCore as Partial<Omit<Activity, 'id' | 'todos'>>, activityToEdit);
        
        toast({ title: t('toastActivityUpdatedTitle'), description: t('toastActivityUpdatedDescription') });

      } else {
        const addPayload = {
            ...activityPayloadBase,
            todos: data.todos?.map(t => ({ text: t.text, completed: !!t.completed })),
        };
        await addActivity(
          addPayload as Omit<Activity, 'id' | 'todos' | 'createdAt' | 'completed' | 'completedAt' | 'notes' | 'recurrence' | 'completedOccurrences' | 'responsiblePersonIds' | 'categoryId'| 'appMode'| 'masterActivityId' | 'isRecurringInstance' | 'originalInstanceDate'> & { todos?: Omit<Todo, 'id'>[], time?: string, notes?: string, recurrence?: RecurrenceRule | null, responsiblePersonIds?: number[], categoryId: number, appMode: AppMode },
          data.activityDate.getTime() // getTime() from normalized date
        );
        toast({ title: t('toastActivityAddedTitle'), description: t('toastActivityAddedDescription') });
      }
      router.replace('/');
    } catch (error) {
      console.error("Failed to save activity:", error);
      toast({ variant: "destructive", title: "Error", description: `Failed to save activity: ${error instanceof Error ? error.message : String(error)}`});
    } finally {
        setIsSubmittingForm(false); 
    }
  };

  const dialogTitle = activityToEdit ? t('editActivityTitle') : t('addActivityTitle');
  const dialogDescriptionText = activityToEdit && activityToEdit.createdAt
    ? t('editActivityDescription', { formattedInitialDate: format(normalizeToLocalMidnight(new Date(activityToEdit.createdAt)), "PPP", { locale: dateLocale }) })
    : t('addActivityDescription', { formattedInitialDate: format(defaultInitialDate, "PPP", { locale: dateLocale }) });

  const maxRecurrenceEndDate = activityStartDate ? addDays(addMonths(activityStartDate, 5), 1) : undefined;

  if ((isLoadingActivity && activityId !== undefined) || isAppStoreLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-6">
        <Link href="/" passHref>
          <Button variant="outline" disabled={isSubmittingForm}>
            <ArrowLeft className="mr-2 h-4 w-4" />{t('backToCalendar')}
          </Button>
        </Link>
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>{dialogTitle}</CardTitle>
          <CardDescription>{dialogDescriptionText}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('activityTitleLabel')}</FormLabel>
                    <FormControl><Input placeholder="e.g., Morning Gym Session" {...field} disabled={isSubmittingForm}/></FormControl>
                    <FormMessage />
                  </FormItem>
              )}/>
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('categoryLabel')}</FormLabel>
                    <CategorySelector
                      value={field.value !== undefined ? String(field.value) : undefined}
                      onChange={(value) => field.onChange(value ? Number(value) : undefined)}
                      placeholder={t('selectCategoryPlaceholder')}
                    />
                    <FormMessage />
                  </FormItem>
              )}/>

              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <FormField control={form.control} name="activityDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="min-h-8">{t('activityDateLabel')}</FormLabel>
                      <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} disabled={isSubmittingForm} className={cn("w-full pl-3 text-left font-normal truncate whitespace-nowrap",!field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP", { locale: dateLocale }) : <span>{t('pickADate')}</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50 flex-shrink-0" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 max-h-[calc(100vh-12rem)] overflow-y-auto z-[70]" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={(selectedDate) => {
                              if (selectedDate) {
                                const normalizedSelectedDate = normalizeToLocalMidnight(selectedDate);
                                field.onChange(normalizedSelectedDate);
                                const currentEndDate = form.getValues("recurrence.endDate");
                                if (currentEndDate && currentEndDate < normalizedSelectedDate) {
                                    form.setValue("recurrence.endDate", null);
                                }
                              }
                              setIsStartDatePopoverOpen(false);
                            }} disabled={(date) => date < new Date("1900-01-01")} locale={dateLocale} fixedWeeks />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="time" render={({ field }) => (
                    <FormItem className="flex flex-col min-w-0">
                      <FormLabel className="min-h-8">{t('activityTimeLabel')}</FormLabel>
                      <FormControl>
                        <div className="relative w-full max-w-full">
                           <Input type="time" {...field} className="w-full max-w-full pr-6" disabled={isSubmittingForm}/>
                          <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
              </div>

              {appMode === 'personal' && (
                <FormField control={form.control} name="responsiblePersonIds" render={() => (
                    <FormItem>
                      <FormLabel>{t('responsiblePeopleLabel')}</FormLabel>
                      {assignees.length > 0 ? (
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2 border rounded-md p-2">
                          {assignees.map((assignee: Assignee) => (
                            <FormField key={assignee.id} control={form.control} name="responsiblePersonIds"
                              render={({ field }) => {
                                return (
                                  <FormItem key={assignee.id} className="flex flex-row items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(assignee.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...(field.value || []), assignee.id])
                                            : field.onChange((field.value || []).filter((value) => value !== assignee.id));
                                        }}
                                        disabled={isSubmittingForm}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal">{assignee.name}</FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                        </div>
                      ) : (<p className="text-sm text-muted-foreground">{t('noAssigneesForSelection')}</p>)}
                      <FormMessage />
                    </FormItem>
                )}/>
              )}

              <FormField control={form.control} name="recurrence.type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('recurrenceTypeLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={isSubmittingForm}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t('recurrenceNone')} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t('recurrenceNone')}</SelectItem>
                        <SelectItem value="daily">{t('recurrenceDaily')}</SelectItem>
                        <SelectItem value="weekly">{t('recurrenceWeekly')}</SelectItem>
                        <SelectItem value="monthly">{t('recurrenceMonthly')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
              )}/>

              {recurrenceType === 'weekly' && (
                <FormField control={form.control} name="recurrence.daysOfWeek" render={() => (
                    <FormItem>
                      <FormLabel>{t('recurrenceDaysOfWeekLabel')}</FormLabel>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                        {WEEK_DAYS.map(day => (
                          <FormField key={day.id} control={form.control} name="recurrence.daysOfWeek"
                            render={({ field }) => (
                                <FormItem key={day.id} className="flex flex-row items-center space-x-1 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value?.includes(day.id)} disabled={isSubmittingForm}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), day.id])
                                          : field.onChange((field.value || []).filter((value) => value !== day.id));
                                      }}/>
                                  </FormControl>
                                  <FormLabel className="text-xs font-normal">{t(day.labelKey as any)}</FormLabel>
                                </FormItem>
                            )}/>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                )}/>
              )}

              {recurrenceType === 'monthly' && (
                <FormField control={form.control} name="recurrence.dayOfMonth" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('recurrenceDayOfMonthLabel')}</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="31" placeholder={t('recurrenceDayOfMonthPlaceholder')}
                          {...field} value={field.value ?? ''} disabled={isSubmittingForm}
                          onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value,10))}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
              )}

              {recurrenceType !== 'none' && (
                <FormField control={form.control} name="recurrence.endDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t('recurrenceEndDateLabel')}</FormLabel>
                      <Popover open={isRecurrenceEndDatePopoverOpen} onOpenChange={setIsRecurrenceEndDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} disabled={isSubmittingForm} className={cn("w-full pl-3 text-left font-normal justify-start truncate whitespace-nowrap", !field.value && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4 opacity-50 flex-shrink-0" />
                              {field.value ? format(field.value, "PPP", { locale: dateLocale }) : <span>{t('recurrenceNoEndDate')}</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 max-h-[calc(100vh-12rem)] overflow-y-auto z-[70]" align="start">
                          <Calendar mode="single" selected={field.value || undefined}
                            onSelect={(date) => { 
                                if (date) field.onChange(normalizeToLocalMidnight(date)); 
                                setIsRecurrenceEndDatePopoverOpen(false);
                            }}
                            disabled={(date) => { const minDate = activityStartDate || new Date("1900-01-01"); if (date < minDate) return true; if (maxRecurrenceEndDate && date > maxRecurrenceEndDate) return true; return false;}}
                            locale={dateLocale} fixedWeeks />
                          {field.value && (
                            <Button type="button" variant="ghost" size="sm" className="w-full rounded-t-none border-t"
                              onClick={(e) => { e.stopPropagation(); field.onChange(null); setIsRecurrenceEndDatePopoverOpen(false);}} aria-label={t('recurrenceClearEndDate')}>
                              <X className="mr-2 h-4 w-4" /> {t('recurrenceClearEndDate')}
                            </Button>
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                )}/>
              )}

              <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('activityNotesLabel')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t('activityNotesPlaceholder')} className="resize-none" {...field} value={field.value ?? ''} disabled={isSubmittingForm}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
              )}/>

              <div>
                <div className="flex justify-between items-center mb-2"><FormLabel>{t('todosLabel')}</FormLabel></div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {fields.map((item, index) => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <FormField control={form.control} name={`todos.${index}.completed`} render={({ field: todoField }) => (
                          <FormItem>
                            <FormControl><Checkbox checked={todoField.value} onCheckedChange={todoField.onChange} id={`todo-completed-${index}`} aria-labelledby={`todo-text-label-${index}`} disabled={isSubmittingForm}/></FormControl>
                          </FormItem>
                      )}/>
                      <FormField control={form.control} name={`todos.${index}.text`} render={({ field: todoField }) => (
                          <FormItem className="flex-grow">
                            <Label htmlFor={`todo-text-${index}`} id={`todo-text-label-${index}`} className="sr-only">Todo text {index + 1}</Label>
                            <FormControl><Input id={`todo-text-${index}`} placeholder={t('newTodoPlaceholder')} {...todoField} disabled={isSubmittingForm}/></FormControl>
                            <FormMessage />
                          </FormItem>
                      )}/>
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={isSubmittingForm}>
                        <Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only">{t('delete')}</span>
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ text: "", completed: false })} className="mt-2" disabled={isSubmittingForm}>
                  <PlusCircle className="mr-2 h-4 w-4" /> {t('addTodo')}
                </Button>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => router.replace('/')} disabled={isSubmittingForm}>{t('cancel')}</Button>
                <Button type="submit" disabled={isSubmittingForm}>
                  {isSubmittingForm ? <Loader2 className="h-5 w-5 animate-spin" /> : (activityToEdit ? t('saveChanges') : t('addActivity'))}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

const WEEK_DAYS = [
  { id: 0, labelKey: 'daySun' }, { id: 1, labelKey: 'dayMon' }, { id: 2, labelKey: 'dayTue' },
  { id: 3, labelKey: 'dayWed' }, { id: 4, labelKey: 'dayThu' }, { id: 5, labelKey: 'dayFri' },
  { id: 6, labelKey: 'daySat' },
] as const;

