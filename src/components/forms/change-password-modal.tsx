
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/contexts/language-context';
import { HARDCODED_PASSWORD } from '@/lib/constants'; // Superuser password
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '@/hooks/use-app-store';

// This is the default password assigned to users created via the UI
// It needs to be accessible here for the change password modal to work for them.
const DEFAULT_CREATED_USER_PASSWORD = "P@ssword123";

const PASSWORD_MIN_LENGTH = 6;

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { t } = useTranslations();
  const { toast } = useToast();
  const { logPasswordChange } = useAppStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const changePasswordFormSchema = z.object({
    currentPassword: z.string().min(1, t('passwordUpdateErrorIncorrectCurrent')),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, t('passwordMinLength', { length: PASSWORD_MIN_LENGTH })),
    confirmNewPassword: z.string().min(1, t('passwordUpdateErrorConfirmPasswordRequired')),
  }).refine(data => data.newPassword === data.confirmNewPassword, {
    message: t('passwordUpdateErrorPasswordsDoNotMatch'),
    path: ["confirmNewPassword"],
  }).refine(data => data.currentPassword !== data.newPassword, {
    message: t('passwordUpdateErrorCurrentEqualsNew'),
    path: ["newPassword"],
  });

  type ChangePasswordFormData = z.infer<typeof changePasswordFormSchema>;

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    setServerError(null);
    // Allow changing password if currentPassword matches either the superuser or the default created user password
    if (data.currentPassword !== HARDCODED_PASSWORD && data.currentPassword !== DEFAULT_CREATED_USER_PASSWORD) {
      setServerError(t('passwordUpdateErrorIncorrectCurrent'));
      return;
    }

    logPasswordChange();

    toast({
      title: t('passwordUpdateSuccessTitle'),
      description: t('passwordUpdateSuccessDescription'),
    });
    form.reset();
    onClose();
  };

  const handleCloseDialog = () => {
    form.reset();
    setServerError(null);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('changePasswordModalTitle')}</DialogTitle>
          <DialogDescription>
            {t('changePasswordModalDescription')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('currentPasswordLabel')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder={t('currentPasswordPlaceholder')}
                        {...field}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        aria-label={showCurrentPassword ? t('hidePassword') : t('showPassword')}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('newPasswordLabel')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder={t('newPasswordPlaceholder')}
                        {...field}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                         aria-label={showNewPassword ? t('hidePassword') : t('showPassword')}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmNewPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('confirmNewPasswordLabel')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmNewPassword ? "text" : "password"}
                        placeholder={t('confirmNewPasswordPlaceholder')}
                        {...field}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        aria-label={showConfirmNewPassword ? t('hidePassword') : t('showPassword')}
                      >
                        {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             {serverError && (
              <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>{t('loginErrorTitle')}</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                {t('cancel')}
              </Button>
              <Button type="submit">{t('updatePasswordButton')}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

