
"use client";

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import type { BarChartDataItem, BarProps as ChartBarProps } from '@/components/ui/chart';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/hooks/use-app-store';
import type { Activity, Category, RecurrenceRule } from '@/lib/types';
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
  getDay as getDayOfWeekFn,
  differenceInCalendarDays,
  addDays as addDaysFns,
  startOfDay,
  endOfDay,
  formatISO,
  isBefore,
  isAfter,
  isEqual,
  addWeeks,
  addMonths,
  getDate as getDayOfMonthFn,
  setDate as setDayOfMonth // Added setDate
} from 'date-fns';
import { enUS, es, fr } from 'date-fns/locale';
import { ArrowLeft, LayoutDashboard, ListChecks, BarChart3, CheckCircle, Circle, TrendingUp, LineChart, ActivityIcon, Flame, Package, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('@/components/ui/chart').then(mod => mod.BarChart), {
  loading: () => <Skeleton className="h-[350px] w-full" />,
  ssr: false,
});


type ChartViewMode = 'weekly' | 'monthly';
type ListViewTimeRange = 'last7days' | 'currentMonth';
type ProductivityViewTimeRange = 'last7days' | 'currentMonth';
type DashboardMainView = 'chart' | 'list' | 'productivity';


// Helper to generate instances for dashboard calculations
function generateDashboardInstances(
  masterActivity: Activity,
  viewStartDate: Date,
  viewEndDate: Date
): Activity[] {
  if (!masterActivity.recurrence || masterActivity.recurrence.type === 'none') {
    const activityDate = new Date(masterActivity.createdAt);
    if (isWithinInterval(activityDate, { start: viewStartDate, end: viewEndDate }) || isSameDay(activityDate, viewStartDate) || isSameDay(activityDate, viewEndDate)) {
       return [{
        ...masterActivity,
        isRecurringInstance: false,
        originalInstanceDate: masterActivity.createdAt,
        masterActivityId: masterActivity.id
      }];
    }
    return [];
  }

  const instances: Activity[] = [];
  const recurrence = masterActivity.recurrence;
  let currentDate = new Date(masterActivity.createdAt);

   if (isBefore(currentDate, viewStartDate)) {
      if (recurrence.type === 'daily') {
          currentDate = viewStartDate;
      } else if (recurrence.type === 'weekly' && recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
          let tempDate = startOfWeek(viewStartDate, { weekStartsOn: 0 /* Sunday */ });
          while(isBefore(tempDate, new Date(masterActivity.createdAt)) || !recurrence.daysOfWeek.includes(getDayOfWeekFn(tempDate)) || isBefore(tempDate, viewStartDate) ) {
              tempDate = addDaysFns(tempDate, 1);
              if (isAfter(tempDate, viewEndDate) && isAfter(tempDate, new Date(masterActivity.createdAt))) break;
          }
          currentDate = tempDate;

      } else if (recurrence.type === 'monthly' && recurrence.dayOfMonth) {
          let tempMasterStartMonthDay = setDayOfMonth(new Date(masterActivity.createdAt), recurrence.dayOfMonth);
          if (isBefore(tempMasterStartMonthDay, new Date(masterActivity.createdAt))) {
              tempMasterStartMonthDay = addMonths(tempMasterStartMonthDay, 1);
          }
          currentDate = setDayOfMonth(viewStartDate, recurrence.dayOfMonth);
          if (isBefore(currentDate, viewStartDate)) currentDate = addMonths(currentDate,1); 
          if (isBefore(currentDate, tempMasterStartMonthDay)) {
             currentDate = tempMasterStartMonthDay;
          }
      }
  }


  const seriesEndDate = recurrence.endDate ? new Date(recurrence.endDate) : null;
  let iterations = 0;
  const maxIterations = 366 * 2; 

  while (iterations < maxIterations && !isAfter(currentDate, viewEndDate)) {
    iterations++;
    if (seriesEndDate && isAfter(currentDate, seriesEndDate)) break;
    if (isBefore(currentDate, new Date(masterActivity.createdAt))) {
        if (recurrence.type === 'daily') currentDate = addDaysFns(currentDate, 1);
        else if (recurrence.type === 'weekly') currentDate = addDaysFns(currentDate, 1); 
        else if (recurrence.type === 'monthly') {
           if (recurrence.dayOfMonth) {
                let nextIterationDate;
                const currentMonthTargetDay = setDayOfMonth(currentDate, recurrence.dayOfMonth);
                if(isAfter(currentMonthTargetDay, currentDate) && getDayOfMonthFn(currentMonthTargetDay) === recurrence.dayOfMonth){
                     nextIterationDate = currentMonthTargetDay;
                } else {
                     let nextMonthDate = addMonths(currentDate, 1);
                     nextIterationDate = setDayOfMonth(nextMonthDate, recurrence.dayOfMonth);
                }
                currentDate = nextIterationDate;
            } else {
                currentDate = addDaysFns(currentDate, 1); // Fallback if dayOfMonth is not set
            }
        } else break;
        continue;
    }

    let isValidOccurrence = false;
    switch (recurrence.type) {
      case 'daily':
        isValidOccurrence = true;
        break;
      case 'weekly':
        if (recurrence.daysOfWeek?.includes(getDayOfWeekFn(currentDate))) {
          isValidOccurrence = true;
        }
        break;
      case 'monthly':
        if (recurrence.dayOfMonth && getDayOfMonthFn(currentDate) === recurrence.dayOfMonth) {
          isValidOccurrence = true;
        }
        break;
    }

    if (isValidOccurrence) {
      const occurrenceDateKey = formatISO(currentDate, { representation: 'date' });
      instances.push({
        ...masterActivity,
        id: `${masterActivity.id}_${currentDate.getTime()}`,
        isRecurringInstance: true,
        originalInstanceDate: currentDate.getTime(),
        masterActivityId: masterActivity.id,
        completed: !!masterActivity.completedOccurrences?.[occurrenceDateKey],
        todos: masterActivity.todos.map(todo => ({...todo, id: uuidv4(), completed: false})), 
      });
    }

    if (recurrence.type === 'daily') {
      currentDate = addDaysFns(currentDate, 1);
    } else if (recurrence.type === 'weekly') {
      currentDate = addDaysFns(currentDate, 1); 
    } else if (recurrence.type === 'monthly') {
        if (recurrence.dayOfMonth) {
            let nextIterationDate;
            const currentMonthTargetDay = setDayOfMonth(currentDate, recurrence.dayOfMonth);
            if(isAfter(currentMonthTargetDay, currentDate) && getDayOfMonthFn(currentMonthTargetDay) === recurrence.dayOfMonth){ 
                 nextIterationDate = currentMonthTargetDay;
            } else { 
                 let nextMonthDate = addMonths(currentDate, 1);
                 nextIterationDate = setDayOfMonth(nextMonthDate, recurrence.dayOfMonth);
            }
            currentDate = nextIterationDate;
        } else {
            currentDate = addDaysFns(currentDate, 1); 
        }
    } else {
      break;
    }
  }
  return instances;
}


