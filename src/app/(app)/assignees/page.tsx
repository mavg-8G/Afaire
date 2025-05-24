
"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from "react-hook-form";
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
} from "@/components/ui/form";
import { useAppStore } from '@/hooks/use-app-store';
import type { Assignee } from '@/lib/types';
import { Trash2, PlusCircle, Edit3, XCircle, ArrowLeft, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from '@/contexts/language-context';

const assigneeFormSchema = z.object({
  name: z.string().min(1, "Assignee name is required."),
});

type AssigneeFormData = z.infer<typeof assigneeFormSchema>;

export default function ManageAssigneesPage() {
  const { assignees, addAssignee, updateAssignee, deleteAssignee } = useAppStore();
  const { t } = useTranslations();
  const [assigneeToDelete, setAssigneeToDelete] = useState<string | null>(null);
  const [editingAssignee, setEditingAssignee] = useState<Assignee | null>(null);

  const form = useForm<AssigneeFormData>({
    resolver: zodResolver(assigneeFormSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (editingAssignee) {
      form.reset({
        name: editingAssignee.name,
      });
    } else {
      form.reset({ name: "" });
    }
  }, [editingAssignee, form]);

  const onSubmit = (data: AssigneeFormData) => {
    if (editingAssignee) {
      updateAssignee(editingAssignee.id, data.name);
      setEditingAssignee(null);
    } else {
      addAssignee(data.name);
    }
    form.reset({ name: "" });
  };

  const handleDeleteAssignee = (assigneeId: string) => {
    deleteAssignee(assigneeId);
    setAssigneeToDelete(null);
    if (editingAssignee?.id === assigneeId) {
      setEditingAssignee(null);
      form.reset({ name: "" });
    }
  };

  const handleEditAssignee = (assignee: Assignee) => {
    setEditingAssignee(assignee);
  };

  const handleCancelEdit = () => {
    setEditingAssignee(null);
    form.reset({ name: "" });
  };

  return (
    <div className="flex flex-col flex-grow min-h-screen">
      <main className="flex-grow container mx-auto py-8 px-4">
        <div className="mb-6 flex justify-start">
          <Link href="/" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToCalendar')}
            </Button>
          </Link>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>{editingAssignee ? t('editAssignee') : t('addNewAssignee')}</CardTitle>
              <CardDescription>
                {editingAssignee ? t('updateAssigneeDetails') : t('createAssigneeDescription')}
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
                        <FormLabel>{t('assigneeNameLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('assigneeNamePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex space-x-2">
                    <Button type="submit" className="flex-grow">
                      {editingAssignee ? <Edit3 className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />}
                      {editingAssignee ? t('saveChanges') : t('addNewAssignee')}
                    </Button>
                    {editingAssignee && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit}>
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
              <CardTitle>{t('existingAssignees')}</CardTitle>
              <CardDescription>{t('viewEditManageAssignees')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {assignees.length > 0 ? (
                <ScrollArea className="h-full pr-1"> 
                  <ul className="space-y-3">
                    {assignees.map((assignee) => (
                      <li key={assignee.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-primary" />
                          <span className="font-medium">{assignee.name}</span>
                        </div>
                        <div className="flex items-center">
                          <Button variant="ghost" size="icon" onClick={() => handleEditAssignee(assignee)} className="text-primary hover:text-primary/80">
                            <Edit3 className="h-5 w-5" />
                            <span className="sr-only">{t('editAssignee')}</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                                <Trash2 className="h-5 w-5" />
                                 <span className="sr-only">{t('delete')}</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('confirmDeleteAssigneeDescription', { assigneeName: assignee.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setAssigneeToDelete(null)}>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAssignee(assignee.id)}>
                                  {t('delete')}
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
                <p className="text-sm text-muted-foreground text-center py-4">{t('noAssigneesYet')}</p>
              )}
            </CardContent>
             {assignees.length > 0 && (
              <CardFooter className="text-sm text-muted-foreground">
                {t('assigneesCount', { count: assignees.length })}
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
