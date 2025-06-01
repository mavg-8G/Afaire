
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAppStore } from '@/hooks/use-app-store';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/contexts/language-context';
import { APP_NAME, HARDCODED_USERNAME, HARDCODED_PASSWORD } from '@/lib/constants';
import { LogoIcon } from '@/components/icons/logo-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Eye, EyeOff, Loader2 } from 'lucide-react';

const loginFormSchemaBase = z.object({
  username: z.string().min(1, 'loginUsernameRequired'),
  password: z.string().min(1, 'loginPasswordRequired'),
  rememberMe: z.boolean().default(false).optional(),
});

type LoginFormValues = z.infer<typeof loginFormSchemaBase>;

const MAX_ATTEMPTS_BEFORE_LOCKOUT = 2; // This was 5, changed to 2 for easier testing
const BASE_LOCKOUT_DURATION_SECONDS = 30;
const DEFAULT_CREATED_USER_PASSWORD = "P@ssword123"; // Password used for assignees if not specified

export default function LoginPage() {
  const {
    isAuthenticated,
    setIsAuthenticated,
    loginAttempts,
    setLoginAttempts,
    lockoutEndTime,
    setLockoutEndTime,
    assignees, // Get the list of users/assignees
    isLoading: isAppStoreLoading, // Use this to know if assignees are loaded
  } = useAppStore();
  const router = useRouter();
  const { t } = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingLockoutTime, setRemainingLockoutTime] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const loginFormSchema = useMemo(() => loginFormSchemaBase.extend({
    username: z.string().min(1, t('loginUsernameRequired')),
    password: z.string().min(1, t('loginPasswordRequired')),
  }), [t]);

  const form = useForm<LoginFormValues>({
    resolver: useMemo(() => zodResolver(loginFormSchema), [loginFormSchema]),
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (lockoutEndTime && lockoutEndTime > Date.now()) {
      const updateTimer = () => {
        const remaining = Math.ceil((lockoutEndTime - Date.now()) / 1000);
        if (remaining > 0) {
          setRemainingLockoutTime(remaining);
          setErrorMessage(t('loginLockoutMessage', { seconds: remaining }));
        } else {
          setRemainingLockoutTime(null);
          setLockoutEndTime(null);
          setErrorMessage(null);
          if (interval) clearInterval(interval);
        }
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else if (lockoutEndTime && lockoutEndTime <= Date.now()) {
      setLockoutEndTime(null);
      setRemainingLockoutTime(null);
      setErrorMessage(null);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lockoutEndTime, t, setLockoutEndTime]);


  const onSubmit = async (data: LoginFormValues) => {
    if (lockoutEndTime && lockoutEndTime > Date.now()) {
      setErrorMessage(t('loginLockoutMessage', { seconds: remainingLockoutTime || 0 }));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    let loggedIn = false;

    // 1. Check hardcoded superuser credentials
    if (data.username === HARDCODED_USERNAME && data.password === HARDCODED_PASSWORD) {
      setIsAuthenticated(true, data.rememberMe);
      setLoginAttempts(0);
      setLockoutEndTime(null);
      router.replace('/');
      loggedIn = true;
    } else {
      // 2. Check against created users (assignees list)
      // Ensure assignees are loaded before attempting to check
      if (!isAppStoreLoading && assignees) {
        const foundUser = assignees.find(
          (assignee) => assignee.username === data.username
        );

        // !!! INSECURE PASSWORD CHECK - FOR PROTOTYPING ONLY !!!
        // This checks against the default password used during assignee creation.
        // A real application MUST use a backend endpoint for password verification.
        if (foundUser && data.password === DEFAULT_CREATED_USER_PASSWORD) {
          setIsAuthenticated(true, data.rememberMe);
          setLoginAttempts(0);
          setLockoutEndTime(null);
          // Potentially store loggedInUser info if needed elsewhere
          router.replace('/');
          loggedIn = true;
        }
      } else if (isAppStoreLoading) {
        setErrorMessage("User data is still loading, please try again shortly.");
        setIsSubmitting(false);
        return;
      }
    }

    if (!loggedIn) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      setErrorMessage(t('loginInvalidCredentials'));

      if (newAttempts >= MAX_ATTEMPTS_BEFORE_LOCKOUT && newAttempts % MAX_ATTEMPTS_BEFORE_LOCKOUT === 0) {
        const lockoutMultiplier = Math.floor(newAttempts / MAX_ATTEMPTS_BEFORE_LOCKOUT); // ensure integer
        const currentLockoutDurationMs = BASE_LOCKOUT_DURATION_SECONDS * lockoutMultiplier * 1000;
        const newLockoutEndTime = Date.now() + currentLockoutDurationMs;
        setLockoutEndTime(newLockoutEndTime);
        setRemainingLockoutTime(Math.ceil(currentLockoutDurationMs / 1000));
        setErrorMessage(t('loginLockoutMessage', { seconds: Math.ceil(currentLockoutDurationMs / 1000) }));
      }
    }
    setIsSubmitting(false);
  };

  const isLockedOut = !!(lockoutEndTime && lockoutEndTime > Date.now());

  if (isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><p>{t('loginRedirecting')}</p></div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <LogoIcon className="h-10 w-10 text-primary" />
            <CardTitle className="text-3xl font-bold ml-2">{APP_NAME}</CardTitle>
          </div>
          <CardDescription>{t('loginWelcomeMessage')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('loginUsernameLabel')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('loginUsernamePlaceholder')} {...field} disabled={isLockedOut || isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('loginPasswordLabel')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder={t('loginPasswordPlaceholder')}
                          {...field}
                          disabled={isLockedOut || isSubmitting}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isLockedOut || isSubmitting}
                          aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                     <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLockedOut || isSubmitting}
                        aria-labelledby="remember-me-label"
                      />
                    </FormControl>
                    <FormLabel id="remember-me-label" className="font-normal">
                      {t('rememberMeLabel')}
                    </FormLabel>
                  </FormItem>
                )}
              />
              {errorMessage && !isLockedOut && (
                <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>{t('loginErrorTitle')}</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
               {isLockedOut && remainingLockoutTime && (
                 <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>{t('loginLockoutTitle')}</AlertTitle>
                  <AlertDescription>{t('loginLockoutMessage', { seconds: remainingLockoutTime })}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting || isLockedOut || isAppStoreLoading}>
                {isSubmitting || isAppStoreLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t('loginButtonText')
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="text-center text-xs text-muted-foreground">
            <p>{t('loginSecurityNotice')}</p>
        </CardFooter>
      </Card>
    </div>
  );
}

    
