
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription as ShadcnFormDescription,
} from "@/components/ui/form";
import { useAppStore } from '@/hooks/use-app-store';
import type { Habit, HabitSlot, HabitCreateData, HabitSlotCreateData, HabitUpdateData } from '@/lib/types';
import { Trash2, PlusCircle, Edit3, XCircle, ArrowLeft, Loader2, Brain } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from '@/contexts/language-context';

// Schema for a single slot in the form
const formHabitSlotSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(), // Client-side UUID for new, number for existing
  name: z.string().min(1, "Slot name cannot be empty."),
  default_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format. Use HH:MM.").optional().or(z.literal('')),
});

// Schema for the main habit form
const habitFormSchema = z.object({
  name: z.string().min(1, "Habit name is required."),
  icon_name: z.string().min(1, "Icon name is required (e.g., BookOpen, Repeat)."),
  slots: z.array(formHabitSlotSchema).min(1, "At least one slot is required for a habit."),
});

type HabitFormData = z.infer<typeof habitFormSchema>;

export default function ManageHabitsPage() {
  const { habits, addHabit, updateHabit, deleteHabit, isLoading: isAppLoading } = useAppStore();
  const { t } = useTranslations();
  const [habitToDelete, setHabitToDelete] = useState<number | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<HabitFormData>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: {
      name: "",
      icon_name: "",
      slots: [{ name: "", default_time: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "slots",
  });

  useEffect(() => {
    if (editingHabit) {
      form.reset({
        name: editingHabit.name,
        icon_name: editingHabit.iconName,
        slots: editingHabit.slots.map(s => ({
          id: s.id, // This will be the number ID from backend
          name: s.name,
          default_time: s.default_time || ""
        })),
      });
    } else {
      form.reset({ name: "", icon_name: "", slots: [{ name: "", default_time: "" }] });
    }
  }, [editingHabit, form]);

  const onSubmit = async (data: HabitFormData) => {
    setIsSubmitting(true);
    try {
      const slotsPayload: HabitSlotCreateData[] = data.slots.map(s => ({
        name: s.name,
        default_time: s.default_time || undefined,
      }));

      if (editingHabit) {
        const habitUpdatePayload: HabitUpdateData = {
          name: data.name,
          icon_name: data.icon_name,
          slots: slotsPayload, // Backend will handle creation/update/deletion of slots based on this
        };
        await updateHabit(editingHabit.id, habitUpdatePayload);
        setEditingHabit(null);
      } else {
        const habitToCreate: HabitCreateData = {
          name: data.name,
          icon_name: data.icon_name,
          slots: slotsPayload,
        };
        await addHabit(habitToCreate);
      }
      form.reset({ name: "", icon_name: "", slots: [{ name: "", default_time: "" }] });
    } catch (error) {
      console.error("Failed to save habit:", error);
      // Error toast is handled by AppProvider
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHabit = async (habitId: number) => {
    setIsSubmitting(true);
    try {
      await deleteHabit(habitId);
      setHabitToDelete(null);
      if (editingHabit?.id === habitId) {
        setEditingHabit(null);
        form.reset({ name: "", icon_name: "", slots: [{ name: "", default_time: "" }] });
      }
    } catch (error) {
      console.error("Failed to delete habit:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingHabit(null);
    form.reset({ name: "", icon_name: "", slots: [{ name: "", default_time: "" }] });
  };
  
  const iconNameDescKey = t('iconNameDescriptionLink');
  const linkPart = `<a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" class="underline text-primary">lucide.dev/icons</a>`;
  const iconNameDescription = iconNameDescKey.replace('<a>lucide.dev/icons</a>', linkPart);

  return (
    <div className="flex flex-col flex-grow min-h-screen">
      <main className="flex-grow container mx-auto py-8 px-4">
        <div className="mb-6 flex justify-start">
          <Link href="/" passHref>
            <Button variant="outline" disabled={isSubmitting}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToCalendar')}
            </Button>
          </Link>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>{editingHabit ? t('editHabit') : t('addNewHabit')}</CardTitle>
              <CardDescription>
                {editingHabit ? t('updateCategoryDetails') : t('habitsPageDescription')} 
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('habitNameLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('habitNamePlaceholder')} {...field} disabled={isSubmitting || isAppLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="icon_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('habitIconNameLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('habitIconNamePlaceholder')} {...field} disabled={isSubmitting || isAppLoading} />
                        </FormControl>
                        <ShadcnFormDescription dangerouslySetInnerHTML={{ __html: iconNameDescription }} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <FormLabel>{t('habitSlotsLabel')}</FormLabel>
                    <div className="space-y-3 mt-2 border p-4 rounded-md max-h-72 overflow-y-auto">
                      {fields.map((item, index) => (
                        <div key={item.id} className="p-3 border rounded-md bg-muted/30 space-y-3">
                          <FormField
                            control={form.control}
                            name={`slots.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('slotNameLabel')} {index + 1}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('slotNamePlaceholder')} {...field} disabled={isSubmitting || isAppLoading} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`slots.${index}.default_time`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('slotDefaultTimeLabel')}</FormLabel>
                                <FormControl>
                                  <Input type="time" placeholder={t('slotDefaultTimePlaceholder')} {...field} disabled={isSubmitting || isAppLoading} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => remove(index)}
                              disabled={isSubmitting || isAppLoading}
                              className="w-full text-destructive hover:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('deleteSlotSr')} {index + 1}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                     <FormMessage>{form.formState.errors.slots?.root?.message || form.formState.errors.slots?.message}</FormMessage>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ name: "", default_time: "" })}
                      className="mt-3"
                      disabled={isSubmitting || isAppLoading}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> {t('addSlotButton')}
                    </Button>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button type="submit" className="flex-grow" disabled={isSubmitting || isAppLoading}>
                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (editingHabit ? <Edit3 className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />)}
                      {editingHabit ? t('saveChanges') : t('addNewHabit')}
                    </Button>
                    {editingHabit && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSubmitting}>
                        <XCircle className="mr-2 h-5 w-5" />
                        {t('cancel')}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="shadow-lg flex flex-col">
            <CardHeader>
              <CardTitle>{t('existingHabitsTitle')}</CardTitle>
              <CardDescription>{t('viewEditManageHabits')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {isAppLoading && <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin" /></div>}
              {!isAppLoading && habits.length > 0 ? (
                <ScrollArea className="h-full pr-1"> 
                  <ul className="space-y-3">
                    {habits.map((habit) => (
                      <li key={habit.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-md shadow-sm">
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <habit.icon className="h-6 w-6 text-primary flex-shrink-0" />
                            <span className="font-medium text-lg truncate" title={habit.name}>{habit.name}</span>
                          </div>
                          <div className="ml-9 space-y-1">
                            {habit.slots.map(slot => (
                              <div key={slot.id} className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground/80">{slot.name}</span>
                                {slot.default_time && ` - ${slot.default_time}`}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center flex-shrink-0 ml-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditHabit(habit)} className="text-primary hover:text-primary/80" disabled={isSubmitting}>
                            <Edit3 className="h-5 w-5" />
                            <span className="sr-only">{t('editHabit')}</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" disabled={isSubmitting}>
                                <Trash2 className="h-5 w-5" />
                                 <span className="sr-only">{t('delete')}</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('confirmDeleteHabitTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('confirmDeleteHabitDescription', { habitName: habit.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setHabitToDelete(null)}>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteHabit(habit.id)} disabled={isSubmitting}>
                                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                !isAppLoading && <p className="text-sm text-muted-foreground text-center py-4">{t('noHabitsYet')}</p>
              )}
            </CardContent>
             {!isAppLoading && habits.length > 0 && (
              <CardFooter className="text-sm text-muted-foreground">
                {t('habitsCount', { count: habits.length })} 
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

    