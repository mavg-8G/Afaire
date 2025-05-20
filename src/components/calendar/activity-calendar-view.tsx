
"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity } from '@/lib/types';
import { isSameDay, format } from 'date-fns';
import ActivityModal from '@/components/forms/activity-modal';
import ActivityListItem from './activity-list-item';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/contexts/language-context';
import { enUS, es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export default function ActivityCalendarView() {
  const { activities, getCategoryById, deleteActivity } = useAppStore();
  const { toast } = useToast();
  const { t, locale } = useTranslations();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(undefined);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [isAddingActivityForSelectedDate, setIsAddingActivityForSelectedDate] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const dateLocale = locale === 'es' ? es : enUS;

  useEffect(() => {
    setHasMounted(true);
    setSelectedDate(new Date());
  }, []);


  const eventDays = useMemo(() => {
    if (!hasMounted) return [];
    return activities.map(activity => new Date(activity.createdAt));
  }, [activities, hasMounted]);

  const activitiesForSelectedDay = useMemo(() => {
    if (!selectedDate || !hasMounted) return [];
    return activities
      .filter(activity => isSameDay(new Date(activity.createdAt), selectedDate))
      .sort((a, b) => {
        // 1. Primary sort: completed activities first (false means not completed, so it comes "before" true in ascending sort)
        // We want completed (true) to come AFTER not completed (false). So if a.completed is true and b.completed is false, a should be later.
        if (a.completed && !b.completed) return 1; // a (completed) comes after b (not completed)
        if (!a.completed && b.completed) return -1; // a (not completed) comes before b (completed)

        // If both are completed or both are not completed, proceed to time-based sorting
        const aHasTime = !!a.time;
        const bHasTime = !!b.time;

        // 2. Secondary sort: activities with time come before activities without time (within the same completion group)
        if (aHasTime && !bHasTime) return -1; // a (with time) comes before b (without time)
        if (!aHasTime && bHasTime) return 1; // a (without time) comes after b (with time)

        // 3. Tertiary sort: if both have time, sort by time ascending
        if (aHasTime && bHasTime && a.time && b.time) {
          const [aHours, aMinutes] = a.time.split(':').map(Number);
          const [bHours, bMinutes] = b.time.split(':').map(Number);

          if (aHours !== bHours) {
            return aHours - bHours;
          }
          if (aMinutes !== bMinutes) {
            return aMinutes - bMinutes;
          }
        }
        
        // 4. Fallback sort: use original creation time for stability if other criteria are equal
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [activities, selectedDate, hasMounted]);

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setIsAddingActivityForSelectedDate(false);
    setIsActivityModalOpen(true);
  };

  const handleAddNewActivityForSelectedDate = () => {
    if (selectedDate) {
      setEditingActivity(undefined);
      setIsAddingActivityForSelectedDate(true);
      setIsActivityModalOpen(true);
    }
  };

  const handleOpenDeleteConfirm = (activity: Activity) => {
    setActivityToDelete(activity);
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
    setIsAddingActivityForSelectedDate(false);
  };

  const modifiers = {
    hasEvent: eventDays,
  };

  const modifiersClassNames = {
    hasEvent: 'day-with-event',
  };

  const todayButtonFooter = (
    <div className="flex justify-center pt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSelectedDate(new Date())}
      >
        {t('todayButton')}
      </Button>
    </div>
  );

  if (!hasMounted) {
    return (
      <div className="container mx-auto py-6 flex flex-col lg:flex-row gap-6 items-start">
        <Card className="lg:w-1/2 xl:w-2/3 shadow-lg w-full">
          <CardContent className="p-0 sm:p-2 flex justify-center">
            <Skeleton className="h-[300px] w-[350px] rounded-md" />
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
          <CardFooter>
            <Button disabled className="w-full">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loadingDate')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 flex flex-col lg:flex-row gap-6 items-start">
      <Card className="lg:w-1/2 xl:w-2/3 shadow-lg w-full">
        <CardContent className="p-0 sm:p-2 flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md"
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            initialFocus
            locale={dateLocale}
            footer={todayButtonFooter}
          />
        </CardContent>
      </Card>
      
      <Card className="lg:w-1/2 xl:w-1/3 shadow-lg w-full flex flex-col">
        <CardHeader>
          <CardTitle>
            {selectedDate ? t('activitiesForDate', {date: format(selectedDate, 'PPP', { locale: dateLocale })}) : t('loadingDate')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
          {selectedDate && activitiesForSelectedDay.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-30rem)] sm:h-[calc(100vh-28rem)] pr-1">
              <div className="space-y-3">
                {activitiesForSelectedDay.map(activity => (
                  <ActivityListItem 
                    key={activity.id} 
                    activity={activity} 
                    category={getCategoryById(activity.categoryId)}
                    onEdit={() => handleEditActivity(activity)}
                    onDelete={() => handleOpenDeleteConfirm(activity)}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {selectedDate ? t('noActivitiesForDay') : t('selectDateToSeeActivities')}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleAddNewActivityForSelectedDate} 
            disabled={!selectedDate}
            className="w-full"
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            {selectedDate ? t('addActivityForDate', {date: format(selectedDate, 'MMM d', { locale: dateLocale })}) : '...'}
          </Button>
        </CardFooter>
      </Card>

      {isActivityModalOpen && (
        <ActivityModal
          isOpen={isActivityModalOpen}
          onClose={handleCloseModal}
          activity={editingActivity}
          initialDate={isAddingActivityForSelectedDate && selectedDate ? selectedDate : undefined}
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
  );
}

    