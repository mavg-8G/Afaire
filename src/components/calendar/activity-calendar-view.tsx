
"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import { Calendar } from '@/components/ui/calendar';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity, RecurrenceRule } from '@/lib/types';
import {
  isSameDay, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval,
  addDays, addWeeks, addMonths, getDay, getDate as getDayOfMonthFn, parseISO, formatISO,
  isAfter, isBefore, isEqual, setDate as setDayOfMonth // Added setDate
} from 'date-fns';
// ActivityModal import removed
import ActivityListItem from './activity-list-item';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Loader2, CheckCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/contexts/language-context';
import { enUS, es, fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';

type ViewMode = 'daily' | 'weekly' | 'monthly';

// Helper functions moved outside the component
const startOfDayUtil = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDayUtil = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

function generateRecurringInstances(
  masterActivity: Activity,
  viewStartDate: Date,
  viewEndDate: Date
): Activity[] {
  if (!masterActivity.recurrence || masterActivity.recurrence.type === 'none') {
    const activityDate = new Date(masterActivity.createdAt);
    if (isWithinInterval(activityDate, { start: viewStartDate, end: viewEndDate }) || isSameDay(activityDate, viewStartDate) || isSameDay(activityDate, viewEndDate)) {
       return [{
        ...masterActivity,
        isRecurringInstance: false,
        originalInstanceDate: masterActivity.createdAt,
        masterActivityId: masterActivity.id
      }];
    }
    return [];
  }

  const instances: Activity[] = [];
  const recurrence = masterActivity.recurrence;
  let currentDate = new Date(masterActivity.createdAt);

  if (isBefore(currentDate, viewStartDate)) {
      if (recurrence.type === 'daily') {
          currentDate = viewStartDate;
      } else if (recurrence.type === 'weekly' && recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
          let tempDate = startOfWeek(viewStartDate, { weekStartsOn: 0 });
          while(isBefore(tempDate, new Date(masterActivity.createdAt)) || !recurrence.daysOfWeek.includes(getDay(tempDate))) {
              tempDate = addDays(tempDate, 1);
              if (isAfter(tempDate, viewEndDate) && isAfter(tempDate, currentDate)) break;
          }
          currentDate = tempDate;
      } else if (recurrence.type === 'monthly' && recurrence.dayOfMonth) {
          let tempMasterStartMonthDay = setDayOfMonth(new Date(masterActivity.createdAt), recurrence.dayOfMonth);
          if (isBefore(tempMasterStartMonthDay, new Date(masterActivity.createdAt))) {
              tempMasterStartMonthDay = addMonths(tempMasterStartMonthDay, 1);
          }
          currentDate = setDayOfMonth(viewStartDate, recurrence.dayOfMonth);
          if (isBefore(currentDate, viewStartDate)) currentDate = addMonths(currentDate,1);
          if (isBefore(currentDate, tempMasterStartMonthDay)) {
             currentDate = tempMasterStartMonthDay;
          }
      }
  }

  const seriesEndDate = recurrence.endDate ? new Date(recurrence.endDate) : null;
  let iterations = 0;
  const maxIterations = 366 * 2;

  while (iterations < maxIterations && isBefore(currentDate, addDays(viewEndDate,1))) {
    iterations++;
    if (seriesEndDate && isAfter(currentDate, seriesEndDate)) break;
    if (isBefore(currentDate, new Date(masterActivity.createdAt))) {
        if (recurrence.type === 'daily') currentDate = addDays(currentDate, 1);
        else if (recurrence.type === 'weekly') currentDate = addWeeks(currentDate, 1);
        else if (recurrence.type === 'monthly') currentDate = addMonths(currentDate, 1);
        else break;
        continue;
    }

    let isValidOccurrence = false;
    switch (recurrence.type) {
      case 'daily':
        isValidOccurrence = true;
        break;
      case 'weekly':
        if (recurrence.daysOfWeek?.includes(getDay(currentDate))) {
          isValidOccurrence = true;
        }
        break;
      case 'monthly':
        if (recurrence.dayOfMonth && getDayOfMonthFn(currentDate) === recurrence.dayOfMonth) {
          isValidOccurrence = true;
        }
        break;
    }

    if (isValidOccurrence && (isWithinInterval(currentDate, { start: viewStartDate, end: viewEndDate }) || isSameDay(currentDate, viewStartDate) || isSameDay(currentDate, viewEndDate))) {
      const occurrenceDateKey = formatISO(currentDate, { representation: 'date' });
      instances.push({
        ...masterActivity,
        id: `${masterActivity.id}_${currentDate.getTime()}`, // Unique ID for instance
        isRecurringInstance: true,
        originalInstanceDate: currentDate.getTime(),
        masterActivityId: masterActivity.id,
        completed: !!masterActivity.completedOccurrences?.[occurrenceDateKey],
        // Create new todo instances for each recurring activity instance
        todos: masterActivity.todos.map(todo => ({...todo, id: uuidv4(), completed: false})),
      });
    }

    if (recurrence.type === 'daily') {
      currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'weekly') {
      // For weekly, we just advance by one day and rely on daysOfWeek check
      currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'monthly') {
      // For monthly, advance by one day, the check for dayOfMonth handles it
      currentDate = addDays(currentDate,1);
    } else {
      break; // Should not happen
    }
  }
  return instances;
}


export default function ActivityCalendarView() {
  const { getRawActivities, getCategoryById, deleteActivity } = useAppStore();
  const { toast } = useToast();
  const { t, locale } = useTranslations();
  const router = useRouter(); // Initialize useRouter

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentDisplayMonth, setCurrentDisplayMonth] = useState<Date | undefined>(undefined);
  // ActivityModal related states removed
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  // dateForModal removed


  const dateLocale = useMemo(() => {
    if (locale === 'es') return es;
    if (locale === 'fr') return fr;
    return enUS;
  }, [locale]);

  useEffect(() => {
    setHasMounted(true);
    const today = new Date();
    setSelectedDate(today);
    setCurrentDisplayMonth(today);
    // setDateForModal(today) removed;
  }, []);


  const { activitiesForView, allActivitiesInViewCompleted } = useMemo(() => {
    if (!selectedDate || !hasMounted) return { activitiesForView: [], allActivitiesInViewCompleted: false };
    const rawActivities = getRawActivities();
    let viewStartDate: Date, viewEndDate: Date;

    if (viewMode === 'daily') {
      viewStartDate = startOfDayUtil(selectedDate);
      viewEndDate = endOfDayUtil(selectedDate);
    } else if (viewMode === 'weekly') {
      viewStartDate = startOfWeek(selectedDate, { locale: dateLocale });
      viewEndDate = endOfWeek(selectedDate, { locale: dateLocale });
    } else { // monthly
      viewStartDate = startOfMonth(selectedDate);
      viewEndDate = endOfMonth(selectedDate);
    }

    let allDisplayActivities: Activity[] = [];
    rawActivities.forEach(masterActivity => {
      if (masterActivity.recurrence && masterActivity.recurrence.type !== 'none') {
        allDisplayActivities.push(...generateRecurringInstances(masterActivity, viewStartDate, viewEndDate));
      } else { // Non-recurring
        const activityDate = new Date(masterActivity.createdAt);
         if (isWithinInterval(activityDate, { start: viewStartDate, end: viewEndDate }) || isSameDay(activityDate, viewStartDate) || isSameDay(activityDate, viewEndDate) ) {
           allDisplayActivities.push({
            ...masterActivity,
            isRecurringInstance: false, // Explicitly false
            originalInstanceDate: masterActivity.createdAt, // Use createdAt as original instance
            masterActivityId: masterActivity.id,
          });
        }
      }
    });

    // For daily view, filter again to ensure only activities for the exact selectedDate are shown
    // This is important because generateRecurringInstances might include instances from the start/end of the week/month range
    if (viewMode === 'daily') {
      allDisplayActivities = allDisplayActivities.filter(activity =>
        activity.originalInstanceDate && isSameDay(new Date(activity.originalInstanceDate), selectedDate)
      );
    }
    
    // Sort logic
    const sortedActivities = allDisplayActivities.sort((a, b) => {
        // Determine completion status for this specific instance
        const aIsCompleted = a.isRecurringInstance && a.originalInstanceDate
            ? !!a.completedOccurrences?.[formatISO(new Date(a.originalInstanceDate), { representation: 'date' })]
            : !!a.completed;
        const bIsCompleted = b.isRecurringInstance && b.originalInstanceDate
            ? !!b.completedOccurrences?.[formatISO(new Date(b.originalInstanceDate), { representation: 'date' })]
            : !!b.completed;

        // 1. Sort by completion status (incomplete first)
        if (aIsCompleted !== bIsCompleted) {
            return aIsCompleted ? 1 : -1; // Completed items go to the bottom
        }

        // 2. Sort by time (activities with time first, then by time ascending)
        const aTime = a.time ? parseInt(a.time.replace(':', ''), 10) : Infinity;
        const bTime = b.time ? parseInt(b.time.replace(':', ''), 10) : Infinity;
        
        if (a.time && !b.time) return -1; // a (with time) comes before b (without time)
        if (!a.time && b.time) return 1;  // b (with time) comes before a (without time)
        
        if (a.time && b.time && aTime !== bTime) {
            return aTime - bTime; // Sort by time ascending
        }

        // 3. Sort by original instance date (earlier dates first)
        const aDate = a.originalInstanceDate ? new Date(a.originalInstanceDate).getTime() : new Date(a.createdAt).getTime();
        const bDate = b.originalInstanceDate ? new Date(b.originalInstanceDate).getTime() : new Date(b.createdAt).getTime();
        if (aDate !== bDate) {
            return aDate - bDate;
        }
        
        // 4. Fallback sort by title (alphabetical) for stability if all else is equal
        return a.title.localeCompare(b.title);
    });

    const allCompleted = sortedActivities.length > 0 && sortedActivities.every(act => {
      // Check completion of the specific instance
      const isInstanceCompleted = act.isRecurringInstance && act.originalInstanceDate
        ? !!act.completedOccurrences?.[formatISO(new Date(act.originalInstanceDate), { representation: 'date' })]
        : !!act.completed;

      if (!isInstanceCompleted) return false;
      // If it's a recurring instance, its todos are fresh copies, so they are not pre-completed
      // unless specifically handled after generation (which is not the case here).
      // For non-recurring, check its todos.
      if (!act.isRecurringInstance && act.todos && act.todos.length > 0) {
        return act.todos.every(todo => todo.completed);
      }
      // If recurring, its "main" completion implies completion for the chart
      // If non-recurring and no todos, its "main" completion is enough
      return true;
    });

    return { activitiesForView: sortedActivities, allActivitiesInViewCompleted: allCompleted };
  }, [getRawActivities, selectedDate, hasMounted, viewMode, dateLocale]);

  const dayEventCounts = useMemo(() => {
    if (!hasMounted || !currentDisplayMonth) return new Map<string, number>();
    const rawActivities = getRawActivities();
    const counts = new Map<string, number>();

    // Define the range for which to generate instances for dots
    // Typically, this covers the visible month plus potentially parts of prev/next month
    const displayRangeStart = startOfMonth(addMonths(currentDisplayMonth, -1)); // Include previous month
    const displayRangeEnd = endOfMonth(addMonths(currentDisplayMonth, 1));   // Include next month

    rawActivities.forEach(activity => {
      if (activity.recurrence && activity.recurrence.type !== 'none') {
        const instances = generateRecurringInstances(activity, displayRangeStart, displayRangeEnd);
        instances.forEach(inst => {
          if (inst.originalInstanceDate) {
            const dateKey = formatISO(new Date(inst.originalInstanceDate), { representation: 'date' });
            counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
          }
        });
      } else { // Non-recurring
        const activityDate = new Date(activity.createdAt);
        // Check if the non-recurring activity falls within the wider display range for dots
        if (isWithinInterval(activityDate, {start: displayRangeStart, end: displayRangeEnd})) {
          const dateKey = formatISO(activityDate, { representation: 'date' });
          counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
        }
      }
    });
    return counts;
  }, [getRawActivities, hasMounted, currentDisplayMonth]);

  const handleEditActivity = (activityInstanceOrMaster: Activity) => {
    const rawActivities = getRawActivities();
    const masterActivity = activityInstanceOrMaster.masterActivityId
      ? rawActivities.find(a => a.id === activityInstanceOrMaster.masterActivityId)
      : activityInstanceOrMaster;

    if (masterActivity) {
      let url = `/activity-editor?id=${masterActivity.id}`;
      if (activityInstanceOrMaster.isRecurringInstance && activityInstanceOrMaster.originalInstanceDate) {
        url += `&instanceDate=${activityInstanceOrMaster.originalInstanceDate}`;
      }
      router.push(url);
    }
  };

  const handleAddNewActivityGeneric = () => {
    let url = `/activity-editor`;
    if (selectedDate) {
      url += `?initialDate=${selectedDate.getTime()}`;
    }
    router.push(url);
  };


  const handleOpenDeleteConfirm = (activityInstanceOrMaster: Activity) => {
    const rawActivities = getRawActivities(); // Fetch fresh list
    // For deletion, we always target the master activity if it's a recurring series
    const masterActivity = activityInstanceOrMaster.masterActivityId
      ? rawActivities.find(a => a.id === activityInstanceOrMaster.masterActivityId)
      : activityInstanceOrMaster;

    if (masterActivity) {
      setActivityToDelete(masterActivity); // Set the master activity for deletion
    } else {
      // This case should ideally not happen if data is consistent
      console.warn("Could not find master activity for deletion", activityInstanceOrMaster);
      setActivityToDelete(activityInstanceOrMaster); // Fallback to deleting the instance if master not found
    }
  };

  const handleConfirmDelete = async () => {
    if (activityToDelete) {
      try {
        await deleteActivity(activityToDelete.id);
        // Success toast is handled by AppProvider's deleteActivity
      } catch (error) {
        // Error toast is handled by AppProvider's deleteActivity
        // Log error for debugging if needed, but AppProvider already does
        console.error("Failed to delete activity from ActivityCalendarView:", error);
      } finally {
        setActivityToDelete(null); // Close the dialog
      }
    }
  };

  // handleCloseModal removed

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && currentDisplayMonth) {
      const newSelectedMonthStart = startOfMonth(date);
      const currentDisplayMonthStart = startOfMonth(currentDisplayMonth);
      // Check if the month of the selected date is different from the current display month
      if (newSelectedMonthStart.getTime() !== currentDisplayMonthStart.getTime()) {
          setCurrentDisplayMonth(date); // Update display month to the month of the selected date
      }
    } else if (date) {
        // If currentDisplayMonth is undefined (e.g., on initial load after selection)
        setCurrentDisplayMonth(date);
    }
    // dateForModal removed
  };

  const handleTodayButtonClick = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentDisplayMonth(today); // Ensure calendar view also jumps to current month
    // dateForModal removed
  };

  const todayButtonFooter = (
    <div className="flex justify-center pt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTodayButtonClick}
      >
        {t('todayButton')}
      </Button>
    </div>
  );

  const getCardTitle = () => {
    if (!selectedDate) return t('loadingDate');
    if (viewMode === 'daily') {
      return t('activitiesForDate', { date: format(selectedDate, 'PPP', { locale: dateLocale }) });
    } else if (viewMode === 'weekly') {
      const weekStart = startOfWeek(selectedDate, { locale: dateLocale });
      const weekEnd = endOfWeek(selectedDate, { locale: dateLocale });
      return t('activitiesForWeek', {
        startDate: format(weekStart, 'MMM d', { locale: dateLocale }),
        endDate: format(weekEnd, 'MMM d, yyyy', { locale: dateLocale })
      });
    } else if (viewMode === 'monthly') {
      return t('activitiesForMonth', { month: format(selectedDate, 'MMMM yyyy', { locale: dateLocale }) });
    }
    return t('loadingDate'); // Fallback
  };


  if (!hasMounted || !selectedDate || !currentDisplayMonth) {
    return (
      <div className="container mx-auto py-6 flex flex-col lg:flex-row gap-6 items-start">
        {/* Calendar Skeleton */}
        <Card className="lg:w-1/2 xl:w-2/3 shadow-lg w-full">
          <CardContent className="p-0 sm:p-1 flex justify-center">
            <Skeleton className="h-[300px] w-[350px] sm:w-[400px] sm:h-[350px] rounded-md" />
          </CardContent>
        </Card>
        {/* Activity List Skeleton */}
        <Card className="lg:w-1/2 xl:w-1/3 shadow-lg w-full flex flex-col">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-3/4" />
            </CardTitle>
             <div className="pt-2"> {/* Added padding for tabs skeleton */}
                <Skeleton className="h-10 w-full" />
            </div>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="space-y-3 py-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex-grow">
      <div className="container mx-auto py-6 flex flex-col lg:flex-row gap-6 items-start">
        <Card className="lg:w-1/2 xl:w-2/3 shadow-lg w-full">
          <CardContent className="p-0 sm:p-1 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              month={currentDisplayMonth} // Control the displayed month
              onMonthChange={setCurrentDisplayMonth} // Allow user to change month
              className="p-1 sm:p-3 rounded-md"
              locale={dateLocale}
              footer={todayButtonFooter}
              dayEventCounts={dayEventCounts} // Pass event counts
            />
          </CardContent>
        </Card>

        <Card className={cn(
          "lg:w-1/2 xl:w-1/3 shadow-lg w-full flex flex-col transition-colors duration-300",
          allActivitiesInViewCompleted && activitiesForView.length > 0 && "bg-primary/10" // Highlight if all complete
          )}>
          <CardHeader>
            <CardTitle>
              {getCardTitle()}
            </CardTitle>
            <div className="pt-2">
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="daily">{t('viewDaily')}</TabsTrigger>
                  <TabsTrigger value="weekly">{t('viewWeekly')}</TabsTrigger>
                  <TabsTrigger value="monthly">{t('viewMonthly')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="flex-grow">
            {selectedDate && activitiesForView.length > 0 ? (
              <ScrollArea className="h-[calc(100vh-24rem)] sm:h-[calc(100vh-22rem)] pr-1">
                <div className="space-y-3">
                  {activitiesForView.map(activity => (
                    <ActivityListItem
                      key={activity.id} // Use the generated unique ID for instances
                      activity={activity}
                      category={getCategoryById(activity.categoryId)}
                      onEdit={() => handleEditActivity(activity)}
                      onDelete={() => handleOpenDeleteConfirm(activity)}
                      showDate={viewMode === 'weekly' || viewMode === 'monthly'}
                      instanceDate={activity.originalInstanceDate ? new Date(activity.originalInstanceDate) : undefined}
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {selectedDate ? t('noActivitiesForPeriod') : t('selectDateToSeeActivities')}
              </p>
            )}
          </CardContent>
          {allActivitiesInViewCompleted && activitiesForView.length > 0 && (
            <CardFooter className="text-sm text-primary flex items-center justify-center gap-1 py-3 border-t">
              <CheckCircle className="h-5 w-5" />
              <span>{t('allActivitiesCompleted')}</span>
            </CardFooter>
          )}
        </Card>

        {/* ActivityModal removed */}

        {activityToDelete && (
          <AlertDialog open={!!activityToDelete} onOpenChange={() => setActivityToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('confirmDeleteActivityTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('confirmDeleteActivityDescription', { activityTitle: activityToDelete.title })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setActivityToDelete(null)}>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete}>{t('delete')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Button
        variant="ghost"
        onClick={handleAddNewActivityGeneric}
        className={cn(
            "fixed bottom-14 right-6 z-50 shadow-lg",
            "bg-[hsl(var(--accent))]/15 text-accent-foreground backdrop-blur-md border border-border/50 hover:bg-[hsl(var(--accent))]/30",
            "flex items-center justify-center",
            // Mobile: Round button
            "h-14 w-14 rounded-full p-0",
            // Desktop (md and up): Squircle with text
            "md:h-12 md:w-auto md:rounded-2xl md:px-4 md:gap-2"
        )}
        aria-label={t('addActivity')}
      >
        <PlusCircle className="h-7 w-7 md:h-5 md:w-5" />
        <span className="hidden md:inline text-sm font-medium">{t('addActivity')}</span>
      </Button>
    </div>
  );
}
    

    