
"use client";
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from '@/hooks/use-app-store';
import type { Category } from '@/lib/types';
import { useTranslations } from '@/contexts/language-context';

interface CategorySelectorProps {
  value: string | undefined; // Keep as string, as HTML select values are strings
  onChange: (value: string) => void; // Keep as string
  placeholder?: string;
}

export default function CategorySelector({ value, onChange, placeholder }: CategorySelectorProps) {
  const { categories, isLoading } = useAppStore();
  const { t } = useTranslations();
  const defaultPlaceholder = placeholder || t('selectCategoryPlaceholder');

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('loadingCategoriesPlaceholder')} />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select 
        value={value !== undefined ? String(value) : undefined} // Ensure value is string or undefined for Select
        onValueChange={onChange} // onChange expects string
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={defaultPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {categories.map((category: Category) => (
          <SelectItem key={category.id} value={String(category.id)}> {/* Ensure value is string */}
            <div className="flex items-center gap-2">
              <category.icon className="h-4 w-4" />
              {category.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
