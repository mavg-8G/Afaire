
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAppStore } from '@/hooks/use-app-store';
import type { Category, AppMode } from '@/lib/types';
import { Trash2, PlusCircle, Edit3, XCircle, ArrowLeft, Loader2 } from 'lucide-react';
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
import { FormDescription as ShadcnFormDescription } from "@/components/ui/form"; // Aliased to avoid conflict


const categoryFormSchema = z.object({
  name: z.string().min(1, "Category name is required."),
  iconName: z.string().min(1, "Icon name is required (e.g., Home, Coffee)."),
  mode: z.enum(['personal', 'work', 'all']).default('all'),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

export default function ManageCategoriesPage() {
  const { categories: filteredCategories, addCategory, updateCategory, deleteCategory, appMode, isLoading: isAppLoading, toast } = useAppStore();
  const { t } = useTranslations();
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null); // Changed to number
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      iconName: "",
      mode: appMode, 
    },
  });

  useEffect(() => {
    if (editingCategory) {
      form.reset({
        name: editingCategory.name,
        iconName: editingCategory.iconName,
        mode: editingCategory.mode || appMode, 
      });
    } else {
      form.reset({ name: "", iconName: "", mode: appMode });
    }
  }, [editingCategory, form, appMode]);

  const onSubmit = async (data: CategoryFormData) => {
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, { name: data.name, iconName: data.iconName, mode: data.mode }, editingCategory);
        setEditingCategory(null);
      } else {
        await addCategory(data.name, data.iconName, data.mode);
      }
      form.reset({ name: "", iconName: "", mode: appMode });
    } catch (error) {
      // Error toast is handled by AppProvider
      console.error("Failed to save category:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    setIsSubmitting(true);
    try {
      await deleteCategory(categoryId);
      setCategoryToDelete(null);
      if (editingCategory?.id === categoryId) {
        setEditingCategory(null);
        form.reset({ name: "", iconName: "", mode: appMode });
      }
    } catch (error) {
      // Error toast is handled by AppProvider
      console.error("Failed to delete category:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    form.reset({ name: "", iconName: "", mode: appMode });
  };
  
  const iconNameDescKey = t('iconNameDescriptionLink');
  const linkPart = `<a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" class="underline text-primary">lucide.dev/icons</a>`;
  const iconNameDescription = iconNameDescKey.replace('<a>lucide.dev/icons</a>', linkPart);

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
              <CardTitle>{editingCategory ? t('editCategory') : t('addNewCategory')}</CardTitle>
              <CardDescription>
                {editingCategory ? t('updateCategoryDetails') : t('createCategoryDescription')}
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
                        <FormLabel>{t('categoryName')}</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Fitness, Gimnasio" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="iconName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('iconName')}</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Dumbbell, Coffee, BookOpen" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <ShadcnFormDescription dangerouslySetInnerHTML={{ __html: iconNameDescription }} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mode"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>{t('categoryMode')}</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-4"
                            disabled={isSubmitting}
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="personal" />
                              </FormControl>
                              <FormLabel className="font-normal">{t('modePersonal')}</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="work" />
                              </FormControl>
                              <FormLabel className="font-normal">{t('modeWork')}</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="all" />
                              </FormControl>
                              <FormLabel className="font-normal">{t('modeAll')}</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex space-x-2">
                    <Button type="submit" className="flex-grow" disabled={isSubmitting || isAppLoading}>
                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (editingCategory ? <Edit3 className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />)}
                      {editingCategory ? t('saveChanges') : t('addCategory')}
                    </Button>
                    {editingCategory && (
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
              <CardTitle>{t('existingCategories')}</CardTitle>
              <CardDescription>{t('viewEditManageCategories')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {isAppLoading && <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin" /></div>}
              {!isAppLoading && filteredCategories.length > 0 ? (
                <ScrollArea className="h-full pr-1"> 
                  <ul className="space-y-3">
                    {filteredCategories.map((category) => (
                      <li key={category.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm">
                        <div className="flex items-center gap-3">
                          <category.icon className="h-6 w-6 text-primary" />
                          <span className="font-medium">{category.name}</span>
                           <span className="text-xs text-muted-foreground ml-1">
                            ({category.mode === 'all' ? t('modeAll') : category.mode === 'personal' ? t('modePersonal') : t('modeWork')})
                          </span>
                        </div>
                        <div className="flex items-center">
                          <Button variant="ghost" size="icon" onClick={() => handleEditCategory(category)} className="text-primary hover:text-primary/80" disabled={isSubmitting}>
                            <Edit3 className="h-5 w-5" />
                            <span className="sr-only">{t('editCategory')}</span>
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
                                <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('confirmDeleteCategoryDescription', { categoryName: category.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setCategoryToDelete(null)}>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCategory(category.id)} disabled={isSubmitting}>
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
                !isAppLoading && <p className="text-sm text-muted-foreground text-center py-4">{t('noCategoriesYet')}</p>
              )}
            </CardContent>
             {!isAppLoading && filteredCategories.length > 0 && (
              <CardFooter className="text-sm text-muted-foreground">
                {t('categoriesCount', { count: filteredCategories.length })}
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

