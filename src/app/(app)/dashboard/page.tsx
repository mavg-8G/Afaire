
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { BarChart } from '@/components/ui/chart';
import type { BarChartDataItem, BarProps as ChartBarProps } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  getDay as getDayOfWeekFn, // Renamed to avoid conflict
} from 'date-fns';
import { enUS, es, fr } from 'date-fns/locale';
import { ArrowLeft, LayoutDashboard, ListChecks, BarChart3, CheckCircle, Circle, TrendingUp, LineChart, ActivityIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ChartViewMode = 'weekly' | 'monthly';
type ListViewTimeRange = 'last7days' | 'currentMonth';
type ProductivityViewTimeRange = 'last7days' | 'currentMonth';
type DashboardMainView = 'chart' | 'list' | 'productivity';


const isActivityChartCompleted = (activity: Activity): boolean => {
  if (activity.todos && activity.todos.length > 0) {
    return activity.todos.every(todo => todo.completed);
  }
  // For activities without todos, check their own completed status
  return !!activity.completed;
};

export default function DashboardPage() {
  const { activities: rawActivities, getRawActivities, getCategoryById, categories } = useAppStore();
  const { t, locale } = useTranslations();
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('weekly');
  const [listViewTimeRange, setListViewTimeRange] = useState<ListViewTimeRange>('last7days');
  const [productivityViewTimeRange, setProductivityViewTimeRange] = useState<ProductivityViewTimeRange>('last7days');
  const [dashboardMainView, setDashboardMainView] = useState<DashboardMainView>('chart');
  const [hasMounted, setHasMounted] = useState(false);

  const dateLocale = locale === 'es' ? es : locale === 'fr' ? fr : enUS;
  const activities = useMemo(() => getRawActivities(), [getRawActivities]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const chartData = useMemo((): BarChartDataItem[] => {
    if (!hasMounted) return [];
    const allActivities = getRawActivities(); // Use raw activities for chart generation

    if (chartViewMode === 'weekly') {
      const today = new Date();
      return Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(today, 6 - i);
        const dailyActivities = allActivities.filter(activity =>
          activity.createdAt && isSameDay(new Date(activity.createdAt), date)
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

        const weekActivities = allActivities.filter(activity => {
          const activityDate = activity.createdAt ? new Date(activity.createdAt) : new Date();
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
  }, [getRawActivities, chartViewMode, dateLocale, t, hasMounted]);

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
    const allActivities = getRawActivities();
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (listViewTimeRange === 'last7days') {
      startDate = subDays(now, 6);
    } else { // currentMonth
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    }

    return allActivities
      .filter(activity => {
        const activityDate = activity.createdAt ? new Date(activity.createdAt) : new Date();
        return isWithinInterval(activityDate, { start: startDate, end: endDate });
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [getRawActivities, listViewTimeRange, hasMounted]);


  const productivityData = useMemo(() => {
    if (!hasMounted) return { categoryChartData: [], overallCompletionRate: 0, totalActivitiesInPeriod: 0, totalCompletedInPeriod: 0, dayOfWeekCompletions: [] as BarChartDataItem[], peakProductivityDays: [] as string[] };
    const allActivities = getRawActivities();
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (productivityViewTimeRange === 'last7days') {
      startDate = subDays(now, 6);
    } else { // currentMonth
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    }

    const relevantActivities = allActivities.filter(activity => {
      const activityDate = activity.createdAt ? new Date(activity.createdAt) : new Date();
      return isWithinInterval(activityDate, { start: startDate, end: endDate });
    });

    const completedActivitiesInPeriod = relevantActivities.filter(isActivityChartCompleted);
    const totalActivitiesInPeriod = relevantActivities.length;
    const totalCompletedInPeriod = completedActivitiesInPeriod.length;

    const overallCompletionRate = totalActivitiesInPeriod > 0
      ? (totalCompletedInPeriod / totalActivitiesInPeriod) * 100
      : 0;

    const categoryCounts: Record<string, number> = {};
    const dayOfWeekCounts: Record<string, number> = {
      [t('daySun')]: 0, [t('dayMon')]: 0, [t('dayTue')]: 0, [t('dayWed')]: 0,
      [t('dayThu')]: 0, [t('dayFri')]: 0, [t('daySat')]: 0,
    };
    const dayIndexToName = (dayIndex: number) => [t('daySun'), t('dayMon'), t('dayTue'), t('dayWed'), t('dayThu'), t('dayFri'), t('daySat')][dayIndex];


    completedActivitiesInPeriod.forEach(activity => {
      // Category counts
      const category = getCategoryById(activity.categoryId);
      const categoryName = category ? category.name : "Uncategorized";
      categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;

      // Day of week counts
      let completionDate: Date | null = null;
      if (activity.isRecurringInstance && activity.originalInstanceDate) {
        completionDate = new Date(activity.originalInstanceDate);
      } else if (!activity.isRecurringInstance && activity.completedAt) {
        completionDate = new Date(activity.completedAt);
      }

      if (completionDate && isWithinInterval(completionDate, { start: startDate, end: endDate })) {
        const dayName = dayIndexToName(getDayOfWeekFn(completionDate));
        if (dayName) {
            dayOfWeekCounts[dayName] = (dayOfWeekCounts[dayName] || 0) + 1;
        }
      }
    });

    const categoryChartData: BarChartDataItem[] = Object.entries(categoryCounts).map(([name, count]) => ({
      name,
      count,
    }));

    const dayOfWeekCompletions: BarChartDataItem[] = Object.entries(dayOfWeekCounts).map(([name, count]) => ({
      name,
      count,
    }));

    // Determine peak productivity days
    let peakDays: string[] = [];
    let maxCompletions = 0;
    dayOfWeekCompletions.forEach(item => {
        const count = Number(item.count);
        if (count > maxCompletions) {
            maxCompletions = count;
            peakDays = [item.name as string];
        } else if (count === maxCompletions && maxCompletions > 0) {
            peakDays.push(item.name as string);
        }
    });


    return {
      categoryChartData,
      overallCompletionRate,
      totalActivitiesInPeriod,
      totalCompletedInPeriod,
      dayOfWeekCompletions,
      peakProductivityDays: peakDays,
    };
  }, [getRawActivities, productivityViewTimeRange, hasMounted, getCategoryById, t, dateLocale]);

  const categoryChartBars: ChartBarProps[] = [
    {
      dataKey: 'count',
      fillVariable: '--chart-3',
      nameKey: 'dashboardActivityCountLabel',
      radius: [4,4,0,0]
    }
  ];
  const dayOfWeekChartBars: ChartBarProps[] = [
    {
      dataKey: 'count',
      fillVariable: '--chart-4',
      nameKey: 'dashboardCompletionsChartLabel',
      radius: [4,4,0,0]
    }
  ];

  if (!hasMounted) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center">
           <Skeleton className="h-10 w-36" />
           <Skeleton className="h-10 w-full md:w-auto md:max-w-xs mt-4 md:mt-0" />
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2 mt-1" />
          </CardHeader>
          <CardContent className="pt-6">
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <Link href="/" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToCalendar')}
          </Button>
        </Link>
        <Tabs value={dashboardMainView} onValueChange={(value) => setDashboardMainView(value as DashboardMainView)} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-3 md:w-auto mt-4 md:mt-0">
            <TabsTrigger value="chart">
              <BarChart3 className="mr-2 h-4 w-4" />
              {t('dashboardChartView')}
            </TabsTrigger>
            <TabsTrigger value="list">
              <ListChecks className="mr-2 h-4 w-4" />
              {t('dashboardListView')}
            </TabsTrigger>
            <TabsTrigger value="productivity">
              <TrendingUp className="mr-2 h-4 w-4" />
              {t('dashboardProductivityView')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
          {dashboardMainView === 'chart' && (
            <div>
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
            </div>
          )}

          {dashboardMainView === 'list' && (
            <div>
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
                              {activity.createdAt ? format(new Date(activity.createdAt), 'PPp', { locale: dateLocale }) : 'N/A'}
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
            </div>
          )}

          {dashboardMainView === 'productivity' && (
            <div className="space-y-6">
              <Tabs value={productivityViewTimeRange} onValueChange={(value) => setProductivityViewTimeRange(value as ProductivityViewTimeRange)} className="mb-4">
                <TabsList className="grid w-full grid-cols-2 md:w-1/2">
                  <TabsTrigger value="last7days">{t('dashboardListLast7Days')}</TabsTrigger>
                  <TabsTrigger value="currentMonth">{t('dashboardListCurrentMonth')}</TabsTrigger>
                </TabsList>
              </Tabs>
              <CardDescription className="text-center text-sm">
                  {t('dashboardProductivityTimeRange')} {productivityViewTimeRange === 'last7days' ? t('dashboardListLast7Days') : t('dashboardListCurrentMonth')}
              </CardDescription>


              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" /> {t('dashboardProductivityPatterns')}</CardTitle>
                  <CardDescription>{t('dashboardCompletionsByDay')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {productivityData.dayOfWeekCompletions.some(d => d.count > 0) ? (
                    <>
                      <BarChart data={productivityData.dayOfWeekCompletions} bars={dayOfWeekChartBars} xAxisDataKey="name" height={250} />
                      <p className="text-sm text-center mt-4 font-medium">
                        {productivityData.peakProductivityDays.length === 0 && t('dashboardNoPeakDay')}
                        {productivityData.peakProductivityDays.length === 1 && t('dashboardPeakDaySingle', { day: productivityData.peakProductivityDays[0] })}
                        {productivityData.peakProductivityDays.length > 1 && t('dashboardPeakDayMultiple', { days: productivityData.peakProductivityDays.join(', ') })}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('dashboardNoDataForAnalysis')}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ActivityIcon className="h-5 w-5" /> {t('dashboardCategoryBreakdown')}</CardTitle>
                  <CardDescription>{t('dashboardActivityCountLabel')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {productivityData.categoryChartData.length > 0 ? (
                    <BarChart data={productivityData.categoryChartData} bars={categoryChartBars} xAxisDataKey="name" height={300} />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('dashboardNoDataForAnalysis')}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /> {t('dashboardCompletionStats')}</CardTitle>
                  <CardDescription>
                     {productivityViewTimeRange === 'last7days' ? t('dashboardListLast7Days') : t('dashboardListCurrentMonth')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{t('dashboardOverallCompletionRate')}</span>
                    <span className="text-lg font-semibold text-primary">{productivityData.overallCompletionRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('dashboardTotalActivitiesLabel')}</span>
                    <span className="text-sm font-medium">{productivityData.totalActivitiesInPeriod}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('dashboardTotalCompletedLabel')}</span>
                    <span className="text-sm font-medium">{productivityData.totalCompletedInPeriod}</span>
                  </div>
                   {productivityData.totalActivitiesInPeriod === 0 && (
                     <p className="text-sm text-muted-foreground text-center pt-4">{t('dashboardNoDataForAnalysis')}</p>
                   )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
