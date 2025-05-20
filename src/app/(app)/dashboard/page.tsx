
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { BarChart } from '@/components/ui/chart';
import type { BarChartDataItem, BarProps as ChartBarProps } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity } from '@/lib/types';
import { useTranslations } from '@/contexts/language-context';
import {
  format,
  subDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  isWithinInterval,
} from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type ViewMode = 'weekly' | 'monthly';

// Updated logic for determining if an activity is "chart completed"
const isActivityChartCompleted = (activity: Activity): boolean => {
  if (activity.todos && activity.todos.length > 0) {
    // If there are todos, completion depends on all todos being completed.
    return activity.todos.every(todo => todo.completed);
  } else {
    // If there are no todos, completion depends solely on the activity's own 'completed' flag.
    return !!activity.completed;
  }
};

export default function DashboardPage() {
  const { activities } = useAppStore();
  const { t, locale } = useTranslations();
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [hasMounted, setHasMounted] = useState(false);

  const dateLocale = locale === 'es' ? es : enUS;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const chartData = useMemo((): BarChartDataItem[] => {
    if (!hasMounted) return [];

    if (viewMode === 'weekly') {
      const today = new Date();
      return Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(today, 6 - i); // Iterate from 6 days ago to today
        const dailyActivities = activities.filter(activity =>
          isSameDay(new Date(activity.createdAt), date)
        );
        const completedCount = dailyActivities.filter(isActivityChartCompleted).length;
        return {
          name: format(date, 'E', { locale: dateLocale }), // Mon, Tue, etc.
          total: dailyActivities.length,
          completed: completedCount,
          // fullDate: format(date, 'MMM d', { locale: dateLocale }), // For tooltip, if needed
        };
      });
    } else { // monthly
      const currentMonth = new Date();
      const firstDayOfMonth = startOfMonth(currentMonth);
      const lastDayOfMonth = endOfMonth(currentMonth);
      // Ensure weekStartsOn is 1 for Monday, 0 for Sunday as per date-fns locale default
      const weekStartsOn = dateLocale.options?.weekStartsOn ?? 0;


      const weeks = eachWeekOfInterval(
        { start: firstDayOfMonth, end: lastDayOfMonth },
        { locale: dateLocale, weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 }
      );

      return weeks.map((weekStartDate, index) => {
        const actualWeekStart = startOfWeek(weekStartDate, { locale: dateLocale, weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        const actualWeekEnd = endOfWeek(weekStartDate, { locale: dateLocale, weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

        const weekActivities = activities.filter(activity => {
          const activityDate = new Date(activity.createdAt);
          return isWithinInterval(activityDate, { start: actualWeekStart, end: actualWeekEnd });
        });
        const completedCount = weekActivities.filter(isActivityChartCompleted).length;
        return {
          name: `${t('dashboardWeekLabel')}${index + 1}`,
          total: weekActivities.length,
          completed: completedCount,
          // period: `${format(actualWeekStart, 'MMM d')} - ${format(actualWeekEnd, 'MMM d')}` // For tooltip
        };
      });
    }
  }, [activities, viewMode, dateLocale, t, hasMounted]);

  const chartBars: ChartBarProps[] = [
    {
      dataKey: 'total',
      fillVariable: '--chart-1', // Using CSS variables defined in globals.css
      nameKey: 'dashboardChartTotalActivities',
      radius: [4,4,0,0]
    },
    {
      dataKey: 'completed',
      fillVariable: '--chart-2', // Using CSS variables
      nameKey: 'dashboardChartCompletedActivities',
      radius: [4,4,0,0]
    },
  ];
  
  if (!hasMounted) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6 flex justify-start">
           <Skeleton className="h-10 w-36" />
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2 mt-1" />
          </CardHeader>
          <CardContent className="pt-6">
            <Skeleton className="h-10 w-full mb-6" />
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex justify-start">
        <Link href="/" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToCalendar')}
          </Button>
        </Link>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <CardTitle>{t('dashboardTitle')}</CardTitle>
          </div>
          <CardDescription>
            {viewMode === 'weekly' ? t('dashboardViewWeekly') : t('dashboardViewMonthly')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 md:w-1/2">
              <TabsTrigger value="weekly">{t('dashboardViewWeekly')}</TabsTrigger>
              <TabsTrigger value="monthly">{t('dashboardViewMonthly')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {chartData.length > 0 ? (
             <BarChart data={chartData} bars={chartBars} xAxisDataKey="name" />
          ) : (
            <div className="flex items-center justify-center h-[350px] text-muted-foreground">
              {t('dashboardNoData')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

