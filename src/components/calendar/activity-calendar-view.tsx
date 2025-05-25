
"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity, RecurrenceRule } from '@/lib/types';
import {
  isSameDay, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval,
  addDays, addWeeks, addMonths, getDay, getDate as getDayOfMonthFn, parseISO, formatISO,
  isAfter, isBefore, isEqual, setDate as setDayOfMonth // Added setDate
} from 'date-fns';
import ActivityModal from '@/components/forms/activity-modal';
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
        id: `${masterActivity.id}_${currentDate.getTime()}`,
        isRecurringInstance: true,
        originalInstanceDate: currentDate.getTime(),
        masterActivityId: masterActivity.id,
        completed: !!masterActivity.completedOccurrences?.[occurrenceDateKey],
        todos: masterActivity.todos.map(todo => ({...todo, id: uuidv4(), completed: false})),
      });
    }

    if (recurrence.type === 'daily') {
      currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'weekly') {
      currentDate = addDays(currentDate, 1);
    } else if (recurrence.type === 'monthly') {
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
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(undefined);
  const [editingInstanceDate, setEditingInstanceDate] = useState<Date | undefined>(undefined);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [dateForModal, setDateForModal] = useState<Date>(new Date());


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
    setDateForModal(today);
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
    } else {
      viewStartDate = startOfMonth(selectedDate);
      viewEndDate = endOfMonth(selectedDate);
    }

    let allDisplayActivities: Activity[] = [];
    rawActivities.forEach(masterActivity => {
      if (masterActivity.recurrence && masterActivity.recurrence.type !== 'none') {
        allDisplayActivities.push(...generateRecurringInstances(masterActivity, viewStartDate, viewEndDate));
      } else {
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

    const sortedActivities = allDisplayActivities.sort((a, b) => {
        const aIsCompleted = a.isRecurringInstance && a.originalInstanceDate
            ? !!a.completedOccurrences?.[formatISO(new Date(a.originalInstanceDate), { representation: 'date' })]
            : !!a.completed;
        const bIsCompleted = b.isRecurringInstance && b.originalInstanceDate
            ? !!b.completedOccurrences?.[formatISO(new Date(b.originalInstanceDate), { representation: 'date' })]
            : !!b.completed;

        if (aIsCompleted !== bIsCompleted) {
            return aIsCompleted ? 1 : -1;
        }

        const aTime = a.time ? parseInt(a.time.replace(':', ''), 10) : Infinity;
        const bTime = b.time ? parseInt(b.time.replace(':', ''), 10) : Infinity;

        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;

        if (a.time && b.time && aTime !== bTime) {
            return aTime - bTime;
        }

        const aDate = a.originalInstanceDate ? new Date(a.originalInstanceDate).getTime() : new Date(a.createdAt).getTime();
        const bDate = b.originalInstanceDate ? new Date(b.originalInstanceDate).getTime() : new Date(b.createdAt).getTime();
        if (aDate !== bDate) {
            return aDate - bDate;
        }

        return 0;
    });

    const allCompleted = sortedActivities.length > 0 && sortedActivities.every(act => {
      const isInstanceCompleted = act.isRecurringInstance && act.originalInstanceDate
        ? !!act.completedOccurrences?.[formatISO(new Date(act.originalInstanceDate), { representation: 'date' })]
        : !!act.completed;

      if (!isInstanceCompleted) return false;
      if (act.todos && act.todos.length > 0) {
        return act.todos.every(todo => todo.completed);
      }
      return true;
    });

    return { activitiesForView: sortedActivities, allActivitiesInViewCompleted: allCompleted };
  }, [getRawActivities, selectedDate, hasMounted, viewMode, dateLocale]);

  const dayEventCounts = useMemo(() => {
    if (!hasMounted || !currentDisplayMonth) return new Map<string, number>();
    const rawActivities = getRawActivities();
    const counts = new Map<string, number>();

    const displayRangeStart = startOfMonth(addMonths(currentDisplayMonth, -1));
    const displayRangeEnd = endOfMonth(addMonths(currentDisplayMonth, 1));

    rawActivities.forEach(activity => {
      if (activity.recurrence && activity.recurrence.type !== 'none') {
        const instances = generateRecurringInstances(activity, displayRangeStart, displayRangeEnd);
        instances.forEach(inst => {
          if (inst.originalInstanceDate) {
            const dateKey = formatISO(new Date(inst.originalInstanceDate), { representation: 'date' });
            counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
          }
        });
      } else {
        const activityDate = new Date(activity.createdAt);
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
      setEditingActivity(masterActivity);
      const instanceOrDefaultDate = activityInstanceOrMaster.originalInstanceDate
        ? new Date(activityInstanceOrMaster.originalInstanceDate)
        : new Date(masterActivity.createdAt);
      setDateForModal(instanceOrDefaultDate);
      setEditingInstanceDate(instanceOrDefaultDate);
      setIsActivityModalOpen(true);
    }
  };

  const handleAddNewActivityGeneric = () => {
    setEditingActivity(undefined);
    // When FAB is clicked, the modal should open for the currently selectedDate on the calendar,
    // or today if no date is selected (though selectedDate is usually initialized to today).
    setDateForModal(selectedDate || new Date());
    setEditingInstanceDate(undefined); // No specific instance when adding generally
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
    if (date) setDateForModal(date); // Update dateForModal when a calendar date is selected
  };

  const handleTodayButtonClick = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentDisplayMonth(today);
    setDateForModal(today); // Also update dateForModal for consistency
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
              locale={dateLocale}
              footer={todayButtonFooter}
              dayEventCounts={dayEventCounts}
            />
          </CardContent>
        </Card>

        <Card className={cn(
          "lg:w-1/2 xl:w-1/3 shadow-lg w-full flex flex-col transition-colors duration-300",
          allActivitiesInViewCompleted && activitiesForView.length > 0 && "bg-primary/10"
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
          {allActivitiesInViewCompleted && activitiesForView.length > 0 && (
            <CardFooter className="text-sm text-primary flex items-center justify-center gap-1 py-3 border-t">
              <CheckCircle className="h-5 w-5" />
              <span>{t('allActivitiesCompleted')}</span>
            </CardFooter>
          )}
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
        variant="ghost"
        onClick={handleAddNewActivityGeneric}
        className={cn(
            "fixed bottom-16 right-6 z-50 shadow-lg", // Adjusted from bottom-12 to bottom-16
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
    