// Helper to check if a specific instance is complete
const isInstanceCompletedForDashboard = (
  instance: Activity,
  rawMasterActivitiesList: Activity[] // Pass the list of master activities
): boolean => {
  if (!instance.isRecurringInstance && instance.originalInstanceDate === instance.createdAt) {
    // For non-recurring master activities, its 'completed' status is already derived from its main occurrence.
    return !!instance.completed;
  }
  
  // For a recurring instance, or potentially a non-recurring master that somehow got here without originalInstanceDate set
  const masterActivity = rawMasterActivitiesList.find(ma => ma.id === instance.masterActivityId);
  if (!masterActivity) {
    console.warn(`Dashboard: Master activity with ID ${instance.masterActivityId} not found for instance.`);
    return false;
  }

  if (instance.originalInstanceDate) {
    const occurrenceDateKey = formatISO(new Date(instance.originalInstanceDate), { representation: 'date' });
    return !!masterActivity.completedOccurrences?.[occurrenceDateKey];
  }

  // Fallback for safety, though should ideally not be reached if instance.originalInstanceDate is always set
  return !!instance.completed;
};


export default function DashboardPage() {
  const { getRawActivities, getCategoryById } = useAppStore();
  const { t, locale } = useTranslations();
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('weekly');
  const [listViewTimeRange, setListViewTimeRange] = useState<ListViewTimeRange>('last7days');
  const [productivityViewTimeRange, setProductivityViewTimeRange] = useState<ProductivityViewTimeRange>('last7days');
  const [dashboardMainView, setDashboardMainView] = useState<DashboardMainView>('chart');
  const [hasMounted, setHasMounted] = useState(false);

  const dateLocale = locale === 'es' ? es : locale === 'fr' ? fr : enUS;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const chartData = useMemo((): BarChartDataItem[] => {
    if (!hasMounted) return [];
    const rawMasterActivities = getRawActivities();
    const today = new Date();

    if (chartViewMode === 'weekly') {
      return Array.from({ length: 7 }).map((_, i) => {
        const currentDateForChart = subDays(today, 6 - i);
        const dayStart = startOfDay(currentDateForChart);
        const dayEnd = endOfDay(currentDateForChart);
        
        let totalInstancesThisDay = 0;
        let completedInstancesThisDay = 0;

        rawMasterActivities.forEach(masterActivity => {
          const instances = generateDashboardInstances(masterActivity, dayStart, dayEnd);
          instances.forEach(instance => {
            if (instance.originalInstanceDate && isSameDay(new Date(instance.originalInstanceDate), currentDateForChart)) {
              totalInstancesThisDay++;
              if (isInstanceCompletedForDashboard(instance, rawMasterActivities)) {
                completedInstancesThisDay++;
              }
            }
          });
        });
        
        return {
          name: format(currentDateForChart, 'E', { locale: dateLocale }),
          total: totalInstancesThisDay,
          completed: completedInstancesThisDay,
        };
      });
    } else { // monthly
      const currentMonth = new Date();
      const firstDayOfMonth = startOfMonth(currentMonth);
      const lastDayOfMonth = endOfMonth(currentMonth);
      const weekStartsOn = dateLocale.options?.weekStartsOn ?? 0;

      const weeksInMonth = eachWeekOfInterval(
        { start: firstDayOfMonth, end: lastDayOfMonth },
        { locale: dateLocale, weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 }
      );

      return weeksInMonth.map((weekStartDateInLoop, index) => {
        const actualWeekStart = startOfWeek(weekStartDateInLoop, { locale: dateLocale, weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        const actualWeekEnd = endOfWeek(weekStartDateInLoop, { locale: dateLocale, weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
        
        let totalInstancesThisWeek = 0;
        let completedInstancesThisWeek = 0;

        rawMasterActivities.forEach(masterActivity => {
          const instances = generateDashboardInstances(masterActivity, actualWeekStart, actualWeekEnd);
          instances.forEach(instance => {
            totalInstancesThisWeek++;
            if (isInstanceCompletedForDashboard(instance, rawMasterActivities)) {
              completedInstancesThisWeek++;
            }
          });
        });

        return {
          name: `${t('dashboardWeekLabel')}${index + 1}`,
          total: totalInstancesThisWeek,
          completed: completedInstancesThisWeek,
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
    const rawMasterActivities = getRawActivities();
    const now = new Date();
    let rangeStartDate: Date;
    let rangeEndDate: Date = endOfDay(now); 

    if (listViewTimeRange === 'last7days') {
      rangeStartDate = startOfDay(subDays(now, 6));
    } else { // currentMonth
      rangeStartDate = startOfDay(startOfMonth(now));
      rangeEndDate = endOfDay(endOfMonth(now));
    }

    let allInstancesInRange: Activity[] = [];
    rawMasterActivities.forEach(masterActivity => {
      allInstancesInRange.push(...generateDashboardInstances(masterActivity, rangeStartDate, rangeEndDate));
    });

    return allInstancesInRange.sort((a, b) => (b.originalInstanceDate || b.createdAt) - (a.originalInstanceDate || a.createdAt));
  }, [getRawActivities, listViewTimeRange, hasMounted]);


  const productivityData = useMemo(() => {
    if (!hasMounted) return { categoryChartData: [], overallCompletionRate: 0, totalActivitiesInPeriod: 0, totalCompletedInPeriod: 0, dayOfWeekCompletions: [] as BarChartDataItem[], peakProductivityDays: [] as string[], daysWithMostFailures: [] as string[] };
    
    const rawMasterActivities = getRawActivities();
    const now = new Date();
    let rangeStartDateFilter: Date;
    let rangeEndDateFilter: Date = endOfDay(now);

    if (productivityViewTimeRange === 'last7days') {
      rangeStartDateFilter = startOfDay(subDays(now, 6));
    } else { // currentMonth
      rangeStartDateFilter = startOfDay(startOfMonth(now));
      rangeEndDateFilter = endOfDay(endOfMonth(now));
    }

    let relevantInstances: Activity[] = [];
    rawMasterActivities.forEach(masterActivity => {
      relevantInstances.push(...generateDashboardInstances(masterActivity, rangeStartDateFilter, rangeEndDateFilter));
    });
    
    const completedInstancesInPeriod = relevantInstances.filter(instance => isInstanceCompletedForDashboard(instance, rawMasterActivities));
    const totalActivitiesInPeriod = relevantInstances.length;
    const totalCompletedInPeriod = completedInstancesInPeriod.length;

    const overallCompletionRate = totalActivitiesInPeriod > 0
      ? (totalCompletedInPeriod / totalActivitiesInPeriod) * 100
      : 0;

    const categoryCounts: Record<string, number> = {};
    const dayOfWeekData: Record<string, { total: number, completed: number, incomplete: number }> = {};
    const dayIndexToName = (dayIndex: number) => [t('daySun'), t('dayMon'), t('dayTue'), t('dayWed'), t('dayThu'), t('dayFri'), t('daySat')][dayIndex];
    
    // Initialize dayOfWeekData
    for (let i = 0; i < 7; i++) {
        const dayName = dayIndexToName(i);
        dayOfWeekData[dayName] = { total: 0, completed: 0, incomplete: 0 };
    }


    completedInstancesInPeriod.forEach(instance => {
      const category = getCategoryById(instance.categoryId);
      const categoryName = category ? category.name : "Uncategorized";
      categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
    });
    
    relevantInstances.forEach(instance => {
        if (instance.originalInstanceDate) {
            const instanceDate = new Date(instance.originalInstanceDate);
            if (isWithinInterval(instanceDate, { start: rangeStartDateFilter, end: rangeEndDateFilter })) {
                const dayName = dayIndexToName(getDayOfWeekFn(instanceDate));
                 if (dayName && dayOfWeekData[dayName]) {
                    dayOfWeekData[dayName].total++;
                    if(isInstanceCompletedForDashboard(instance, rawMasterActivities)){
                        dayOfWeekData[dayName].completed++;
                    } else {
                        dayOfWeekData[dayName].incomplete++;
                    }
                }
            }
        }
    });


    const categoryChartData: BarChartDataItem[] = Object.entries(categoryCounts).map(([name, count]) => ({
      name,
      count,
    }));

    const dayOfWeekCompletionsChartData: BarChartDataItem[] = Object.entries(dayOfWeekData).map(([name, data]) => ({
      name,
      count: data.completed, 
    }));
    
    let peakDays: string[] = [];
    let maxCompletions = 0;
    dayOfWeekCompletionsChartData.forEach(item => {
        const count = Number(item.count);
        if (count > maxCompletions) {
            maxCompletions = count;
            peakDays = [item.name as string];
        } else if (count === maxCompletions && maxCompletions > 0) {
            peakDays.push(item.name as string);
        }
    });

    let daysWithMostFailures: string[] = [];
    let maxIncomplete = 0;
    Object.entries(dayOfWeekData).forEach(([dayName, data]) => {
        if (data.incomplete > 0) { // Only consider days with actual incomplete tasks
            if (data.incomplete > maxIncomplete) {
                maxIncomplete = data.incomplete;
                daysWithMostFailures = [dayName];
            } else if (data.incomplete === maxIncomplete) {
                daysWithMostFailures.push(dayName);
            }
        }
    });


    return {
      categoryChartData,
      overallCompletionRate,
      totalActivitiesInPeriod,
      totalCompletedInPeriod,
      dayOfWeekCompletions: dayOfWeekCompletionsChartData, 
      peakProductivityDays: peakDays,
      daysWithMostFailures,
    };
  }, [getRawActivities, productivityViewTimeRange, hasMounted, getCategoryById, t, dateLocale]);

  const streakData = useMemo(() => {
    if (!hasMounted) return { currentStreak: 0, longestStreak: 0 };
    const rawMasterActivities = getRawActivities();
    const completionDates = new Set<string>(); 

    rawMasterActivities.forEach(masterActivity => {
      if (masterActivity.completedOccurrences) {
        Object.keys(masterActivity.completedOccurrences).forEach(dateKey => {
          if (masterActivity.completedOccurrences![dateKey]) {
            completionDates.add(dateKey);
          }
        });
      }
      if ((!masterActivity.recurrence || masterActivity.recurrence.type === 'none') && masterActivity.completed && masterActivity.completedAt) {
         completionDates.add(formatISO(new Date(masterActivity.completedAt), { representation: 'date' }));
      }
    });

    if (completionDates.size === 0) return { currentStreak: 0, longestStreak: 0 };

    const sortedCompletionDates = Array.from(completionDates).map(dateStr => parseISO(dateStr)).sort((a,b) => a.getTime() - b.getTime());
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < sortedCompletionDates.length; i++) {
      if (i === 0 || differenceInCalendarDays(sortedCompletionDates[i], sortedCompletionDates[i-1]) === 1) {
        tempStreak++;
      } else if (differenceInCalendarDays(sortedCompletionDates[i], sortedCompletionDates[i-1]) > 1) { 
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1; 
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    const today = startOfDay(new Date());
    const yesterday = startOfDay(subDays(today,1));
    
    let streakDayCandidate = today;
    if (completionDates.has(formatISO(today, {representation: 'date'}))) {
        streakDayCandidate = today;
    } else if (completionDates.has(formatISO(yesterday, {representation: 'date'}))) {
        streakDayCandidate = yesterday;
    } else { 
        return { currentStreak: 0, longestStreak };
    }

    let currentTempStreak = 0;
    for (let i = sortedCompletionDates.length - 1; i >= 0; i--) {
        if (isSameDay(sortedCompletionDates[i], streakDayCandidate)) {
            currentTempStreak++;
            streakDayCandidate = subDays(streakDayCandidate, 1);
        } else if (isBefore(sortedCompletionDates[i], streakDayCandidate)) {
            break;
        }
    }
    currentStreak = currentTempStreak;

    return { currentStreak, longestStreak };
  }, [getRawActivities, hasMounted]);


  const categoryChartBars: ChartBarProps[] = [ { dataKey: 'count', fillVariable: '--chart-3', nameKey: 'dashboardActivityCountLabel', radius: [4,4,0,0] } ];
  const dayOfWeekChartBars: ChartBarProps[] = [ { dataKey: 'count', fillVariable: '--chart-4', nameKey: 'dashboardCompletionsChartLabel', radius: [4,4,0,0] } ];

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
              {chartData.length > 0 && chartData.some(d => d.total > 0 || d.completed > 0) ? (
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
                    {listedActivities.map(instance => {
                      const rawMasterActivities = getRawActivities();
                      const masterActivity = rawMasterActivities.find(ma => ma.id === instance.masterActivityId) || instance;
                      const category = getCategoryById(masterActivity.categoryId);
                      const isCompleted = isInstanceCompletedForDashboard(instance, rawMasterActivities);
                      const displayDate = instance.originalInstanceDate ? new Date(instance.originalInstanceDate) : new Date(masterActivity.createdAt);
                      
                      return (
                        <Card key={instance.id} className={cn("shadow-sm", isCompleted && "opacity-70")}>
                          <CardHeader className="py-3 px-4">
                            <div className="flex justify-between items-start">
                              <CardTitle className={cn("text-md", isCompleted && "line-through text-muted-foreground")}>
                                {masterActivity.title}
                              </CardTitle>
                              {isCompleted ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                            </div>
                            <CardDescription className="text-xs">
                              {format(displayDate, 'PPp', { locale: dateLocale })}
                              {masterActivity.time && ` - ${masterActivity.time}`}
                            </CardDescription>
                          </CardHeader>
                          {(category || (masterActivity.todos && masterActivity.todos.length > 0)) && (
                            <CardContent className="py-2 px-4">
                              {category && (
                                <Badge variant="secondary" className="text-xs">
                                  {category.icon && <category.icon className="mr-1 h-3 w-3" />}
                                  {category.name}
                                </Badge>
                              )}
                              {masterActivity.todos && masterActivity.todos.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {t('todosCompleted', { completed: masterActivity.todos.filter(t => t.completed).length, total: masterActivity.todos.length})}
                                </p>
                              )}
                            </CardContent>
                          )}
                           {masterActivity.notes && (
                            <CardFooter className="text-xs text-muted-foreground py-2 px-4 border-t">
                                <p className="truncate" title={masterActivity.notes}>{t('dashboardNotesLabel')}: {masterActivity.notes}</p>
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
                    <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500" /> {t('dashboardStreaksTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{t('dashboardCurrentStreak')}:</span>
                        <span className="text-lg font-semibold text-primary">{t('dashboardStreakDays', {count: streakData.currentStreak})}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{t('dashboardLongestStreak')}:</span>
                        <span className="text-lg font-semibold text-primary">{t('dashboardStreakDays', {count: streakData.longestStreak})}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2">{t('dashboardStreakInsight')}</p>
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" /> {t('dashboardProductivityPatterns')}</CardTitle>
                  <CardDescription>{t('dashboardCompletionsByDay')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {productivityData.dayOfWeekCompletions.some(d => Number(d.count) > 0) ? (
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
                  <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-destructive" /> {t('dashboardFailureAnalysisTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {productivityData.totalActivitiesInPeriod > 0 ? (
                    productivityData.daysWithMostFailures.length > 0 ? (
                      <p className="text-sm text-center">
                        {t('dashboardFailureAnalysisMostIncomplete', { days: productivityData.daysWithMostFailures.join(', ') })}
                      </p>
                    ) : (
                      <p className="text-sm text-center text-green-600 dark:text-green-500">
                        {t('dashboardFailureAnalysisAllComplete')}
                      </p>
                    )
                  ) : (
                     <p className="text-sm text-muted-foreground text-center">{t('dashboardFailureAnalysisNoData')}</p>
                  )}
                  {productivityData.daysWithMostFailures.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      {t('dashboardFailureAnalysisInsight')}
                    </p>
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

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

