
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAppStore } from '@/hooks/use-app-store';

const PASSWORD_MIN_LENGTH = 6; // From backend constraints if any, or a sensible default

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { t } = useTranslations();
  const { toast } = useToast();
  const { changePassword, getCurrentUserId } = useAppStore(); // Use new changePassword from AppStore
  const [serverError, setServerError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const changePasswordFormSchema = z.object({
    currentPassword: z.string().min(1, t('passwordUpdateErrorIncorrectCurrent')), // Keep this field, backend will verify
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

  const onSubmit = async (data: ChangePasswordFormData) => {
    setServerError(null);
    setIsSubmitting(true);

    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        setServerError("User not identified. Cannot change password."); // Or use a translation key
        setIsSubmitting(false);
        return;
    }

    const success = await changePassword(data.currentPassword, data.newPassword);

    if (success) {
      toast({
        title: t('passwordUpdateSuccessTitle'),
        description: t('passwordUpdateSuccessDescription'), // This translation will be updated
      });
      form.reset();
      onClose();
    } else {
      // Error message is set by AppProvider's changePassword via toast for backend errors
      // Or potentially set a local serverError if changePassword returns specific error messages
      setServerError(t('passwordUpdateFailedError')); // Add this translation
    }
    setIsSubmitting(false);
  };

  const handleCloseDialog = () => {
    form.reset();
    setServerError(null);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setIsSubmitting(false);
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
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        aria-label={showCurrentPassword ? t('hidePassword') : t('showPassword')}
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                         aria-label={showNewPassword ? t('hidePassword') : t('showPassword')}
                         disabled={isSubmitting}
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
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        aria-label={showConfirmNewPassword ? t('hidePassword') : t('showPassword')}
                        disabled={isSubmitting}
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
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('updatePasswordButton')}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
