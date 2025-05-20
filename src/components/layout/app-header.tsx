
"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings } from 'lucide-react'; // Added Settings icon
import { LogoIcon } from '@/components/icons/logo-icon';
import { APP_NAME } from '@/lib/constants';
import ActivityModal from '@/components/forms/activity-modal'; 

export default function AppHeader() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoIcon className="h-7 w-7 text-primary" />
            <Link href="/" className="text-2xl font-bold tracking-tight text-foreground hover:no-underline">
                {APP_NAME}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsModalOpen(true)} variant="default">
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Activity
            </Button>
            <Link href="/categories" passHref>
              <Button variant="outline" aria-label="Manage Categories">
                <Settings className="h-5 w-5" />
                <span className="sr-only sm:not-sr-only sm:ml-2">Categories</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <ActivityModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
