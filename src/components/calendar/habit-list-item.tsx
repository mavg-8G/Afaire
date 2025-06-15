
"use client";

import type { Habit, HabitSlot, HabitSlotCompletionStatus } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/contexts/language-context';

interface HabitListItemProps {
  habit: Habit;
  slot: HabitSlot;
  date: Date; // The specific date for which this slot's completion is being tracked
  completionStatus: HabitSlotCompletionStatus | undefined;
  onToggleCompletion: (completed: boolean) => void;
}

export default function HabitListItem({ habit, slot, completionStatus, onToggleCompletion }: HabitListItemProps) {
  const { t } = useTranslations();
  const isCompleted = !!completionStatus?.completed;
  const uniqueId = `habit-${habit.id}-slot-${slot.id}`;

  return (
    <div className={cn(
      "flex items-center justify-between p-2.5 rounded-md border bg-card shadow-sm hover:shadow-md transition-shadow duration-150 ease-in-out",
      isCompleted && "bg-muted/60 opacity-80"
    )}>
      <div className="flex items-center gap-3 flex-grow min-w-0">
        <Checkbox
          id={uniqueId}
          checked={isCompleted}
          onCheckedChange={(checkedState) => {
            onToggleCompletion(Boolean(checkedState));
          }}
          aria-labelledby={`${uniqueId}-label`}
        />
        <div className="flex flex-col flex-grow min-w-0">
          <Label
            htmlFor={uniqueId}
            id={`${uniqueId}-label`}
            className={cn(
              "text-sm font-medium leading-tight cursor-pointer",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            <span className="block truncate" title={`${habit.name} - ${slot.name}`}>
              {habit.icon && <habit.icon className="inline-block h-4 w-4 mr-1.5 text-primary/80" /> }
              {habit.name} - <span className="font-normal text-muted-foreground">{slot.name}</span>
            </span>
          </Label>
          {slot.default_time && (
            <div className={cn(
              "flex items-center text-xs text-muted-foreground mt-0.5",
              isCompleted && "text-muted-foreground/70"
            )}>
              <Clock className="mr-1 h-3 w-3" />
              {slot.default_time}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
