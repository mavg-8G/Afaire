
"use client";
import type { Activity, Category, Todo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, Trash2, Clock, CalendarDays, Repeat, CalendarPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppStore } from '@/hooks/use-app-store';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/contexts/language-context';
import { format, formatISO, isSameDay } from 'date-fns';
import { enUS, es, fr } from 'date-fns/locale';
import { generateICSContent, downloadFile } from '@/lib/ics-utils'; // Import ICS utilities

interface ActivityListItemProps {
  activity: Activity; // This can be a master activity or a generated instance
  category: Category | undefined;
  onEdit: () => void;
  onDelete: () => void;
  showDate?: boolean;
  instanceDate?: Date; // The specific date of this occurrence if it's a recurring instance
}

export default function ActivityListItem({ activity, category, onEdit, onDelete, showDate, instanceDate }: ActivityListItemProps) {
  const { updateActivity, toggleOccurrenceCompletion } = useAppStore();
  const { t, locale } = useTranslations();
  const dateLocale = locale === 'es' ? es : locale === 'fr' ? fr : enUS;

  const effectiveDate = instanceDate || new Date(activity.createdAt);
  const occurrenceDateKey = formatISO(effectiveDate, { representation: 'date' });

  const isCompletedForThisOccurrence = activity.isRecurringInstance
    ? !!activity.completedOccurrences?.[occurrenceDateKey]
    : !!activity.completed;

  const completedTodos = activity.todos.filter(t => t.completed).length;
  const totalTodos = activity.todos.length;

  const handleActivityCompletedChange = (completedValue: boolean) => {
    if (activity.isRecurringInstance && activity.masterActivityId && activity.originalInstanceDate) {
      toggleOccurrenceCompletion(activity.masterActivityId, activity.originalInstanceDate, completedValue);
    } else if (!activity.isRecurringInstance) {
      let updatedTodos = activity.todos;
      if (completedValue && activity.todos.length > 0) {
        updatedTodos = activity.todos.map(todo => ({ ...todo, completed: true }));
      }
      updateActivity(activity.id, { completed: completedValue, todos: updatedTodos as Todo[] });
    }
  };

  const handleAddToCalendar = () => {
    const icsContent = generateICSContent(activity, instanceDate);
    const filename = `${(activity.title || 'activity').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
    downloadFile(filename, icsContent);
  };

  return (
    <Card className={cn(
      "shadow-sm hover:shadow-md transition-shadow duration-150 ease-in-out",
      isCompletedForThisOccurrence && "bg-muted/50 opacity-75"
    )}>
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0">
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <Checkbox
            id={`activity-completed-${activity.id}-${occurrenceDateKey}`}
            checked={isCompletedForThisOccurrence}
            onCheckedChange={(checked) => handleActivityCompletedChange(Boolean(checked))}
            aria-labelledby={`activity-title-${activity.id}-${occurrenceDateKey}`}
          />
          <div className="flex flex-col flex-grow min-w-0">
            <CardTitle
              id={`activity-title-${activity.id}-${occurrenceDateKey}`}
              className={cn(
                "text-sm font-medium leading-tight truncate",
                isCompletedForThisOccurrence && "line-through text-muted-foreground"
              )}
              title={activity.title}
            >
              {activity.title}
            </CardTitle>
            {(showDate || activity.time || (activity.recurrence && activity.recurrence.type !== 'none')) && (
                <div className="flex flex-col mt-0.5">
                  {showDate && instanceDate && (
                    <div className={cn(
                      "flex items-center text-xs text-muted-foreground",
                      isCompletedForThisOccurrence && "text-muted-foreground/70"
                    )}>
                      <CalendarDays className="mr-1 h-3 w-3" />
                      {format(instanceDate, 'PPP', { locale: dateLocale })}
                    </div>
                  )}
                  {activity.time && (
                    <div className={cn(
                      "flex items-center text-xs text-muted-foreground",
                      isCompletedForThisOccurrence && "text-muted-foreground/70",
                      (showDate || (activity.recurrence && activity.recurrence.type !== 'none')) && "mt-0.5"
                    )}>
                      <Clock className="mr-1 h-3 w-3" />
                      {activity.time}
                    </div>
                  )}
                  {activity.recurrence && activity.recurrence.type !== 'none' && !activity.isRecurringInstance && (
                     <div className={cn(
                      "flex items-center text-xs text-muted-foreground",
                      isCompletedForThisOccurrence && "text-muted-foreground/70",
                       (showDate || activity.time) && "mt-0.5"
                    )}>
                      <Repeat className="mr-1 h-3 w-3" />
                      <span>{t(`recurrence${activity.recurrence.type.charAt(0).toUpperCase() + activity.recurrence.type.slice(1)}` as any)}</span>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
        <div className="flex items-center flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={handleAddToCalendar} className="h-7 w-7">
            <CalendarPlus className="h-4 w-4" />
            <span className="sr-only">{t('addToCalendarSr')}</span>
          </Button>
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
      {(category || totalTodos > 0) && (
        <CardContent className="px-3 pt-1 pb-2 pl-9">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            {category && (
              <Badge variant={isCompletedForThisOccurrence ? "outline" : "secondary"} className="text-xs py-0.5 px-1.5">
                {category.icon && <category.icon className="mr-1 h-3 w-3" />}
                {category.name}
              </Badge>
            )}
            {totalTodos > 0 && !activity.isRecurringInstance && (
              <p className={cn("text-xs", isCompletedForThisOccurrence ? "text-muted-foreground" : "text-muted-foreground")}>
                {t('todosCompleted', { completed: completedTodos, total: totalTodos })}
              </p>
            )}
          </div>
          {totalTodos === 0 && !activity.isRecurringInstance && !category && !activity.time && !showDate && (
            <p className={cn("text-xs mt-1", isCompletedForThisOccurrence ? "text-muted-foreground/80" : "text-muted-foreground")}>
              {t('noDetailsAvailable')}
            </p>
          )}
          {totalTodos === 0 && !activity.isRecurringInstance && (category || activity.time || showDate) && (
            <p className={cn("text-xs mt-1", isCompletedForThisOccurrence ? "text-muted-foreground/80" : "text-muted-foreground")}>
              {t('noTodosForThisActivity')}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
