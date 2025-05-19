
"use client";
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Edit, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Activity } from '@/lib/types';
import { useAppStore } from '@/hooks/use-app-store';
import TodoItem from './todo-item';
import ActivityModal from '@/components/forms/activity-modal';

interface ActivityCardProps {
  activity: Activity;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, activityId: string) => void;
}

export default function ActivityCard({ activity, onDragStart }: ActivityCardProps) {
  const { getCategoryById, addTodoToActivity, deleteActivity } = useAppStore();
  const category = getCategoryById(activity.categoryId);
  const [newTodoText, setNewTodoText] = useState('');
  const [isEditingActivity, setIsEditingActivity] = useState(false);

  const handleAddTodo = () => {
    if (newTodoText.trim()) {
      addTodoToActivity(activity.id, newTodoText.trim());
      setNewTodoText('');
    }
  };

  const handleNewTodoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddTodo();
    }
  };

  return (
    <>
      <Card 
        className="mb-4 shadow-md hover:shadow-lg transition-shadow duration-200 bg-card"
        draggable
        onDragStart={(e) => onDragStart(e, activity.id)}
        id={`activity-${activity.id}`}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
          <CardTitle className="text-base font-semibold leading-none tracking-tight">{activity.title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditingActivity(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Activity
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteActivity(activity.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Activity
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {category && (
            <Badge variant="secondary" className="mb-2 text-xs">
              {category.icon && <category.icon className="mr-1 h-3 w-3" />}
              {category.name}
            </Badge>
          )}
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {activity.todos.length > 0 ? (
              activity.todos.map(todo => (
                <TodoItem key={todo.id} todo={todo} activityId={activity.id} />
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No todos yet. Add some!</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="px-4 pb-4 pt-2">
          <div className="flex w-full items-center space-x-2">
            <Input
              type="text"
              placeholder="Add a new todo..."
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={handleNewTodoKeyDown}
              className="h-9 text-sm flex-grow"
            />
            <Button type="button" size="sm" onClick={handleAddTodo} variant="outline" className="h-9">
              <PlusCircle className="h-4 w-4" />
              <span className="sr-only">Add</span>
            </Button>
          </div>
        </CardFooter>
      </Card>
      {isEditingActivity && (
        <ActivityModal
          isOpen={isEditingActivity}
          onClose={() => setIsEditingActivity(false)}
          activity={activity}
        />
      )}
    </>
  );
}
