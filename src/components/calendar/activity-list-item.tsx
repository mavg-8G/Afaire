
"use client";
import type { Activity, Category, Todo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppStore } from '@/hooks/use-app-store';
import { cn } from '@/lib/utils';

interface ActivityListItemProps {
  activity: Activity;
  category: Category | undefined;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ActivityListItem({ activity, category, onEdit, onDelete }: ActivityListItemProps) {
  const { updateActivity } = useAppStore();
  const completedTodos = activity.todos.filter(t => t.completed).length;
  const totalTodos = activity.todos.length;

  const handleActivityCompletedChange = (completed: boolean) => {
    if (completed) {
      const updatedTodos = activity.todos.map(todo => ({ ...todo, completed: true }));
      updateActivity(activity.id, { completed, todos: updatedTodos as Todo[] });
    } else {
      // If unchecking the activity, only update the activity's completed status.
      // Todos retain their individual completion status.
      updateActivity(activity.id, { completed });
    }
  };

  return (
    <Card className={cn(
      "shadow-sm hover:shadow-md transition-shadow duration-150 ease-in-out",
      activity.completed && "bg-muted/50 opacity-75"
    )}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4 space-y-0">
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <Checkbox
            id={`activity-completed-${activity.id}`}
            checked={!!activity.completed}
            onCheckedChange={(checked) => handleActivityCompletedChange(Boolean(checked))}
            aria-labelledby={`activity-title-${activity.id}`}
          />
          <CardTitle 
            id={`activity-title-${activity.id}`}
            className={cn(
              "text-base font-medium leading-tight truncate",
              activity.completed && "line-through text-muted-foreground"
            )}
            title={activity.title} // Show full title on hover if truncated
          >
            {activity.title}
          </CardTitle>
        </div>
        <div className="flex items-center flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7">
            <Edit3 className="h-4 w-4" />
            <span className="sr-only">Edit Activity</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete Activity</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pl-11"> {/* Added pl-11 to align content with title after checkbox */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {category && (
            <Badge variant={activity.completed ? "outline" : "secondary"} className="text-xs py-0.5 px-1.5">
              {category.icon && <category.icon className="mr-1 h-3 w-3" />}
              {category.name}
            </Badge>
          )}
          {totalTodos > 0 && (
            <p className={cn("text-xs", activity.completed ? "text-muted-foreground" : "text-muted-foreground")}>
              {completedTodos} / {totalTodos} todos completed
            </p>
          )}
        </div>
         {totalTodos === 0 && !category && (
          <p className={cn("text-xs mt-1", activity.completed ? "text-muted-foreground/80" : "text-muted-foreground")}>
            No details available.
          </p>
        )}
         {totalTodos === 0 && category && (
          <p className={cn("text-xs mt-1", activity.completed ? "text-muted-foreground/80" : "text-muted-foreground")}>
            No todos for this activity.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
