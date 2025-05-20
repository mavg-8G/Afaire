
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
import { HARDCODED_PASSWORD } from '@/lib/constants'; // Assuming you moved it here
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';


const PASSWORD_MIN_LENGTH = 6;

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { t } = useTranslations();
  const { toast } = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const changePasswordFormSchema = z.object({
    currentPassword: z.string().min(1, t('passwordUpdateErrorIncorrectCurrent')), // Simplified, actual check in submit
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
    if (data.currentPassword !== HARDCODED_PASSWORD) {
      // form.setError("currentPassword", { type: "manual", message: t('passwordUpdateErrorIncorrectCurrent') });
      setServerError(t('passwordUpdateErrorIncorrectCurrent'));
      return;
    }

    // In a real app, you'd call an API to change the password here.
    // For this prototype, we just show a success message.
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
                    <Input type="password" placeholder={t('currentPasswordPlaceholder')} {...field} />
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
                    <Input type="password" placeholder={t('newPasswordPlaceholder')} {...field} />
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
                    <Input type="password" placeholder={t('confirmNewPasswordPlaceholder')} {...field} />
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
