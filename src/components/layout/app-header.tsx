
"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings, Languages, Sun, Moon, Laptop, MoreVertical, User, Briefcase } from 'lucide-react'; 
import { LogoIcon } from '@/components/icons/logo-icon';
import { APP_NAME } from '@/lib/constants';
import ActivityModal from '@/components/forms/activity-modal'; 
import { useTranslations } from '@/contexts/language-context';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAppStore } from '@/hooks/use-app-store';
import type { AppMode } from '@/lib/types';

export default function AppHeader() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t, setLocale, locale } = useTranslations();
  const { setTheme, theme } = useTheme();
  const { appMode, setAppMode } = useAppStore();

  const handleModeToggle = (isWorkMode: boolean) => {
    setAppMode(isWorkMode ? 'work' : 'personal');
  };

  const appModeToggleSwitch = (
    <div className="flex items-center space-x-2">
      <Label htmlFor="app-mode-toggle" className="text-sm font-medium text-muted-foreground">
        <User className={`inline-block h-4 w-4 mr-1 ${appMode === 'personal' ? 'text-primary' : ''}`} />
        {t('personalMode')}
      </Label>
      <Switch
        id="app-mode-toggle"
        checked={appMode === 'work'}
        onCheckedChange={handleModeToggle}
        aria-label="Toggle between personal and work mode"
      />
      <Label htmlFor="app-mode-toggle" className="text-sm font-medium text-muted-foreground">
        <Briefcase className={`inline-block h-4 w-4 mr-1 ${appMode === 'work' ? 'text-primary' : ''}`} />
        {t('workMode')}
      </Label>
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoIcon className="h-7 w-7 text-primary" />
            <Link href="/" className="text-xl font-bold tracking-tight text-foreground hover:no-underline sm:text-2xl">
                {APP_NAME}
            </Link>
          </div>
          <div className="flex items-center gap-x-1 sm:gap-x-2">
            <Button onClick={() => setIsModalOpen(true)} variant="default" size="sm" className="text-xs sm:text-sm sm:h-10 sm:px-4 sm:py-2">
              <PlusCircle className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />
              {t('addActivity')}
            </Button>
            
            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-x-3">
              {appModeToggleSwitch}

              <Link href="/categories" passHref>
                <Button variant="outline" aria-label={t('manageCategories')}>
                  <Settings className="h-5 w-5" />
                  {/* <span className="ml-2">{t('manageCategories')}</span> */}
                </Button>
              </Link>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">{t('theme')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTheme('light')} disabled={theme === 'light'}>
                    <Sun className="mr-2 h-4 w-4" />
                    {t('lightTheme')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')} disabled={theme === 'dark'}>
                    <Moon className="mr-2 h-4 w-4" />
                    {t('darkTheme')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')} disabled={theme === 'system'}>
                    <Laptop className="mr-2 h-4 w-4" />
                    {t('systemTheme')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Languages className="h-5 w-5" />
                    <span className="sr-only">{t('language')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocale('en')} disabled={locale === 'en'}>
                    {t('english')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale('es')} disabled={locale === 'es'}>
                    {t('spanish')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Actions */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">{t('moreOptions')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                   <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="focus:bg-transparent cursor-default">
                    {appModeToggleSwitch}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/categories" className="flex items-center w-full">
                      <Settings className="mr-2 h-4 w-4" />
                      {t('manageCategories')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t('theme')}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setTheme('light')} disabled={theme === 'light'}>
                    <Sun className="mr-2 h-4 w-4" />
                    {t('lightTheme')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')} disabled={theme === 'dark'}>
                    <Moon className="mr-2 h-4 w-4" />
                    {t('darkTheme')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')} disabled={theme === 'system'}>
                    <Laptop className="mr-2 h-4 w-4" />
                    {t('systemTheme')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setLocale('en')} disabled={locale === 'en'}>
                    {t('english')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale('es')} disabled={locale === 'es'}>
                    {t('spanish')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          </div>
        </div>
      </header>
      <ActivityModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

