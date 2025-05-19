
"use client";
import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity } from '@/lib/types';
import { isSameDay, format } from 'date-fns';
import ActivityModal from '@/components/forms/activity-modal';
import ActivityListItem from './activity-list-item';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ActivityCalendarView() {
  const { activities, getCategoryById } = useAppStore();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>(undefined);

  const eventDays = useMemo(() => {
    return activities.map(activity => new Date(activity.createdAt));
  }, [activities]);

  const activitiesForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return activities.filter(activity => isSameDay(new Date(activity.createdAt), selectedDate))
                     .sort((a, b) => a.createdAt - b.createdAt); // Sort by creation time
  }, [activities, selectedDate]);

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setIsActivityModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsActivityModalOpen(false);
    setEditingActivity(undefined); 
  };

  const modifiers = {
    hasEvent: eventDays,
    // selected: selectedDate, // react-day-picker handles selected styling via the 'selected' prop directly
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
      
      <Card className="lg:w-1/2 xl:w-1/3 shadow-lg w-full flex-grow">
        <CardHeader>
          <CardTitle>
            Activities for {selectedDate ? format(selectedDate, 'PPP') : 'Selected Date'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activitiesForSelectedDay.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-26rem)] sm:h-[calc(100vh-24rem)] pr-1"> {/* Adjusted height */}
              <div className="space-y-3">
                {activitiesForSelectedDay.map(activity => (
                  <ActivityListItem 
                    key={activity.id} 
                    activity={activity} 
                    category={getCategoryById(activity.categoryId)}
                    onEdit={() => handleEditActivity(activity)} 
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
      </Card>

      {isActivityModalOpen && editingActivity && ( // Ensure editingActivity is defined before rendering modal
        <ActivityModal
          isOpen={isActivityModalOpen}
          onClose={handleCloseModal}
          activity={editingActivity}
        />
      )}
    </div>
  );
}
