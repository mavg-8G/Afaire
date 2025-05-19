
"use client";
import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity } from '@/lib/types';
import { isSameDay, format } from 'date-fns';
import ActivityModal from '@/components/forms/activity-modal';
import ActivityListItem from './activity-list-item';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle } from 'lucide-react';
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

export default function ActivityCalendarView() {
  const { activities, getCategoryById, deleteActivity } = useAppStore();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(undefined);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [isAddingActivityForSelectedDate, setIsAddingActivityForSelectedDate] = useState(false);


  const eventDays = useMemo(() => {
    return activities.map(activity => new Date(activity.createdAt));
  }, [activities]);

  const activitiesForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return activities.filter(activity => isSameDay(new Date(activity.createdAt), selectedDate))
                     .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activities, selectedDate]);

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
      toast({ title: "Activity Deleted", description: `"${activityToDelete.title}" has been removed.` });
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
          />
        </CardContent>
      </Card>
      
      <Card className="lg:w-1/2 xl:w-1/3 shadow-lg w-full flex flex-col">
        <CardHeader>
          <CardTitle>
            Activities for {selectedDate ? format(selectedDate, 'PPP') : 'Selected Date'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
          {activitiesForSelectedDay.length > 0 ? (
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
              No activities scheduled for this day.
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
            Add Activity for {selectedDate ? format(selectedDate, 'MMM d') : '...'}
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
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the activity
                "{activityToDelete.title}" and all its associated todos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setActivityToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
