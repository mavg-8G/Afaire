
"use client";
import React, { useState, useCallback } from 'react';
import { KANBAN_STATUSES } from '@/lib/constants';
import { useAppStore } from '@/hooks/use-app-store';
import type { ActivityStatus } from '@/lib/types';
import KanbanColumn from './kanban-column';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'; // Using dnd-kit for better DnD
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Skeleton } from "@/components/ui/skeleton";

export default function KanbanBoard() {
  const { activities, moveActivity, isLoading, error } = useAppStore();
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);

  // Simplified HTML5 Drag and Drop
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, activityId: string) => {
    setDraggedActivityId(activityId);
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', activityId);
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetStatus: ActivityStatus) => {
    e.preventDefault();
    const activityId = draggedActivityId || e.dataTransfer.getData('text/plain');
    if (activityId) {
      moveActivity(activityId, targetStatus);
    }
    setDraggedActivityId(null);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex space-x-4 overflow-x-auto p-2">
          {KANBAN_STATUSES.map(status => (
            <div key={status.id} className="flex-1 p-4 bg-muted/50 rounded-lg min-w-[300px]">
              <Skeleton className="h-8 w-3/4 mb-4" />
              <Skeleton className="h-24 w-full mb-3" />
              <Skeleton className="h-32 w-full mb-3" />
              <Skeleton className="h-28 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (error) {
     return <div className="container mx-auto py-6 text-center text-destructive">Error: {error}</div>;
  }


  return (
    <div className="container mx-auto py-6">
      <div className="flex space-x-4 overflow-x-auto p-2">
        {KANBAN_STATUSES.map(statusInfo => (
          <KanbanColumn
            key={statusInfo.id}
            status={statusInfo.id}
            title={statusInfo.title}
            activities={activities.filter(act => act.status === statusInfo.id)}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
