
"use client";
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Layers, Languages, Sun, Moon, Laptop, User, Briefcase, LogOut, KeyRound, LayoutDashboard, Bell, CheckCircle, Trash, MoreHorizontal, History as HistoryIcon, Settings, MoreVertical, BellRing, BellOff, BellPlus, Users, Timer } from 'lucide-react';
import { LogoIcon } from '@/components/icons/logo-icon';
import { APP_NAME } from '@/lib/constants';
// import ChangePasswordModal from '@/components/forms/change-password-modal'; // Original import
import dynamic from 'next/dynamic'; // Import dynamic
import { useTranslations } from '@/contexts/language-context';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAppStore } from '@/hooks/use-app-store';
import { useRouter } from 'next/navigation';
import { formatDistanceToNowStrict } from 'date-fns';
import { enUS, es, fr } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import PomodoroTimerPopover from '@/components/pomodoro/pomodoro-timer-popover';

// Dynamically import ChangePasswordModal
const ChangePasswordModal = dynamic(() => import('@/components/forms/change-password-modal'), {
  ssr: false, // No need to SSR a modal that's initially closed
  loading: () => <p>Loading...</p> // Optional loading state
});

export default function AppHeader() {
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const { t, setLocale, locale } = useTranslations();
  const { setTheme, theme } = useTheme();
  const {
    appMode,
    setAppMode,
    logout,
    uiNotifications,
    markUINotificationAsRead,
    markAllUINotificationsAsRead,
    clearAllUINotifications,
    systemNotificationPermission,
    requestSystemNotificationPermission,
  } = useAppStore();
  const router = useRouter();

  const dateLocale = useMemo(() => {
    if (locale === 'es') return es;
    if (locale === 'fr') return fr;
    return enUS;
  }, [locale]);

  const handleModeToggle = (isWorkMode: boolean) => {
    setAppMode(isWorkMode ? 'work' : 'personal');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const appModeToggleSwitchMobile = (
    <div className="flex items-center space-x-2 px-2 py-1.5">
      <Label htmlFor="app-mode-toggle-mobile" className="text-sm font-medium text-muted-foreground flex items-center">
        <User className={`inline-block h-4 w-4 mr-1 ${appMode === 'personal' ? 'text-primary' : ''}`} />
        {t('personalMode')}
      </Label>
      <Switch
        id="app-mode-toggle-mobile"
        checked={appMode === 'work'}
        onCheckedChange={handleModeToggle}
        aria-label="Toggle between personal and work mode"
      />
      <Label htmlFor="app-mode-toggle-mobile" className="text-sm font-medium text-muted-foreground flex items-center">
        <Briefcase className={`inline-block h-4 w-4 mr-1 ${appMode === 'work' ? 'text-primary' : ''}`} />
        {t('workMode')}
      </Label>
    </div>
  );

  const desktopAppModeToggleSwitch = (
    <div className="hidden md:flex items-center gap-x-2">
      <Label htmlFor="app-mode-toggle-desktop" className="text-sm font-medium text-muted-foreground flex items-center">
        <User className={`inline-block h-4 w-4 mr-1 ${appMode === 'personal' ? 'text-primary' : ''}`} />
      </Label>
      <Switch
        id="app-mode-toggle-desktop"
        checked={appMode === 'work'}
        onCheckedChange={handleModeToggle}
        aria-label="Toggle between personal and work mode"
      />
      <Label htmlFor="app-mode-toggle-desktop" className="text-sm font-medium text-muted-foreground flex items-center">
        <Briefcase className={`inline-block h-4 w-4 mr-1 ${appMode === 'work' ? 'text-primary' : ''}`} />
      </Label>
    </div>
  );


  const unreadNotificationsCount = useMemo(() => uiNotifications.filter(n => !n.read).length, [uiNotifications]);
  const sortedNotifications = useMemo(() =>
    [...uiNotifications].sort((a, b) => b.timestamp - a.timestamp),
  [uiNotifications]);

  const notificationDropdownContent = (
    <DropdownMenuContent align="end" className="w-80 md:w-96 max-h-[70vh] flex flex-col">
      <DropdownMenuLabel className="flex justify-between items-center">
        {t('notificationsTitle')}
        {uiNotifications.length > 0 && (
           <span className="text-xs text-muted-foreground">({unreadNotificationsCount} {t('notificationUnread').toLowerCase()})</span>
        )}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {sortedNotifications.length > 0 ? (
        <>
          <ScrollArea className="flex-grow overflow-y-auto pr-1">
            {sortedNotifications.map(notification => (
              <DropdownMenuItem
                key={notification.id}
                className={cn("flex flex-col items-start gap-1 cursor-pointer hover:bg-accent/50", !notification.read && "bg-accent/30 font-medium")}
                onClick={() => markUINotificationAsRead(notification.id)}
                style={{ whiteSpace: 'normal', height: 'auto', lineHeight: 'normal', padding: '0.5rem 0.75rem'}}
              >
                <div className="w-full">
                    <p className={cn("text-sm", !notification.read && "font-semibold")}>{notification.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-full">{notification.description}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {formatDistanceToNowStrict(new Date(notification.timestamp), { addSuffix: true, locale: dateLocale })}
                    </p>
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={markAllUINotificationsAsRead} disabled={unreadNotificationsCount === 0}>
            <CheckCircle className="mr-2 h-4 w-4" /> {t('markAllAsRead')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={clearAllUINotifications} className="text-destructive hover:!bg-destructive/10">
             <Trash className="mr-2 h-4 w-4" /> {t('clearAllNotifications')}
          </DropdownMenuItem>
        </>
      ) : (
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">{t('noNotificationsYet')}</p>
      )}
    </DropdownMenuContent>
  );

  const systemNotificationMenuItem = () => {
    if (systemNotificationPermission === 'granted') {
      return (
        <DropdownMenuItem disabled>
          <BellRing className="mr-2 h-4 w-4 text-green-500" />
          {t('systemNotificationsEnabled')}
        </DropdownMenuItem>
      );
    } else if (systemNotificationPermission === 'denied') {
      return (
        <DropdownMenuItem disabled>
          <BellOff className="mr-2 h-4 w-4 text-red-500" />
          {t('systemNotificationsBlocked')}
        </DropdownMenuItem>
      );
    } else { // 'default' or null
      return (
        <DropdownMenuItem onClick={requestSystemNotificationPermission}>
          <BellPlus className="mr-2 h-4 w-4" />
          {t('enableSystemNotifications')}
        </DropdownMenuItem>
      );
    }
  };

  const sharedOptionsItems = (isMobileMenu: boolean) => (
    <>
      <DropdownMenuItem asChild>
        <Link href="/history" className="flex items-center w-full">
            <HistoryIcon className="mr-2 h-4 w-4" />
            {t('viewHistory')}
        </Link>
      </DropdownMenuItem>
      {appMode === 'personal' && !isMobileMenu && ( // Only for desktop "Options" menu
         <DropdownMenuItem asChild>
            <Link href="/assignees" className="flex items-center w-full">
                <Users className="mr-2 h-4 w-4" />
                {t('manageAssignees')}
            </Link>
        </DropdownMenuItem>
      )}
       {appMode === 'personal' && isMobileMenu && ( // For mobile "More Options" menu
         <DropdownMenuItem asChild>
            <Link href="/assignees" className="flex items-center w-full">
                <Users className="mr-2 h-4 w-4" />
                {t('manageAssignees')}
            </Link>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      {systemNotificationMenuItem()}
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
      <DropdownMenuItem onClick={() => setLocale('fr')} disabled={locale === 'fr'}>
        {t('french')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => setIsChangePasswordModalOpen(true)}>
        <KeyRound className="mr-2 h-4 w-4" />
        {t('changePassword')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        {t('logout')}
      </DropdownMenuItem>
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          {/* Left Group */}
          <Link href="/" className="flex items-center gap-2 ml-4 text-xl font-bold tracking-tight text-foreground hover:no-underline sm:text-2xl" aria-label="Home">
            <LogoIcon className="h-7 w-7 text-primary" />
            <span>{APP_NAME}</span>
          </Link>

          {/* Center Group: Desktop App Mode Toggle Switch */}
          {desktopAppModeToggleSwitch}


          {/* Right Group */}
          <div className="flex items-center gap-x-1 sm:gap-x-2 mr-4">
            
            {/* Pomodoro Timer - Desktop Only */}
            <div className="hidden md:block">
              <PomodoroTimerPopover />
            </div>

            {/* Notification Bell - Visible on all screen sizes */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t('notificationBellLabel')} className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary text-xs text-primary-foreground items-center justify-center">
                      </span>
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              {notificationDropdownContent}
            </DropdownMenu>

            {/* Desktop only action buttons and new Options Menu */}
            <div className="hidden md:flex items-center gap-x-1">
               <Link href="/dashboard" passHref>
                <Button variant="outline" size="icon" aria-label={t('dashboard')}>
                  <LayoutDashboard className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/categories" passHref>
                <Button variant="outline" size="icon" aria-label={t('manageCategories')}>
                  <Layers className="h-5 w-5" />
                </Button>
              </Link>
              {appMode === 'personal' && (
                <Link href="/assignees" passHref>
                  <Button variant="outline" size="icon" aria-label={t('manageAssignees')}>
                    <Users className="h-5 w-5" />
                  </Button>
                </Link>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label={t('moreOptionsDesktop')}>
                    <Settings className="h-5 w-5" /> 
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {sharedOptionsItems(false)} 
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile only "More Options" menu */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">{t('moreOptions')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="focus:bg-transparent cursor-default p-0">
                    {appModeToggleSwitchMobile}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                   <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center w-full">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      {t('dashboard')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/categories" className="flex items-center w-full">
                      <Layers className="mr-2 h-4 w-4" />
                      {t('manageCategories')}
                    </Link>
                  </DropdownMenuItem>
                  {sharedOptionsItems(true)} 
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      {isChangePasswordModalOpen && (
        <ChangePasswordModal isOpen={isChangePasswordModalOpen} onClose={() => setIsChangePasswordModalOpen(false)} />
      )}
    </>
  );
}

