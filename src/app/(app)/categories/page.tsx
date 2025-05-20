
"use client";
import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAppStore } from '@/hooks/use-app-store';
import { Trash2, PlusCircle } from 'lucide-react';
import AppHeader from '@/components/layout/app-header'; // Assuming AppHeader is generic enough or you might want a specific one
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


const categoryFormSchema = z.object({
  name: z.string().min(1, "Category name is required."),
  iconName: z.string().min(1, "Icon name is required (e.g., Home, Coffee)."),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

export default function ManageCategoriesPage() {
  const { categories, addCategory, deleteCategory } = useAppStore();
  const [categoryToDelete, setCategoryToDelete] = React.useState<string | null>(null);

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      iconName: "",
    },
  });

  const onSubmit = (data: CategoryFormData) => {
    addCategory(data.name, data.iconName);
    form.reset();
  };

  const handleDeleteCategory = (categoryId: string) => {
    deleteCategory(categoryId);
    setCategoryToDelete(null);
  };

  return (
    <div className="flex flex-col flex-grow min-h-screen">
      <AppHeader />
      <main className="flex-grow container mx-auto py-8">
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Add New Category</CardTitle>
              <CardDescription>Create a new category for your activities.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Fitness" {...field} />
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
                        <FormLabel>Icon Name (from Lucide)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Dumbbell, Coffee, BookOpen" {...field} />
                        </FormControl>
                        <FormDescription>
                          Enter a PascalCase icon name from <a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" className="underline text-primary">lucide.dev/icons</a>.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Add Category
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="shadow-lg flex flex-col">
            <CardHeader>
              <CardTitle>Existing Categories</CardTitle>
              <CardDescription>View and manage your current categories.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              {categories.length > 0 ? (
                <ScrollArea className="h-[calc(100vh-26rem)] sm:h-[calc(100vh-24rem)] pr-1">
                  <ul className="space-y-3">
                    {categories.map((category) => (
                      <li key={category.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm">
                        <div className="flex items-center gap-3">
                          <category.icon className="h-6 w-6 text-primary" />
                          <span className="font-medium">{category.name}</span>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action will delete the category "{category.name}". 
                                Activities using this category will no longer be associated with it.
                                This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No categories added yet. Use the form to add your first category.</p>
              )}
            </CardContent>
             {categories.length > 0 && (
              <CardFooter className="text-sm text-muted-foreground">
                You have {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}.
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
