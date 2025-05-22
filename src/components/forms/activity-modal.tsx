
"use client";
import React, { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, CalendarIcon, Clock, X } from 'lucide-react';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity, Todo, RecurrenceRule } from '@/lib/types';
import CategorySelector from '@/components/shared/category-selector';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO, setDate as setDateOfMonth, addMonths, addDays } from 'date-fns';
import { useTranslations } from '@/contexts/language-context';
import { enUS, es } from 'date-fns/locale';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity?: Activity; // Master activity if editing
  initialDate?: Date; // For FAB or pre-selecting calendar date
  instanceDate?: Date; // If editing/viewing a specific instance of a recurring task
}

const todoSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, "Todo text cannot be empty."),
  completed: z.boolean().optional(),
});

const recurrenceSchema = z.object({
  type: z.enum(['none', 'daily', 'weekly', 'monthly']).default('none'),
  endDate: z.date().nullable().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional().nullable(), // 0 for Sun, 6 for Sat
  dayOfMonth: z.number().min(1).max(31).optional().nullable(),
}).default({ type: 'none' });


export default function ActivityModal({ isOpen, onClose, activity, initialDate, instanceDate }: ActivityModalProps) {
  const { addActivity, updateActivity } = useAppStore();
  const { toast } = useToast();
  const { t, locale } = useTranslations();
  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isRecurrenceEndDatePopoverOpen, setIsRecurrenceEndDatePopoverOpen] = useState(false);

  const dateLocale = locale === 'es' ? es : enUS;
  const effectiveInitialDate = instanceDate || (activity ? new Date(activity.createdAt) : initialDate) || new Date();

  const activityFormSchema = z.object({
    title: z.string().min(1, t('activityTitleLabel')),
    categoryId: z.string().min(1, t('categoryLabel')),
    activityDate: z.date({ required_error: t('pickADate') }),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, t('invalidTimeFormat24Hour')).optional().or(z.literal('')),
    todos: z.array(todoSchema).optional(),
    notes: z.string().optional(),
    recurrence: recurrenceSchema,
  });
  
  type ActivityFormData = z.infer<typeof activityFormSchema>;

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      title: "",
      categoryId: "",
      activityDate: effectiveInitialDate,
      time: "",
      todos: [],
      notes: "",
      recurrence: {
        type: 'none',
        endDate: null,
        daysOfWeek: [],
        dayOfMonth: new Date(effectiveInitialDate).getDate(),
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "todos",
  });

  const recurrenceType = form.watch('recurrence.type');
  const activityStartDate = form.watch('activityDate'); 

  useEffect(() => {
    if (isOpen) {
      const currentEffectiveDate = instanceDate || (activity ? new Date(activity.createdAt) : initialDate) || new Date();
      if (activity) {
        form.reset({
          title: activity.title,
          categoryId: activity.categoryId,
          activityDate: new Date(activity.createdAt), 
          time: activity.time || "",
          todos: activity.todos?.map(t => ({ id: t.id, text: t.text, completed: t.completed })) || [],
          notes: activity.notes || "",
          recurrence: {
            type: activity.recurrence?.type || 'none',
            endDate: activity.recurrence?.endDate ? new Date(activity.recurrence.endDate) : null,
            daysOfWeek: activity.recurrence?.daysOfWeek || [],
            dayOfMonth: activity.recurrence?.dayOfMonth || new Date(activity.createdAt).getDate(),
          }
        });
      } else {
        form.reset({
          title: "",
          categoryId: "",
          activityDate: initialDate || new Date(),
          time: "",
          todos: [],
          notes: "",
          recurrence: {
            type: 'none',
            endDate: null,
            daysOfWeek: [],
            dayOfMonth: (initialDate || new Date()).getDate(), 
          }
        });
      }
      setIsStartDatePopoverOpen(false);
      setIsRecurrenceEndDatePopoverOpen(false);
    }
  }, [activity, form, isOpen, initialDate, instanceDate]);

  const onSubmit = (data: ActivityFormData) => {
    const recurrenceRule: RecurrenceRule | null = data.recurrence.type === 'none' ? null : {
      type: data.recurrence.type,
      endDate: data.recurrence.endDate ? data.recurrence.endDate.getTime() : null,
      daysOfWeek: data.recurrence.type === 'weekly' ? data.recurrence.daysOfWeek || [] : undefined,
      dayOfMonth: data.recurrence.type === 'monthly' ? data.recurrence.dayOfMonth || undefined : undefined,
    };

    const activityPayload = {
      title: data.title,
      categoryId: data.categoryId,
      todos: data.todos?.map(t => ({
        id: t.id || undefined, 
        text: t.text,
        completed: t.completed || false
      })) || [],
      createdAt: data.activityDate.getTime(), 
      time: data.time === "" ? undefined : data.time,
      notes: data.notes,
      recurrence: recurrenceRule,
      completedOccurrences: activity?.completedOccurrences || {}, 
    };

    if (activity) { 
      updateActivity(activity.id, activityPayload as Partial<Activity>);
      toast({ title: t('toastActivityUpdatedTitle'), description: t('toastActivityUpdatedDescription') });
    } else {
      addActivity(
        activityPayload as Omit<Activity, 'id' | 'completedOccurrences'> & { todos?: Omit<Todo, 'id' | 'completed'>[] },
        data.activityDate.getTime() 
      );
      toast({ title: t('toastActivityAddedTitle'), description: t('toastActivityAddedDescription') });
    }
    onClose();
  };

  if (!isOpen) return null;

  const dialogDescriptionText = activity
    ? t('editActivityDescription')
    : t('addActivityDescription', { initialDateMsg: ` ${t('locale') === 'es' ? 'Fecha por defecto:' : 'Default date:'} ${format(initialDate || new Date(), "PPP", { locale: dateLocale })}.` });
  
  const maxRecurrenceEndDate = activityStartDate ? addDays(addMonths(activityStartDate, 5), 1) : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col z-[70]">
        <DialogHeader>
          <DialogTitle>{activity ? t('editActivityTitle') : t('addActivityTitle')}</DialogTitle>
          <DialogDescription>
            {dialogDescriptionText}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto px-1 py-2 flex-grow">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('activityTitleLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Morning Gym Session" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('categoryLabel')}</FormLabel>
                  <CategorySelector
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('selectCategoryPlaceholder')}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="activityDate" 
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="min-h-8">{t('activityDateLabel')}</FormLabel>
                    <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: dateLocale })
                            ) : (
                              <span>{t('pickADate')}</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[80]" align="start" > {/* Increased z-index */}
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(selectedDate) => {
                            if (selectedDate) field.onChange(selectedDate);
                            const currentEndDate = form.getValues("recurrence.endDate");
                            if (selectedDate && currentEndDate && currentEndDate < selectedDate) {
                                form.setValue("recurrence.endDate", null);
                            }
                            setIsStartDatePopoverOpen(false);
                          }}
                          disabled={(date) => date < new Date("1900-01-01")}
                          locale={dateLocale}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem className="flex flex-col min-w-0">
                    <FormLabel className="min-h-8">{t('activityTimeLabel')}</FormLabel>
                    <FormControl>
                      <div className="relative w-full">
                        <Input type="time" {...field} className="pr-6 w-full" />
                        <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Recurrence Section */}
            <div className="space-y-2 border p-3 rounded-md">
              <h3 className="text-sm font-medium">{t('recurrenceLabel')}</h3>
              <FormField
                control={form.control}
                name="recurrence.type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('recurrenceTypeLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('recurrenceNone')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t('recurrenceNone')}</SelectItem>
                        <SelectItem value="daily">{t('recurrenceDaily')}</SelectItem>
                        <SelectItem value="weekly">{t('recurrenceWeekly')}</SelectItem>
                        <SelectItem value="monthly">{t('recurrenceMonthly')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {recurrenceType === 'weekly' && (
                <FormField
                  control={form.control}
                  name="recurrence.daysOfWeek"
                  render={() => (
                    <FormItem>
                      <FormLabel>{t('recurrenceDaysOfWeekLabel')}</FormLabel>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                        {WEEK_DAYS.map(day => (
                          <FormField
                            key={day.id}
                            control={form.control}
                            name="recurrence.daysOfWeek"
                            render={({ field }) => {
                              return (
                                <FormItem key={day.id} className="flex flex-row items-center space-x-1 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(day.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), day.id])
                                          : field.onChange(
                                              (field.value || []).filter(
                                                (value) => value !== day.id
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-xs font-normal">{t(day.labelKey as any)}</FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {recurrenceType === 'monthly' && (
                <FormField
                  control={form.control}
                  name="recurrence.dayOfMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('recurrenceDayOfMonthLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          placeholder={t('recurrenceDayOfMonthPlaceholder')}
                          {...field}
                          value={field.value ?? ''}
                          onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value,10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {recurrenceType !== 'none' && (
                <FormField
                  control={form.control}
                  name="recurrence.endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t('recurrenceEndDateLabel')}</FormLabel>
                       <Popover open={isRecurrenceEndDatePopoverOpen} onOpenChange={setIsRecurrenceEndDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                             <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal justify-start", // Changed from flex justify-between
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                {field.value ? (
                                  format(field.value, "PPP", { locale: dateLocale })
                                ) : (
                                  <span>{t('recurrenceNoEndDate')}</span>
                                )}
                              </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[80]" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={(date) => {
                              field.onChange(date);
                              setIsRecurrenceEndDatePopoverOpen(false);
                            }}
                            disabled={(date) => {
                                const minDate = activityStartDate || new Date("1900-01-01");
                                if (date < minDate) return true;
                                if (maxRecurrenceEndDate && date > maxRecurrenceEndDate) return true;
                                return false;
                            }}
                            locale={dateLocale}
                          />
                          {field.value && (
                            <Button
                              type="button" // Ensure it's not a submit button
                              variant="ghost"
                              size="sm" 
                              className="w-full rounded-t-none border-t" 
                              onClick={(e) => {
                                e.stopPropagation(); 
                                field.onChange(null);
                                setIsRecurrenceEndDatePopoverOpen(false); 
                              }}
                              aria-label={t('recurrenceClearEndDate')}
                            >
                              <X className="mr-2 h-4 w-4" /> {t('recurrenceClearEndDate')}
                            </Button>
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>


            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('activityNotesLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('activityNotesPlaceholder')}
                      className="resize-none"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className="flex justify-between items-center mb-2">
                <FormLabel>{t('todosLabel')}</FormLabel>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {fields.map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-2">
                    <FormField
                      control={form.control}
                      name={`todos.${index}.completed`}
                      render={({ field: todoField }) => (
                        <FormItem>
                          <FormControl>
                             <Checkbox
                              checked={todoField.value}
                              onCheckedChange={todoField.onChange}
                              id={`todo-completed-${index}`}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`todos.${index}.text`}
                      render={({ field: todoField }) => (
                        <FormItem className="flex-grow">
                          <FormControl>
                            <Input placeholder={t('newTodoPlaceholder')} {...todoField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                       <span className="sr-only">{t('delete')}</span>
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ text: "", completed: false })}
                className="mt-2"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> {t('addTodo')}
              </Button>
            </div>
          <DialogFooter className="pt-4 mt-auto">
            <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button type="submit">{activity ? t('saveChanges') : t('addActivity')}</Button>
          </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const WEEK_DAYS = [
  { id: 0, labelKey: 'daySun' }, { id: 1, labelKey: 'dayMon' }, { id: 2, labelKey: 'dayTue' },
  { id: 3, labelKey: 'dayWed' }, { id: 4, labelKey: 'dayThu' }, { id: 5, labelKey: 'dayFri' },
  { id: 6, labelKey: 'daySat' },
] as const;
