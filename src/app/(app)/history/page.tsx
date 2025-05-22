
"use client";

import React from 'react';
import Link from 'next/link';
import { useAppStore } from '@/hooks/use-app-store';
import { useTranslations } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, History, User, Briefcase, Tag, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const { historyLog } = useAppStore();
  const { t, locale } = useTranslations();
  const dateLocale = locale === 'es' ? es : enUS;

  const getScopeInfo = (scope: string) => {
    switch (scope) {
      case 'account':
        return { label: t('historyScopeAccount'), icon: Shield, color: 'bg-blue-500 dark:bg-blue-700' };
      case 'personal':
        return { label: t('historyScopePersonal'), icon: User, color: 'bg-green-500 dark:bg-green-700' };
      case 'work':
        return { label: t('historyScopeWork'), icon: Briefcase, color: 'bg-purple-500 dark:bg-purple-700' };
      case 'category':
        return { label: t('historyScopeCategory'), icon: Tag, color: 'bg-orange-500 dark:bg-orange-700' };
      default:
        return { label: scope, icon: History, color: 'bg-gray-500 dark:bg-gray-700' };
    }
  };

  return (
    <div className="flex flex-col flex-grow min-h-screen">
      <main className="flex-grow container mx-auto py-8 px-4">
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
              <History className="h-6 w-6 text-primary" />
              <CardTitle>{t('historyPageTitle')}</CardTitle>
            </div>
            <CardDescription>{t('historyPageDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLog.length > 0 ? (
              <ScrollArea className="h-[calc(100vh-20rem)] pr-2">
                <ul className="space-y-4">
                  {historyLog.map((entry) => {
                    const scopeInfo = getScopeInfo(entry.scope);
                    return (
                      <li key={entry.id} className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg shadow-sm border">
                        <div className={cn("mt-1 p-1.5 rounded-full text-white", scopeInfo.color)}>
                           <scopeInfo.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {t(entry.actionKey, entry.details as any)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(entry.timestamp), 'PPpp', { locale: dateLocale })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-center text-muted-foreground py-10">{t('noHistoryYet')}</p>
            )}
          </CardContent>
          {historyLog.length > 0 && (
            <CardFooter className="text-sm text-muted-foreground">
              {t('categoriesCount', { count: historyLog.length })} {/* Re-using categoriesCount for log count, can be changed */}
            </CardFooter>
          )}
        </Card>
      </main>
    </div>
  );
}
