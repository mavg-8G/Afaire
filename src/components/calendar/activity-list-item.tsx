
"use client";
import type { Activity, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ActivityListItemProps {
  activity: Activity;
  category: Category | undefined;
  onEdit: () => void;
  onDelete: () => void; // New prop
}

export default function ActivityListItem({ activity, category, onEdit, onDelete }: ActivityListItemProps) {
  const completedTodos = activity.todos.filter(t => t.completed).length;
  const totalTodos = activity.todos.length;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-150 ease-in-out">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4 space-y-0">
        <CardTitle className="text-base font-medium leading-tight">{activity.title}</CardTitle>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7 flex-shrink-0">
            <Edit3 className="h-4 w-4" />
            <span className="sr-only">Edit Activity</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete Activity</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {category && (
            <Badge variant="secondary" className="text-xs py-0.5 px-1.5">
              {category.icon && <category.icon className="mr-1 h-3 w-3" />}
              {category.name}
            </Badge>
          )}
          {totalTodos > 0 && (
            <p className="text-xs text-muted-foreground mt-1 sm:mt-0">
              {completedTodos} / {totalTodos} todos completed
            </p>
          )}
        </div>
         {totalTodos === 0 && !category && ( // Show if no category and no todos
          <p className="text-xs text-muted-foreground mt-1">
            No details available.
          </p>
        )}
         {totalTodos === 0 && category && ( // Show if category but no todos
          <p className="text-xs text-muted-foreground mt-1">
            No todos for this activity.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
