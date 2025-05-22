
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { BarChart } from '@/components/ui/chart';
import type { BarChartDataItem, BarProps as ChartBarProps } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity, Category } from '@/lib/types';
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
  parseISO,
} from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { ArrowLeft, LayoutDashboard, ListChecks, BarChart3, CheckCircle, Circle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ChartViewMode = 'weekly' | 'monthly';
type ListViewTimeRange = 'last7days' | 'currentMonth';
type DashboardMainView = 'chart' | 'list';

const isActivityChartCompleted = (activity: Activity): boolean => {
  if (activity.todos && activity.todos.length > 0) {
    return activity.todos.every(todo => todo.completed);
  } else {
    return !!activity.completed;
  }
};

export default function DashboardPage() {
  const { activities, getCategoryById } = useAppStore();
  const { t, locale } = useTranslations();
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('weekly');
  const [listViewTimeRange, setListViewTimeRange] = useState<ListViewTimeRange>('last7days');
  const [dashboardMainView, setDashboardMainView] = useState<DashboardMainView>('chart');
  const [hasMounted, setHasMounted] = useState(false);

  const dateLocale = locale === 'es' ? es : enUS;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const chartData = useMemo((): BarChartDataItem[] => {
    if (!hasMounted) return [];

    if (chartViewMode === 'weekly') {
      const today = new Date();
      return Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(today, 6 - i);
        const dailyActivities = activities.filter(activity =>
          isSameDay(new Date(activity.createdAt), date)
        );
        const completedCount = dailyActivities.filter(isActivityChartCompleted).length;
        return {
          name: format(date, 'E', { locale: dateLocale }),
          total: dailyActivities.length,
          completed: completedCount,
        };
      });
    } else { // monthly
      const currentMonth = new Date();
      const firstDayOfMonth = startOfMonth(currentMonth);
      const lastDayOfMonth = endOfMonth(currentMonth);
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
        };
      });
    }
  }, [activities, chartViewMode, dateLocale, t, hasMounted]);

  const chartBars: ChartBarProps[] = [
    {
      dataKey: 'total',
      fillVariable: '--chart-1',
      nameKey: 'dashboardChartTotalActivities',
      radius: [4,4,0,0]
    },
    {
      dataKey: 'completed',
      fillVariable: '--chart-2',
      nameKey: 'dashboardChartCompletedActivities',
      radius: [4,4,0,0]
    },
  ];

  const listedActivities = useMemo(() => {
    if (!hasMounted) return [];
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (listViewTimeRange === 'last7days') {
      startDate = subDays(now, 6);
    } else { // currentMonth
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    }

    return activities
      .filter(activity => {
        const activityDate = new Date(activity.createdAt);
        return isWithinInterval(activityDate, { start: startDate, end: endDate });
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activities, listViewTimeRange, hasMounted]);

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
            {t('dashboardMainDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Tabs value={dashboardMainView} onValueChange={(value) => setDashboardMainView(value as DashboardMainView)} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 md:w-1/2">
              <TabsTrigger value="chart">
                <BarChart3 className="mr-2 h-4 w-4" />
                {t('dashboardChartView')}
              </TabsTrigger>
              <TabsTrigger value="list">
                <ListChecks className="mr-2 h-4 w-4" />
                {t('dashboardListView')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {dashboardMainView === 'chart' && (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {chartViewMode === 'weekly' ? t('dashboardViewWeekly') : t('dashboardViewMonthly')}
              </p>
              <Tabs value={chartViewMode} onValueChange={(value) => setChartViewMode(value as ChartViewMode)} className="mb-6">
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
            </>
          )}

          {dashboardMainView === 'list' && (
            <>
              <Tabs value={listViewTimeRange} onValueChange={(value) => setListViewTimeRange(value as ListViewTimeRange)} className="mb-4">
                <TabsList className="grid w-full grid-cols-2 md:w-1/2">
                  <TabsTrigger value="last7days">{t('dashboardListLast7Days')}</TabsTrigger>
                  <TabsTrigger value="currentMonth">{t('dashboardListCurrentMonth')}</TabsTrigger>
                </TabsList>
              </Tabs>
              {listedActivities.length > 0 ? (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {listedActivities.map(activity => {
                      const category = getCategoryById(activity.categoryId);
                      const isCompleted = isActivityChartCompleted(activity);
                      return (
                        <Card key={activity.id} className={cn("shadow-sm", isCompleted && "opacity-70")}>
                          <CardHeader className="py-3 px-4">
                            <div className="flex justify-between items-start">
                              <CardTitle className={cn("text-md", isCompleted && "line-through text-muted-foreground")}>
                                {activity.title}
                              </CardTitle>
                              {isCompleted ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                            </div>
                            <CardDescription className="text-xs">
                              {format(new Date(activity.createdAt), 'PPp', { locale: dateLocale })}
                              {activity.time && ` - ${activity.time}`}
                            </CardDescription>
                          </CardHeader>
                          {(category || (activity.todos && activity.todos.length > 0)) && (
                            <CardContent className="py-2 px-4">
                              {category && (
                                <Badge variant="secondary" className="text-xs">
                                  {category.icon && <category.icon className="mr-1 h-3 w-3" />}
                                  {category.name}
                                </Badge>
                              )}
                              {activity.todos && activity.todos.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {t('todosCompleted', { completed: activity.todos.filter(t => t.completed).length, total: activity.todos.length})}
                                </p>
                              )}
                            </CardContent>
                          )}
                           {activity.notes && (
                            <CardFooter className="text-xs text-muted-foreground py-2 px-4 border-t">
                                <p className="truncate" title={activity.notes}>{t('dashboardNotesLabel')}: {activity.notes}</p>
                            </CardFooter>
                           )}
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                  {t('dashboardNoActivitiesForList')}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
