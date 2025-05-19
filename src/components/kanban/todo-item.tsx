
"use client";
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // For potential inline edit
import { Trash2, Edit3 } from 'lucide-react';
import type { Todo } from '@/lib/types';
import { useAppStore } from '@/hooks/use-app-store';

interface TodoItemProps {
  todo: Todo;
  activityId: string;
}

export default function TodoItem({ todo, activityId }: TodoItemProps) {
  const { updateTodoInActivity, deleteTodoFromActivity } = useAppStore();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(todo.text);

  const handleToggleCompleted = () => {
    updateTodoInActivity(activityId, todo.id, { completed: !todo.completed });
  };

  const handleDelete = () => {
    deleteTodoFromActivity(activityId, todo.id);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editText.trim() !== todo.text && editText.trim() !== "") {
      updateTodoInActivity(activityId, todo.id, { text: editText.trim() });
    }
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditText(todo.text);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center space-x-2 py-1 group">
      <Checkbox
        id={`todo-${todo.id}`}
        checked={todo.completed}
        onCheckedChange={handleToggleCompleted}
        aria-labelledby={`todo-label-${todo.id}`}
      />
      {isEditing ? (
        <Input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSaveEdit}
          onKeyDown={handleKeyDown}
          autoFocus
          className="h-8 flex-grow text-sm"
        />
      ) : (
        <label
          htmlFor={`todo-${todo.id}`}
          id={`todo-label-${todo.id}`}
          className={`flex-grow text-sm cursor-pointer ${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
        >
          {todo.text}
        </label>
      )}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center">
        {!isEditing && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEdit}>
            <Edit3 className="h-3.5 w-3.5" />
            <span className="sr-only">Edit todo</span>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
          <span className="sr-only">Delete todo</span>
        </Button>
      </div>
    </div>
  );
}
