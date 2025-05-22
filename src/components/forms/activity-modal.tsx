
"use client";
import React, { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Trash2, Sparkles, Loader2, CalendarIcon, Clock } from 'lucide-react';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity, Todo } from '@/lib/types';
import CategorySelector from '@/components/shared/category-selector';
import { suggestTodos, type SuggestTodosInput } from '@/ai/flows/suggest-todos';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { useTranslations } from '@/contexts/language-context';
import { enUS, es } from 'date-fns/locale';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity?: Activity;
  initialDate?: Date;
}

const todoSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, "Todo text cannot be empty."),
  completed: z.boolean().optional(),
});

const activityFormSchema = z.object({
  title: z.string().min(1, "Activity title is required."),
  categoryId: z.string().min(1, "Category is required."),
  activityDate: z.date({ required_error: "Activity date is required." }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format. Use HH:MM (24-hour).").optional().or(z.literal('')),
  todos: z.array(todoSchema).optional(),
  notes: z.string().optional(),
});

type ActivityFormData = z.infer<typeof activityFormSchema>;

export default function ActivityModal({ isOpen, onClose, activity, initialDate }: ActivityModalProps) {
  const { addActivity, updateActivity } = useAppStore();
  const { toast } = useToast();
  const { t, locale } = useTranslations();
  const [isSuggestingTodos, setIsSuggestingTodos] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const dateLocale = locale === 'es' ? es : enUS;

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      title: "",
      categoryId: "",
      activityDate: initialDate || new Date(),
      time: "",
      todos: [],
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "todos",
  });

  useEffect(() => {
    if (isOpen) {
      if (activity) {
        form.reset({
          title: activity.title,
          categoryId: activity.categoryId,
          activityDate: new Date(activity.createdAt),
          time: activity.time || "",
          todos: activity.todos.map(t => ({ id: t.id, text: t.text, completed: t.completed })),
          notes: activity.notes || "",
        });
      } else {
        form.reset({
          title: "",
          categoryId: "",
          activityDate: initialDate || new Date(),
          time: "",
          todos: [],
          notes: "",
        });
      }
      setIsDatePopoverOpen(false);
    }
  }, [activity, form, isOpen, initialDate]);

  const onSubmit = (data: ActivityFormData) => {
    const activityPayload: Partial<Activity> & { title: string; categoryId: string; createdAt: number } = {
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
    };

    if (activity) {
      updateActivity(activity.id, {
        ...activityPayload,
        todos: activityPayload.todos as Todo[],
      });
      toast({ title: t('toastActivityUpdatedTitle'), description: t('toastActivityUpdatedDescription') });
    } else {
      addActivity(
        {
          title: data.title,
          categoryId: data.categoryId,
          todos: data.todos?.map(t=>({text: t.text, completed: false})),
          time: data.time === "" ? undefined : data.time,
          notes: data.notes,
        },
        data.activityDate.getTime()
      );
      toast({ title: t('toastActivityAddedTitle'), description: t('toastActivityAddedDescription') });
    }
    onClose();
  };

  const handleSuggestTodos = async () => {
    const activityTitle = form.getValues("title");
    if (!activityTitle) {
      toast({ title: t('toastTitleNeeded'), description: t('toastTitleNeededDescription'), variant: "destructive" });
      return;
    }
    setIsSuggestingTodos(true);
    try {
      const input: SuggestTodosInput = { activityTitle };
      const result = await suggestTodos(input);
      if (result.todos && result.todos.length > 0) {
        result.todos.forEach(todoText => {
          const existingTodo = fields.find(field => field.text.toLowerCase() === todoText.toLowerCase());
          if (!existingTodo) {
            append({ text: todoText, completed: false });
          }
        });
        toast({ title: t('toastTodosSuggested'), description: t('toastTodosSuggestedDescription') });
      } else {
        toast({ title: t('toastNoSuggestions'), description: t('toastNoSuggestionsDescription') });
      }
    } catch (error) {
      console.error("Error suggesting todos:", error);
      toast({ title: t('toastSuggestionError'), description: t('toastSuggestionErrorDescription'), variant: "destructive" });
    } finally {
      setIsSuggestingTodos(false);
    }
  };

  if (!isOpen) return null;

  const formattedInitialDateMsg = initialDate && !activity
    ? ` ${t('locale') === 'es' ? 'Por defecto será el' : 'Defaulting to'} ${format(initialDate, "PPP", { locale: dateLocale })}.`
    : ` ${t('locale') === 'es' ? 'Puedes cambiar la fecha abajo.' : 'You can change the date below.'}`;

  const dialogDescriptionText = activity
    ? t('editActivityDescription')
    : t('addActivityDescription', { initialDateMsg: formattedInitialDateMsg });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
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
                    <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
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
                      <PopoverContent
                        className="w-auto p-0 z-[70]"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(selectedDate) => {
                            field.onChange(selectedDate);
                            setIsDatePopoverOpen(false);
                          }}
                          disabled={(date) =>
                            date < new Date("1900-01-01")
                          }
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
                      <div className="relative">
                        <Input type="time" {...field} className="pr-6" />
                        <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className="flex justify-between items-center mb-2">
                <FormLabel>{t('todosLabel')}</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={handleSuggestTodos} disabled={isSuggestingTodos}>
                  {isSuggestingTodos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {t('suggestTodos')}
                </Button>
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
