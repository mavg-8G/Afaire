
"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity, RecurrenceRule } from '@/lib/types';
import {
  isSameDay, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval,
  eachDayOfInterval, addDays, addWeeks, addMonths, getDay, getDate as getDayOfMonthFn, parseISO, formatISO,
  isAfter, isBefore, isEqual
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

type ViewMode = 'daily' | 'weekly' | 'monthly';

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
          currentDate = setDayOfMonthFn(viewStartDate, recurrence.dayOfMonth);
          if (isBefore(currentDate, viewStartDate)) currentDate = addMonths(currentDate,1);
          if (isBefore(currentDate, new Date(masterActivity.createdAt))) {
             currentDate = setDayOfMonthFn(new Date(masterActivity.createdAt), recurrence.dayOfMonth);
             if(isBefore(currentDate, new Date(masterActivity.createdAt))) currentDate = addMonths(currentDate,1);
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
     if (isBefore(currentDate, new Date(masterActivity.createdAt))) { // Ensure we don't generate before master start
        // Advance currentDate based on recurrence type
        if (recurrence.type === 'daily') currentDate = addDays(currentDate, 1);
        else if (recurrence.type === 'weekly') currentDate = addWeeks(currentDate, 1);
        else if (recurrence.type === 'monthly') currentDate = addMonths(currentDate, 1);
        else break; // Should not happen with 'none' filtered out
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
        id: `${masterActivity.id}_${currentDate.getTime()}`, // Unique ID for the instance
        isRecurringInstance: true,
        originalInstanceDate: currentDate.getTime(),
        masterActivityId: masterActivity.id,
        // Derive completion from master's completedOccurrences
        completed: !!masterActivity.completedOccurrences?.[occurrenceDateKey],
        // Todos need to be fresh copies for instances unless we want to track individual todo completion per instance (more complex)
        todos: masterActivity.todos.map(todo => ({...todo, completed: false})), // For now, instances get fresh todos
      });
    }
    
    // Advance currentDate
    if (recurrence.type === 'daily') {
      currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'weekly') {
       // If we are generating weekly, and current date is not a valid day, or to simply advance to next week
       // It's better to advance day by day to catch all valid daysOfWeek if the loop starts mid-week.
       // The logic above ensures we start on a valid day or aligned start.
       // For weekly, if current date was valid, we advance to the next valid day.
       // A simpler advance for weekly might be addDays(currentDate,1) and let the checks handle validity
       // Or, find the next occurrence. Let's stick to addDays(1) for simplicity for now.
      currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'monthly') {
      // For monthly, if current day was valid, advance to next month's valid day
      // This needs careful handling if dayOfMonth is > days in next month.
      // A simple addDays(1) is safer here too, letting the dayOfMonth check filter.
      currentDate = addDays(currentDate,1);
    } else {
      break; // Should not happen
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

  const dateLocale = locale === 'es' ? es : enUS;

  useEffect(() => {
    setHasMounted(true);
    const today = new Date();
    setSelectedDate(today);
    setCurrentDisplayMonth(today);
  }, []);


  const activitiesForView = useMemo(() => {
    if (!selectedDate || !hasMounted) return [];
    const rawActivities = getRawActivities();
    let viewStartDate: Date, viewEndDate: Date;

    if (viewMode === 'daily') {
      viewStartDate = startOfDay(selectedDate);
      viewEndDate = endOfDay(selectedDate);
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
    
    // Filter again to be absolutely sure only activities for the specific day are shown in daily view
    if (viewMode === 'daily') {
      allDisplayActivities = allDisplayActivities.filter(activity => 
        activity.originalInstanceDate && isSameDay(new Date(activity.originalInstanceDate), selectedDate)
      );
    }


    return allDisplayActivities.sort((a, b) => {
      // Sort completed to the bottom first for current day/period view
      const aIsCompleted = a.isRecurringInstance && a.originalInstanceDate
        ? !!a.completedOccurrences?.[formatISO(new Date(a.originalInstanceDate), { representation: 'date' })]
        : !!a.completed;
      const bIsCompleted = b.isRecurringInstance && b.originalInstanceDate
        ? !!b.completedOccurrences?.[formatISO(new Date(b.originalInstanceDate), { representation: 'date' })]
        : !!b.completed;

      if (aIsCompleted && !bIsCompleted) return 1;
      if (!aIsCompleted && bIsCompleted) return -1;

      const aTime = a.time ? parseInt(a.time.replace(':', ''), 10) : Infinity;
      const bTime = b.time ? parseInt(b.time.replace(':', ''), 10) : Infinity;
      if (aTime !== bTime) return aTime - bTime;
      
      // Then sort by instance date if different (for weekly/monthly view)
      if (a.originalInstanceDate && b.originalInstanceDate && a.originalInstanceDate !== b.originalInstanceDate) {
        return a.originalInstanceDate - b.originalInstanceDate;
      }
      
      // Fallback to master activity creation time if instance dates are same (shouldn't happen for generated instances)
      // or for sorting master non-recurring tasks
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [getRawActivities, selectedDate, hasMounted, viewMode, dateLocale]);

  const eventDays = useMemo(() => {
    if (!hasMounted) return [];
    const rawActivities = getRawActivities();
    const datesWithEvents = new Set<string>();
    
    // Approximate range for dot generation (e.g., current month +/- 1 month for performance)
    // This should ideally match the calendar's displayed month range.
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
    // If it's an instance, find the master. If it's already a master (non-recurring or template), use it.
    const masterActivity = activityInstanceOrMaster.masterActivityId 
      ? rawActivities.find(a => a.id === activityInstanceOrMaster.masterActivityId)
      : activityInstanceOrMaster;

    if (masterActivity) {
      setEditingActivity(masterActivity);
      setEditingInstanceDate(activityInstanceOrMaster.originalInstanceDate ? new Date(activityInstanceOrMaster.originalInstanceDate) : new Date(masterActivity.createdAt));
      setIsActivityModalOpen(true);
    }
  };
  
  const handleAddNewActivityGeneric = () => {
    setEditingActivity(undefined);
    setEditingInstanceDate(selectedDate || new Date()); // Default to selectedDate or today
    setIsActivityModalOpen(true);
  };


  const handleOpenDeleteConfirm = (activityInstanceOrMaster: Activity) => {
     const rawActivities = getRawActivities();
    const masterActivity = activityInstanceOrMaster.masterActivityId 
      ? rawActivities.find(a => a.id === activityInstanceOrMaster.masterActivityId)
      : activityInstanceOrMaster;
    
    if (masterActivity) {
      setActivityToDelete(masterActivity); // We always delete the master for series
    }
  };

  const handleConfirmDelete = () => {
    if (activityToDelete) {
      deleteActivity(activityToDelete.id); // This deletes the master activity
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
  };
  
  const startOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const endOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };


  const handleTodayButtonClick = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentDisplayMonth(today);
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
          <CardContent className="p-0 sm:p-1 flex justify-center sm:p-3">
            <Skeleton className="h-[300px] w-[350px] sm:w-[400px] sm:h-[350px] rounded-md" />
          </CardContent>
        </Card>
        <Card className="lg:w-1/2 xl:w-1/3 shadow-lg w-full flex flex-col">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-3/4" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="space-y-3 py-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
          {/* Footer removed */}
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex-grow">
      <div className="container mx-auto py-6 flex flex-col lg:flex-row gap-6 items-start">
        <Card className="lg:w-1/2 xl:w-2/3 shadow-lg w-full">
          <CardContent className="p-0 sm:p-1 flex justify-center sm:p-3">
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
              <ScrollArea className="h-[calc(100vh-27rem)] sm:h-[calc(100vh-27rem)] pr-1">
                <div className="space-y-3">
                  {activitiesForView.map(activity => (
                    <ActivityListItem 
                      key={activity.id} // This key needs to be unique for instances too!
                      activity={activity} 
                      category={getCategoryById(activity.categoryId)}
                      onEdit={() => handleEditActivity(activity)}
                      onDelete={() => handleOpenDeleteConfirm(activity)}
                      showDate={viewMode === 'weekly' || viewMode === 'monthly'}
                      // Pass instanceDate for completion toggle
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
            activity={editingActivity} // Pass master activity for editing
            initialDate={editingActivity ? new Date(editingActivity.createdAt) : (selectedDate || new Date())} // For new activities, or master start date
            instanceDate={editingInstanceDate} // For context if editing an instance
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
        className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14 z-30 p-0"
        aria-label={t('addActivity')}
      >
        <PlusCircle className="h-7 w-7" />
      </Button>
    </div>
  );
}
