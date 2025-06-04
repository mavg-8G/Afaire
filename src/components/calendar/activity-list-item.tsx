
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
import { useRouter } from 'next/navigation'; // Import useRouter for navigation

interface ActivityListItemProps {
  activity: Activity; // This can be a master activity or a generated instance
  category: Category | undefined;
  onEdit: () => void; // Kept for master activity edit action
  onDelete: () => void; // Kept for master activity delete action
  showDate?: boolean;
  instanceDate?: Date; // The specific date of this occurrence if it's a recurring instance
}

export default function ActivityListItem({ activity, category, onEdit, onDelete, showDate, instanceDate }: ActivityListItemProps) {
  const { toggleOccurrenceCompletion } = useAppStore(); // Use toggleOccurrenceCompletion
  const { t, locale } = useTranslations();
  const router = useRouter();
  const dateLocale = locale === 'es' ? es : locale === 'fr' ? fr : enUS;

  const effectiveDate = instanceDate || new Date(activity.createdAt);
  const occurrenceDateKey = formatISO(effectiveDate, { representation: 'date' });

  // Always derive completion status from the completedOccurrences map for the specific date
  const isCompletedForThisOccurrence = !!activity.completedOccurrences?.[occurrenceDateKey];

  const todosForThisInstance = activity.todos || [];
  const totalTodos = todosForThisInstance.length;
  const completedTodos = todosForThisInstance.filter(t => t.completed).length;

  const handleActivityCompletedChange = (completedValue: boolean) => {
    const targetActivityId = activity.masterActivityId || activity.id;
    // Use effectiveDate's timestamp (which is derived from instanceDate or activity.createdAt)
    const targetOccurrenceDateTimestamp = effectiveDate.getTime(); 
    
    toggleOccurrenceCompletion(targetActivityId, targetOccurrenceDateTimestamp, Boolean(completedValue));

    // Note: Logic for auto-completing todos when the parent activity/occurrence is marked complete
    // is not handled here. That would require further calls to updateTodoInActivity for each todo,
    // or a backend change to handle it atomically. This change focuses on making sure the
    // ActivityOccurrence itself is correctly updated.
  };

  const handleEditClick = () => {
    // The onEdit prop passed from ActivityCalendarView already handles finding master activity ID
    onEdit();
  };

  const handleAddToCalendar = () => {
    const icsContent = generateICSContent(activity, effectiveDate);
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
            onCheckedChange={handleActivityCompletedChange} // Directly pass the boolean value
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
            {(showDate || activity.time || (activity.recurrence && activity.recurrence.type !== 'none' && !activity.isRecurringInstance)) && (
                <div className="flex flex-col mt-0.5">
                  {showDate && effectiveDate && (
                    <div className={cn(
                      "flex items-center text-xs text-muted-foreground",
                      isCompletedForThisOccurrence && "text-muted-foreground/70"
                    )}>
                      <CalendarDays className="mr-1 h-3 w-3" />
                      {format(effectiveDate, 'PPP', { locale: dateLocale })}
                    </div>
                  )}
                  {activity.time && (
                    <div className={cn(
                      "flex items-center text-xs text-muted-foreground",
                      isCompletedForThisOccurrence && "text-muted-foreground/70",
                      (showDate || (activity.recurrence && activity.recurrence.type !== 'none' && !activity.isRecurringInstance)) && "mt-0.5"
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
          <Button variant="ghost" size="icon" onClick={handleEditClick} className="h-7 w-7">
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
            {totalTodos > 0 && (
              <p className={cn("text-xs", isCompletedForThisOccurrence ? "text-muted-foreground" : "text-muted-foreground")}>
                {t('todosCompleted', { completed: completedTodos, total: totalTodos })}
              </p>
            )}
          </div>
          {totalTodos === 0 && (category || activity.time || showDate) && (
            <p className={cn("text-xs mt-1", isCompletedForThisOccurrence ? "text-muted-foreground/80" : "text-muted-foreground")}>
              {t('noTodosForThisActivity')}
            </p>
          )}
          {totalTodos === 0 && !category && !activity.time && !showDate && (
            <p className={cn("text-xs mt-1", isCompletedForThisOccurrence ? "text-muted-foreground/80" : "text-muted-foreground")}>
              {t('noDetailsAvailable')}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
    
