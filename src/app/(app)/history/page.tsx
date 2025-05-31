
"use client";

import React from 'react';
import Link from 'next/link';
import { useAppStore } from '@/hooks/use-app-store';
import { useTranslations } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, History as HistoryIconLucide, User, Briefcase, Tag, Shield, Loader2 } from 'lucide-react'; // Renamed History to HistoryIconLucide
import { format } from 'date-fns';
import { enUS, es, fr } from 'date-fns/locale'; // Added fr
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const { historyLog, isLoading } = useAppStore(); // Added isLoading
  const { t, locale } = useTranslations();
  const dateLocale = locale === 'es' ? es : locale === 'fr' ? fr : enUS; // Added fr

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
      case 'assignee': // Added assignee scope
        return { label: t('historyScopeAssignee'), icon: User, color: 'bg-teal-500 dark:bg-teal-700' };
      default:
        return { label: scope, icon: HistoryIconLucide, color: 'bg-gray-500 dark:bg-gray-700' };
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
              <HistoryIconLucide className="h-6 w-6 text-primary" />
              <CardTitle>{t('historyPageTitle')}</CardTitle>
            </div>
            <CardDescription>{t('historyPageDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-[calc(100vh-20rem)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : historyLog.length > 0 ? (
              <ScrollArea className="h-[calc(100vh-20rem)] pr-2">
                <ul className="space-y-4">
                  {historyLog.map((entry) => {
                    const scopeInfo = getScopeInfo(entry.scope);
                    // Safely attempt to translate using actionKey; fallback to backendAction or a default
                    let actionText = entry.backendAction || entry.actionKey;
                    try {
                        actionText = t(entry.actionKey, entry.details as any);
                    } catch (e) {
                        // If translation key fails, use backendAction or key itself.
                        console.warn(`Missing translation for history action key: ${entry.actionKey}`);
                    }

                    return (
                      <li key={entry.id} className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg shadow-sm border">
                        <div className={cn("mt-1 p-1.5 rounded-full text-white", scopeInfo.color)}>
                           <scopeInfo.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {actionText}
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
          {!isLoading && historyLog.length > 0 && (
            <CardFooter className="text-sm text-muted-foreground">
              {/* Using a generic count for now, specific translation can be added */}
              {`${historyLog.length} ${historyLog.length === 1 ? 'entry' : 'entries'}`}
            </CardFooter>
          )}
        </Card>
      </main>
    </div>
  );
}
