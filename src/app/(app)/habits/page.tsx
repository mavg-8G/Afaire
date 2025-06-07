
"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Smile } from 'lucide-react';
import { useTranslations } from '@/contexts/language-context';
// import { useAppStore } from '@/hooks/use-app-store'; // Temporarily removed

export default function HabitsPage() {
  const { t } = useTranslations();
  // const { appMode } = useAppStore(); // Temporarily removed

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />{t('backToCalendar')}
          </Button>
        </Link>
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smile className="h-6 w-6 text-primary" />
            <CardTitle>{t('manageHabits')}</CardTitle>
          </div>
          <CardDescription>{t('habitsPageDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('habitsFeatureComingSoon')}</p>
          {/* Future UI for adding/editing habits will go here */}
        </CardContent>
      </Card>
    </div>
  );
}
