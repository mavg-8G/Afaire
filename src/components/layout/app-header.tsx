
"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Settings, Languages, Sun, Moon, Laptop, MoreVertical, User, Briefcase, LogOut, KeyRound, LayoutDashboard, Bell, CheckCircle, Trash } from 'lucide-react';
import { LogoIcon } from '@/components/icons/logo-icon';
import { APP_NAME } from '@/lib/constants';
import ChangePasswordModal from '@/components/forms/change-password-modal';
import { useTranslations } from '@/contexts/language-context';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAppStore } from '@/hooks/use-app-store';
import type { UINotification } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { formatDistanceToNowStrict } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
    clearAllUINotifications 
  } = useAppStore();
  const router = useRouter();
  const dateLocale = locale === 'es' ? es : enUS;

  const handleModeToggle = (isWorkMode: boolean) => {
    setAppMode(isWorkMode ? 'work' : 'personal');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const appModeToggleSwitch = (
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
    <div className="flex items-center space-x-2">
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

          <div className="hidden md:flex">
            {desktopAppModeToggleSwitch}
          </div>

          <div className="flex items-center gap-x-1 sm:gap-x-2">
            <div className="hidden md:flex items-center gap-x-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label={t('notificationBellLabel')} className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute top-0 right-0 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary text-xs text-primary-foreground items-center justify-center">
                           {/* {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount} */}
                        </span>
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
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
              </DropdownMenu>

               <Link href="/dashboard" passHref>
                <Button variant="outline" size="icon" aria-label={t('dashboard')}>
                  <LayoutDashboard className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/categories" passHref>
                <Button variant="outline" size="icon" aria-label={t('manageCategories')}>
                  <Settings className="h-5 w-5" />
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

              <Button variant="outline" size="icon" aria-label={t('changePassword')} onClick={() => setIsChangePasswordModalOpen(true)}>
                <KeyRound className="h-5 w-5" />
              </Button>

              <Button variant="outline" size="icon" aria-label={t('logout')} onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>

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
                    {appModeToggleSwitch}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                     <Link href="#" className="flex items-center w-full" onClick={(e) => {
                        e.preventDefault(); // Prevent navigation if it's just a trigger
                        // Find the Bell button and click it programmatically
                        const bellButton = document.getElementById('desktop-notification-bell');
                        if (bellButton) {
                            // Close the current MoreVertical dropdown first
                            // This is tricky without direct control over Radix state from outside.
                            // A simpler approach for mobile might be a dedicated notification item.
                            // For now, this will just be a label, or we create a sub-menu.
                            // Let's make it a sub-menu for better UX on mobile.
                        }
                     }}>
                       <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Bell className="mr-2 h-4 w-4" />
                            {t('notificationsTitle')}
                            {unreadNotificationsCount > 0 && (
                              <span className="ml-auto text-xs bg-primary text-primary-foreground h-4 w-4 rounded-full flex items-center justify-center">
                                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                              </span>
                            )}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent className="w-72 max-h-[60vh] flex flex-col">
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
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                       </DropdownMenuSub>
                     </Link>
                  </DropdownMenuItem>


                   <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center w-full">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      {t('dashboard')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/categories" className="flex items-center w-full">
                      <Settings className="mr-2 h-4 w-4" />
                      {t('manageCategories')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsChangePasswordModalOpen(true)}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    {t('changePassword')}
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          </div>
        </div>
      </header>
      <ChangePasswordModal isOpen={isChangePasswordModalOpen} onClose={() => setIsChangePasswordModalOpen(false)} />
    </>
  );
}
