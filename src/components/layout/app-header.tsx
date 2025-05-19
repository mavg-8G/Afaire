
"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { LogoIcon } from '@/components/icons/logo-icon';
import { APP_NAME } from '@/lib/constants';
import ActivityModal from '@/components/forms/activity-modal'; // Will be created next

export default function AppHeader() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoIcon className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{APP_NAME}</h1>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Activity
          </Button>
        </div>
      </header>
      <ActivityModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
