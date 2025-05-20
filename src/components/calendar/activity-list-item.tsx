
"use client";
import type { Activity, Category, Todo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, Trash2, Clock, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppStore } from '@/hooks/use-app-store';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/contexts/language-context';
import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';

interface ActivityListItemProps {
  activity: Activity;
  category: Category | undefined;
  onEdit: () => void;
  onDelete: () => void;
  showDate?: boolean;
}

export default function ActivityListItem({ activity, category, onEdit, onDelete, showDate }: ActivityListItemProps) {
  const { updateActivity } = useAppStore();
  const { t, locale } = useTranslations();
  const dateLocale = locale === 'es' ? es : enUS;
  const completedTodos = activity.todos.filter(t => t.completed).length;
  const totalTodos = activity.todos.length;

  const handleActivityCompletedChange = (completed: boolean) => {
    if (completed) {
      const updatedTodos = activity.todos.map(todo => ({ ...todo, completed: true }));
      updateActivity(activity.id, { completed, todos: updatedTodos as Todo[] });
    } else {
      updateActivity(activity.id, { completed });
    }
  };

  return (
    <Card className={cn(
      "shadow-sm hover:shadow-md transition-shadow duration-150 ease-in-out",
      activity.completed && "bg-muted/50 opacity-75"
    )}>
      <CardHeader className="flex flex-row items-start justify-between pb-2 pt-3 px-4 space-y-0">
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <Checkbox
            id={`activity-completed-${activity.id}`}
            checked={!!activity.completed}
            onCheckedChange={(checked) => handleActivityCompletedChange(Boolean(checked))}
            aria-labelledby={`activity-title-${activity.id}`}
            className="mt-1"
          />
          <div className="flex flex-col flex-grow min-w-0">
            <CardTitle
              id={`activity-title-${activity.id}`}
              className={cn(
                "text-base font-medium leading-tight truncate",
                activity.completed && "line-through text-muted-foreground"
              )}
              title={activity.title}
            >
              {activity.title}
            </CardTitle>
            {(showDate || activity.time) && (
                <div className="flex flex-col mt-0.5">
                  {showDate && (
                    <div className={cn(
                      "flex items-center text-xs text-muted-foreground",
                      activity.completed && "text-muted-foreground/70"
                    )}>
                      <CalendarDays className="mr-1 h-3 w-3" />
                      {format(new Date(activity.createdAt), 'MMM d, yyyy', { locale: dateLocale })}
                    </div>
                  )}
                  {activity.time && (
                    <div className={cn(
                      "flex items-center text-xs text-muted-foreground",
                      activity.completed && "text-muted-foreground/70",
                      showDate && "mt-0.5" // Add a little space if date is also shown
                    )}>
                      <Clock className="mr-1 h-3 w-3" />
                      {activity.time}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
        <div className="flex items-center flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7">
            <Edit3 className="h-4 w-4" />
            <span className="sr-only">{t('editActivitySr')}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">{t('deleteActivitySr')}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pl-11">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {category && (
            <Badge variant={activity.completed ? "outline" : "secondary"} className="text-xs py-0.5 px-1.5">
              {category.icon && <category.icon className="mr-1 h-3 w-3" />}
              {category.name}
            </Badge>
          )}
          {totalTodos > 0 && (
            <p className={cn("text-xs", activity.completed ? "text-muted-foreground" : "text-muted-foreground")}>
              {t('todosCompleted', { completed: completedTodos, total: totalTodos })}
            </p>
          )}
        </div>
         {totalTodos === 0 && !category && !activity.time && !showDate && (
          <p className={cn("text-xs mt-1", activity.completed ? "text-muted-foreground/80" : "text-muted-foreground")}>
            {t('noDetailsAvailable')}
          </p>
        )}
         {totalTodos === 0 && (category || activity.time || showDate) && ( // Simplified logic for this message
          <p className={cn("text-xs mt-1", activity.completed ? "text-muted-foreground/80" : "text-muted-foreground")}>
            {t('noTodosForThisActivity')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
