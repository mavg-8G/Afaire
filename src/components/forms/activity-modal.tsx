
"use client";
import React, { useState, useEffect, useCallback } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity, Todo } from '@/lib/types';
import CategorySelector from '@/components/shared/category-selector';
import { suggestTodos, type SuggestTodosInput } from '@/ai/flows/suggest-todos';
import { useToast } from '@/hooks/use-toast';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity?: Activity; // For editing
  initialDate?: Date; // For pre-filling date for new activities
}

const todoSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, "Todo text cannot be empty."),
  completed: z.boolean().optional(),
});

const activityFormSchema = z.object({
  title: z.string().min(1, "Activity title is required."),
  categoryId: z.string().min(1, "Category is required."),
  todos: z.array(todoSchema).optional(),
});

type ActivityFormData = z.infer<typeof activityFormSchema>;

export default function ActivityModal({ isOpen, onClose, activity, initialDate }: ActivityModalProps) {
  const { addActivity, updateActivity, getCategoryById } = useAppStore();
  const { toast } = useToast();
  const [isSuggestingTodos, setIsSuggestingTodos] = useState(false);

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      title: "",
      categoryId: "",
      todos: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "todos",
  });

  useEffect(() => {
    if (activity) {
      form.reset({
        title: activity.title,
        categoryId: activity.categoryId,
        todos: activity.todos.map(t => ({ id: t.id, text: t.text, completed: t.completed })),
      });
    } else {
      form.reset({ title: "", categoryId: "", todos: [] });
    }
  }, [activity, form, isOpen]);

  const onSubmit = (data: ActivityFormData) => {
    const baseActivityData = {
      title: data.title,
      categoryId: data.categoryId,
      todos: data.todos?.map(t => ({ text: t.text })) || [],
    };

    if (activity) {
      const updatedTodos = data.todos?.map(t => ({
        id: t.id || '', 
        text: t.text,
        completed: t.completed || false
      })) || [];
      updateActivity(activity.id, { 
        title: data.title, 
        categoryId: data.categoryId, 
        todos: updatedTodos as Todo[] 
      });
      toast({ title: "Activity Updated", description: "Your activity has been successfully updated." });
    } else {
      let newActivityCreatedAt: number;
      if (initialDate) {
        newActivityCreatedAt = initialDate.getTime();
      } else {
        newActivityCreatedAt = new Date().getTime();
      }
      addActivity(baseActivityData, newActivityCreatedAt);
      toast({ title: "Activity Added", description: "Your new activity has been successfully added." });
    }
    onClose();
  };
  
  const handleSuggestTodos = async () => {
    const activityTitle = form.getValues("title");
    if (!activityTitle) {
      toast({ title: "Title Needed", description: "Please enter an activity title to get suggestions.", variant: "destructive" });
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
        toast({ title: "Todos Suggested", description: "AI has added some todo suggestions." });
      } else {
        toast({ title: "No Suggestions", description: "AI couldn't find any suggestions for this title." });
      }
    } catch (error) {
      console.error("Error suggesting todos:", error);
      toast({ title: "Suggestion Error", description: "Could not fetch todo suggestions.", variant: "destructive" });
    } finally {
      setIsSuggestingTodos(false);
    }
  };


  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{activity ? "Edit Activity" : "Add New Activity"}</DialogTitle>
          <DialogDescription>
            {activity ? "Update the details of your activity." : "Fill in the details for your new activity."}
            {initialDate && !activity && ` Activity will be for ${format(initialDate, "PPP")}.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto px-1 py-2 flex-grow">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Title</FormLabel>
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
                  <FormLabel>Category</FormLabel>
                  <CategorySelector
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select a category"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <FormLabel>Todos</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={handleSuggestTodos} disabled={isSuggestingTodos}>
                  {isSuggestingTodos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Suggest Todos
                </Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {fields.map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-2">
                    {activity && ( 
                       <FormField
                        control={form.control}
                        name={`todos.${index}.completed`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                               <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                id={`todo-completed-${index}`}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name={`todos.${index}.text`}
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl>
                            <Input placeholder="New todo item" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
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
                <PlusCircle className="mr-2 h-4 w-4" /> Add Todo
              </Button>
            </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{activity ? "Save Changes" : "Add Activity"}</Button>
          </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
// Helper function (ensure it's imported or defined if not already)
import { format } from 'date-fns';
