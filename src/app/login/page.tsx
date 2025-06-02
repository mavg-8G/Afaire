
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Checkbox for "rememberMe" can be removed if not part of JWT strategy
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAppStore } from '@/hooks/use-app-store';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/contexts/language-context';
import { APP_NAME } from '@/lib/constants';
import { LogoIcon } from '@/components/icons/logo-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Eye, EyeOff, Loader2 } from 'lucide-react';

const loginFormSchemaBase = z.object({
  username: z.string().min(1, 'loginUsernameRequired'),
  password: z.string().min(1, 'loginPasswordRequired'),
  // rememberMe: z.boolean().default(false).optional(), // This is less relevant with JWT short expiry
});

type LoginFormValues = z.infer<typeof loginFormSchemaBase>;

export default function LoginPage() {
  const {
    isAuthenticated,
    login, // Use new login function
    isLoading: isAppStoreLoading,
  } = useAppStore();
  const router = useRouter();
  const { t } = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
      // rememberMe: false,
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);


  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const success = await login(data.username, data.password);

    if (success) {
      router.replace('/');
    } else {
      // Error message is set by AppProvider's login via toast for backend errors
      // For client-side interpretation, we can set a generic one or rely on toast
      setErrorMessage(t('loginInvalidCredentials')); // Or AppProvider might handle this via toast
    }
    setIsSubmitting(false);
  };


  if (isAuthenticated && !isAppStoreLoading) { // Wait for app store to confirm auth status
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
                      <Input placeholder={t('loginUsernamePlaceholder')} {...field} disabled={isSubmitting || isAppStoreLoading} />
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
                          disabled={isSubmitting || isAppStoreLoading}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isSubmitting || isAppStoreLoading}
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
              {/* Remember Me checkbox can be removed or adapted if JWT refresh tokens are used later */}
              {/* <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting || isAppStoreLoading}
                        aria-labelledby="remember-me-label"
                      />
                    </FormControl>
                    <FormLabel id="remember-me-label" className="font-normal">
                      {t('rememberMeLabel')}
                    </FormLabel>
                  </FormItem>
                )}
              /> */}
              {errorMessage && ( // This will show if login() fails and sets a local error
                <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>{t('loginErrorTitle')}</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting || isAppStoreLoading}>
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
             {/* Updated notice since backend handles auth now */}
            <p>{t('loginSecurityNoticeBackend')}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
