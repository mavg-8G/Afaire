
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
import type { Category } from '@/lib/types';
import { Trash2, PlusCircle, Edit3, XCircle, ArrowLeft } from 'lucide-react';
// AppHeader might be removed if it's global in layout and not specifically needed here
// import AppHeader from '@/components/layout/app-header'; 
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

const categoryFormSchema = z.object({
  name: z.string().min(1, "Category name is required."),
  iconName: z.string().min(1, "Icon name is required (e.g., Home, Coffee)."),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

export default function ManageCategoriesPage() {
  const { categories, addCategory, updateCategory, deleteCategory } = useAppStore();
  const { t } = useTranslations();
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      iconName: "",
    },
  });

  useEffect(() => {
    if (editingCategory) {
      form.reset({
        name: editingCategory.name,
        iconName: editingCategory.iconName,
      });
    } else {
      form.reset({ name: "", iconName: "" });
    }
  }, [editingCategory, form]);

  const onSubmit = (data: CategoryFormData) => {
    if (editingCategory) {
      updateCategory(editingCategory.id, { name: data.name, iconName: data.iconName });
      setEditingCategory(null);
    } else {
      addCategory(data.name, data.iconName);
    }
    form.reset();
  };

  const handleDeleteCategory = (categoryId: string) => {
    deleteCategory(categoryId);
    setCategoryToDelete(null);
    if (editingCategory?.id === categoryId) {
      setEditingCategory(null);
      form.reset();
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    form.reset();
  };
  
  const iconNameDescKey = t('iconNameDescriptionLink');
  const linkPart = `<a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" class="underline text-primary">lucide.dev/icons</a>`;
  const iconNameDescription = iconNameDescKey.replace('<a>lucide.dev/icons</a>', linkPart);

  return (
    <div className="flex flex-col flex-grow min-h-screen">
      {/* <AppHeader /> */}
      <main className="flex-grow container mx-auto py-8">
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
                          <Input placeholder="e.g., Fitness, Gimnasio" {...field} />
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
                          <Input placeholder="e.g., Dumbbell, Coffee, BookOpen" {...field} />
                        </FormControl>
                        <div className="text-[0.8rem] text-muted-foreground" dangerouslySetInnerHTML={{ __html: iconNameDescription }} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex space-x-2">
                    <Button type="submit" className="flex-grow">
                      {editingCategory ? <Edit3 className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />}
                      {editingCategory ? t('saveChanges') : t('addCategory')}
                    </Button>
                    {editingCategory && (
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
              <CardTitle>{t('existingCategories')}</CardTitle>
              <CardDescription>{t('viewEditManageCategories')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {categories.length > 0 ? (
                <ScrollArea className="h-[calc(100vh-32rem)] sm:h-[calc(100vh-30rem)] pr-1"> 
                  <ul className="space-y-3">
                    {categories.map((category) => (
                      <li key={category.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm">
                        <div className="flex items-center gap-3">
                          <category.icon className="h-6 w-6 text-primary" />
                          <span className="font-medium">{category.name}</span>
                        </div>
                        <div className="flex items-center">
                          <Button variant="ghost" size="icon" onClick={() => handleEditCategory(category)} className="text-primary hover:text-primary/80">
                            <Edit3 className="h-5 w-5" />
                            <span className="sr-only">{t('editCategory')}</span>
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
                                  {t('confirmDeleteCategoryDescription', { categoryName: category.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setCategoryToDelete(null)}>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>
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
                <p className="text-sm text-muted-foreground text-center py-4">{t('noCategoriesYet')}</p>
              )}
            </CardContent>
             {categories.length > 0 && (
              <CardFooter className="text-sm text-muted-foreground">
                {t('categoriesCount', { count: categories.length })}
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
