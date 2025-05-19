
"use client";
import React from 'react';
import type { Activity, ActivityStatus } from '@/lib/types';
import ActivityCard from './activity-card';

interface KanbanColumnProps {
  status: ActivityStatus;
  title: string;
  activities: Activity[];
  onDragStart: (e: React.DragEvent<HTMLDivElement>, activityId: string) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, status: ActivityStatus) => void;
}

export default function KanbanColumn({ status, title, activities, onDragStart, onDrop }: KanbanColumnProps) {
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  return (
    <div
      className="flex-1 p-4 bg-muted/50 rounded-lg min-h-[calc(100vh-12rem)] min-w-[300px]"
      onDragOver={handleDragOver}
      onDrop={(e) => onDrop(e, status)}
      data-status-id={status}
    >
      <h2 className="text-lg font-semibold mb-4 text-foreground sticky top-0 bg-muted/50 py-2 z-10">{title}</h2>
      <div className="space-y-3">
        {activities.map(activity => (
          <ActivityCard key={activity.id} activity={activity} onDragStart={onDragStart} />
        ))}
        {activities.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10 border-2 border-dashed border-border rounded-md">
            Drag activities here or create new ones.
          </div>
        )}
      </div>
    </div>
  );
}
