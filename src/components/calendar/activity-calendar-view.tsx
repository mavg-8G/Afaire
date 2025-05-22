
"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity, RecurrenceRule } from '@/lib/types';
import {
  isSameDay, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval,
  eachDayOfInterval, addDays, addWeeks, addMonths, getDay, getDate as getDayOfMonthFn, parseISO, formatISO,
  isAfter, isBefore, isEqual, setDate as setDayOfMonth // Added setDate
} from 'date-fns';
import ActivityModal from '@/components/forms/activity-modal';
import ActivityListItem from './activity-list-item';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Loader2 } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/contexts/language-context';
import { enUS, es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { v4 as uuidv4 } from 'uuid';

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
    // If it's a non-recurring activity, check if its single date falls in range
    const activityDate = new Date(masterActivity.createdAt);
    if (isWithinInterval(activityDate, { start: viewStartDate, end: viewEndDate }) || isSameDay(activityDate, viewStartDate) || isSameDay(activityDate, viewEndDate)) {
       return [{
        ...masterActivity,
        isRecurringInstance: false,
        originalInstanceDate: masterActivity.createdAt,
        masterActivityId: masterActivity.id // For consistency, even non-recurring can have this
      }];
    }
    return [];
  }

  const instances: Activity[] = [];
  const recurrence = masterActivity.recurrence;
  let currentDate = new Date(masterActivity.createdAt); // Start date of the series

  // Align currentDate to be within or after viewStartDate for generation efficiency
  if (isBefore(currentDate, viewStartDate)) {
      if (recurrence.type === 'daily') {
          currentDate = viewStartDate;
      } else if (recurrence.type === 'weekly' && recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
          let tempDate = startOfWeek(viewStartDate, { weekStartsOn: 0 /* Sunday */});
          while(isBefore(tempDate, new Date(masterActivity.createdAt)) || !recurrence.daysOfWeek.includes(getDay(tempDate))) {
              tempDate = addDays(tempDate, 1);
              if (isAfter(tempDate, viewEndDate) && isAfter(tempDate, currentDate)) break; // Optimization
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

  let iterations = 0; // Safety break for loops
  const maxIterations = 366 * 2; // Approx 2 years of daily occurrences

  while (iterations < maxIterations && isBefore(currentDate, addDays(viewEndDate,1))) { // Check up to and including viewEndDate
    iterations++;

    if (seriesEndDate && isAfter(currentDate, seriesEndDate)) {
      break; // Stop if recurrence end date is passed
    }
     if (isBefore(currentDate, new Date(masterActivity.createdAt))) {
        if (recurrence.type === 'daily') currentDate = addDays(currentDate, 1);
        else if (recurrence.type === 'weekly') currentDate = addWeeks(currentDate, 1); // More robust to advance by week
        else if (recurrence.type === 'monthly') currentDate = addMonths(currentDate, 1); // More robust
        else break;
        continue;
    }


    let isValidOccurrence = false;
    switch (recurrence.type) {
      case 'daily':
        isValidOccurrence = true;
        break;
      case 'weekly':
        if (recurrence.daysOfWeek?.includes(getDay(currentDate))) { // getDay: 0 (Sun) - 6 (Sat)
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
        id: `${masterActivity.id}_${currentDate.getTime()}`,
        isRecurringInstance: true,
        originalInstanceDate: currentDate.getTime(),
        masterActivityId: masterActivity.id,
        completed: !!masterActivity.completedOccurrences?.[occurrenceDateKey],
        // Generate new unique IDs for todos in each recurring instance
        todos: masterActivity.todos.map(todo => ({...todo, id: uuidv4(), completed: false})),
      });
    }

    if (recurrence.type === 'daily') {
      currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'weekly') {
      // Advance to the next day, and the loop + conditions will find the next valid day in the week or next week
      currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'monthly') {
      // Advance to the next day, and the loop + conditions will find the next valid day in the month or next month
      currentDate = addDays(currentDate,1);
    } else {
      break;
    }
  }
  return instances;
}


export default function ActivityCalendarView() {
  const { getRawActivities, getCategoryById, deleteActivity, toggleOccurrenceCompletion } = useAppStore();
  const { toast } = useToast();
  const { t, locale } = useTranslations();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentDisplayMonth, setCurrentDisplayMonth] = useState<Date | undefined>(undefined);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(undefined); // This will be the master activity
  const [editingInstanceDate, setEditingInstanceDate] = useState<Date | undefined>(undefined); // Date of the specific instance being interacted with
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null); // Master activity to delete
  const [hasMounted, setHasMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [dateForModal, setDateForModal] = useState<Date>(new Date()); // For stable prop to ActivityModal


  const dateLocale = locale === 'es' ? es : enUS;

  useEffect(() => {
    setHasMounted(true);
    const today = new Date();
    setSelectedDate(today);
    setCurrentDisplayMonth(today);
    setDateForModal(today); // Initialize dateForModal as well
  }, []);


  const activitiesForView = useMemo(() => {
    if (!selectedDate || !hasMounted) return [];
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
      } else {
        // Non-recurring activity
        const activityDate = new Date(masterActivity.createdAt);
         if (isWithinInterval(activityDate, { start: viewStartDate, end: viewEndDate }) || isSameDay(activityDate, viewStartDate) || isSameDay(activityDate, viewEndDate) ) {
           allDisplayActivities.push({
            ...masterActivity,
            isRecurringInstance: false,
            originalInstanceDate: masterActivity.createdAt,
            masterActivityId: masterActivity.id,
          });
        }
      }
    });

    if (viewMode === 'daily') {
      allDisplayActivities = allDisplayActivities.filter(activity =>
        activity.originalInstanceDate && isSameDay(new Date(activity.originalInstanceDate), selectedDate)
      );
    }


    return allDisplayActivities.sort((a, b) => {
        const aIsCompleted = a.isRecurringInstance && a.originalInstanceDate
            ? !!a.completedOccurrences?.[formatISO(new Date(a.originalInstanceDate), { representation: 'date' })]
            : !!a.completed;
        const bIsCompleted = b.isRecurringInstance && b.originalInstanceDate
            ? !!b.completedOccurrences?.[formatISO(new Date(b.originalInstanceDate), { representation: 'date' })]
            : !!b.completed;

        if (aIsCompleted !== bIsCompleted) {
            return aIsCompleted ? 1 : -1; // Completed items go to the bottom
        }

        // Sort by time (earliest first for non-completed, doesn't matter as much for completed)
        const aTime = a.time ? parseInt(a.time.replace(':', ''), 10) : Infinity;
        const bTime = b.time ? parseInt(b.time.replace(':', ''), 10) : Infinity;

        if (a.time && !b.time) return -1; // a has time, b doesn't -> a comes first
        if (!a.time && b.time) return 1;  // b has time, a doesn't -> b comes first

        if (a.time && b.time && aTime !== bTime) {
            return aTime - bTime;
        }

        // Fallback sort by original instance date or creation date if times are the same or both undefined
        const aDate = a.originalInstanceDate ? new Date(a.originalInstanceDate).getTime() : new Date(a.createdAt).getTime();
        const bDate = b.originalInstanceDate ? new Date(b.originalInstanceDate).getTime() : new Date(b.createdAt).getTime();
        if (aDate !== bDate) {
            return aDate - bDate;
        }

        return 0; // Keep original order if everything else is equal
    });
  }, [getRawActivities, selectedDate, hasMounted, viewMode, dateLocale]);

  const eventDays = useMemo(() => {
    if (!hasMounted) return [];
    const rawActivities = getRawActivities();
    const datesWithEvents = new Set<string>();

    const displayRangeStart = currentDisplayMonth ? startOfMonth(addMonths(currentDisplayMonth, -1)) : startOfMonth(addMonths(new Date(), -1));
    const displayRangeEnd = currentDisplayMonth ? endOfMonth(addMonths(currentDisplayMonth, 1)) : endOfMonth(addMonths(new Date(), 1));

    rawActivities.forEach(activity => {
      if (activity.recurrence && activity.recurrence.type !== 'none') {
        const instances = generateRecurringInstances(activity, displayRangeStart, displayRangeEnd);
        instances.forEach(inst => {
          if (inst.originalInstanceDate) {
            datesWithEvents.add(formatISO(new Date(inst.originalInstanceDate), { representation: 'date' }));
          }
        });
      } else {
        datesWithEvents.add(formatISO(new Date(activity.createdAt), { representation: 'date' }));
      }
    });
    return Array.from(datesWithEvents).map(dateStr => parseISO(dateStr));
  }, [getRawActivities, hasMounted, currentDisplayMonth]);


  const handleEditActivity = (activityInstanceOrMaster: Activity) => {
    const rawActivities = getRawActivities();
    const masterActivity = activityInstanceOrMaster.masterActivityId
      ? rawActivities.find(a => a.id === activityInstanceOrMaster.masterActivityId)
      : activityInstanceOrMaster;

    if (masterActivity) {
      setEditingActivity(masterActivity);
      const instanceOrDefaultDate = activityInstanceOrMaster.originalInstanceDate
        ? new Date(activityInstanceOrMaster.originalInstanceDate)
        : new Date(masterActivity.createdAt);
      setDateForModal(instanceOrDefaultDate); // Set stable date for modal
      setEditingInstanceDate(instanceOrDefaultDate);
      setIsActivityModalOpen(true);
    }
  };

  const handleAddNewActivityGeneric = () => {
    setEditingActivity(undefined);
    // When adding a new activity via FAB, the date in the modal should default to the current date
    // for the new activity's start date.
    setDateForModal(new Date()); // Default to today for new activity
    setEditingInstanceDate(undefined); // No specific instance for a new activity
    setIsActivityModalOpen(true);
  };


  const handleOpenDeleteConfirm = (activityInstanceOrMaster: Activity) => {
     const rawActivities = getRawActivities();
    const masterActivity = activityInstanceOrMaster.masterActivityId
      ? rawActivities.find(a => a.id === activityInstanceOrMaster.masterActivityId)
      : activityInstanceOrMaster;

    if (masterActivity) {
      setActivityToDelete(masterActivity);
    }
  };

  const handleConfirmDelete = () => {
    if (activityToDelete) {
      deleteActivity(activityToDelete.id);
      toast({
        title: t('toastActivityDeletedTitle'),
        description: t('toastActivityDeletedDescription', { activityTitle: activityToDelete.title })
      });
      setActivityToDelete(null);
    }
  };

  const handleCloseModal = () => {
    setIsActivityModalOpen(false);
    setEditingActivity(undefined);
    setEditingInstanceDate(undefined);
  };

  const modifiers = {
    hasEvent: eventDays,
  };

  const modifiersClassNames = {
    hasEvent: 'day-with-event',
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && currentDisplayMonth) {
      const newSelectedMonthStart = startOfMonth(date);
      const currentDisplayMonthStart = startOfMonth(currentDisplayMonth);
      if (newSelectedMonthStart.getTime() !== currentDisplayMonthStart.getTime()) {
          setCurrentDisplayMonth(date);
      }
    } else if (date) {
        setCurrentDisplayMonth(date);
    }
     // Update dateForModal when a new date is selected on the calendar
    if (date) {
      setDateForModal(date);
    }
  };

  const handleTodayButtonClick = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentDisplayMonth(today);
    setDateForModal(today); // Also update dateForModal
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
    return t('loadingDate');
  };


  if (!hasMounted || !selectedDate || !currentDisplayMonth) {
    return (
      <div className="container mx-auto py-6 flex flex-col lg:flex-row gap-6 items-start">
        <Card className="lg:w-1/2 xl:w-2/3 shadow-lg w-full">
          <CardContent className="p-0 sm:p-1 flex justify-center">
            <Skeleton className="h-[300px] w-[350px] sm:w-[400px] sm:h-[350px] rounded-md" />
          </CardContent>
        </Card>
        <Card className="lg:w-1/2 xl:w-1/3 shadow-lg w-full flex flex-col">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-3/4" />
            </CardTitle>
             <div className="pt-2">
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
              month={currentDisplayMonth}
              onMonthChange={setCurrentDisplayMonth}
              className="p-1 sm:p-3 rounded-md"
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              locale={dateLocale}
              footer={todayButtonFooter}
            />
          </CardContent>
        </Card>

        <Card className="lg:w-1/2 xl:w-1/3 shadow-lg w-full flex flex-col">
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
              <ScrollArea className="h-[calc(100vh-20rem)] sm:h-[calc(100vh-20rem)] pr-1">
                <div className="space-y-3">
                  {activitiesForView.map(activity => (
                    <ActivityListItem
                      key={activity.id}
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
        </Card>

        {isActivityModalOpen && (
          <ActivityModal
            isOpen={isActivityModalOpen}
            onClose={handleCloseModal}
            activity={editingActivity}
            initialDate={dateForModal} 
            instanceDate={editingInstanceDate}
          />
        )}

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
        onClick={handleAddNewActivityGeneric}
        className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14 z-30 p-0 bg-[hsl(var(--accent))]/15 text-accent-foreground backdrop-blur-md border border-border/50"
        aria-label={t('addActivity')}
      >
        <PlusCircle className="h-7 w-7" />
      </Button>
    </div>
  );
}

