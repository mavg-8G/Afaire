
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAppStore } from '@/hooks/use-app-store';
import type { Assignee } from '@/lib/types';
import { Trash2, PlusCircle, Edit3, XCircle, ArrowLeft, Users, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslations } from '@/contexts/language-context';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 8; // Updated minimum password length

// Base schema definition, actual validation happens in the useMemo hook
const assigneeFormSchemaBase = z.object({
  name: z.string(),
  username: z.string(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  isAdmin: z.boolean().optional().default(false),
});

type AssigneeFormData = z.infer<typeof assigneeFormSchemaBase>;

export default function ManageAssigneesPage() {
  const { assignees, addAssignee, updateAssignee, deleteAssignee, appMode, isLoading: isAppStoreLoading } = useAppStore();
  const { t } = useTranslations();
  const router = useRouter();
  const [assigneeToDelete, setAssigneeToDelete] = useState<number | null>(null);
  const [editingAssignee, setEditingAssignee] = useState<Assignee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const assigneeFormSchema = useMemo(() => {
    const passwordValidationMessages = {
        length: t('passwordMinLength', { length: MIN_PASSWORD_LENGTH }),
        lowercase: t('passwordRequiresLowercase'),
        uppercase: t('passwordRequiresUppercase'),
        number: t('passwordRequiresNumber'),
        symbol: t('passwordRequiresSymbol'),
    };

    // This schema defines the rules for a valid password string if one is provided
    const individualPasswordSchema = z.string()
        .min(MIN_PASSWORD_LENGTH, passwordValidationMessages.length)
        .regex(/[a-z]/, passwordValidationMessages.lowercase)
        .regex(/[A-Z]/, passwordValidationMessages.uppercase)
        .regex(/[0-9]/, passwordValidationMessages.number)
        .regex(/[!@#$%^&*]/, passwordValidationMessages.symbol);

    return assigneeFormSchemaBase.extend({
      name: z.string().min(1, t('assigneeNameLabel')),
      username: z.string()
              .min(MIN_USERNAME_LENGTH, t('usernameMinLength', { length: MIN_USERNAME_LENGTH }))
              .min(1,t('usernameIsRequired')),
      // Password and confirmPassword are kept simple here; complex logic is in .superRefine
      password: z.string().optional(),
      confirmPassword: z.string().optional(),
      isAdmin: z.boolean().optional().default(false),
    }).superRefine((data, ctx) => {
      const isCreating = !editingAssignee;
      const passwordProvided = data.password && data.password.length > 0;

      // Rule 1: Password is required if creating a new user
      if (isCreating && (!data.password || data.password.trim() === "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('passwordIsRequiredForCreation'),
          path: ['password'],
        });
        // If password is required and not provided, no need to check complexity or confirmation yet.
        // Zod will stop on the first error for a path unless multiple issues are added for the same path in one go.
        // We return here to avoid further password checks if it's simply not provided when required.
        return;
      }

      // Rule 2: If a password string is provided (either for create or update), it must meet complexity requirements
      if (passwordProvided) {
        const parsedPassword = individualPasswordSchema.safeParse(data.password);
        if (!parsedPassword.success) {
          parsedPassword.error.issues.forEach(issue => {
            ctx.addIssue({ // Add each specific complexity error to the 'password' path
              code: z.ZodIssueCode.custom, // Use custom to ensure message is displayed
              message: issue.message,
              path: ['password'],
            });
          });
        }

        // Rule 3: If a password string is provided, it must be confirmed
        if (data.password !== data.confirmPassword) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('passwordUpdateErrorPasswordsDoNotMatch'),
            path: ['confirmPassword'],
          });
        }
      } else if (!isCreating && data.confirmPassword && data.confirmPassword.length > 0 && !passwordProvided) {
        // Edge case: Editing, confirmPassword is filled, but password is not.
        // This implies an attempt to set a password, so password field should also be filled.
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('passwordIsRequiredForCreation'), // Re-use or create new: "Password required if confirming new one"
            path: ['password'],
        });
      }
    });
  }, [t, editingAssignee]);


  const form = useForm<AssigneeFormData>({
    resolver: zodResolver(assigneeFormSchema),
    defaultValues: { name: "", username: "", password: "", confirmPassword: "", isAdmin: false },
    mode: 'onBlur', // Validate on blur to show errors after user moves from field
  });

  useEffect(() => {
    if (appMode === 'work') {
      router.replace('/');
    }
  }, [appMode, router]);

  useEffect(() => {
    if (editingAssignee) {
      form.reset({
        name: editingAssignee.name,
        username: editingAssignee.username || "",
        isAdmin: !!editingAssignee.isAdmin,
        password: "",
        confirmPassword: ""
      });
    } else {
      form.reset({ name: "", username: "", password: "", confirmPassword: "", isAdmin: false });
    }
    // Trigger validation after resetting, especially relevant when switching between create/edit
    // as the schema conditions (e.g., password required on create) might change.
    const timer = setTimeout(() => form.trigger(), 0); // Trigger validation in the next tick
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingAssignee, form.reset, form.trigger]);


  const onSubmit = async (data: AssigneeFormData) => {
    setIsSubmitting(true);
    try {
      const passwordToUpdate = data.password && data.password.length >= MIN_PASSWORD_LENGTH ? data.password : undefined;
      if (editingAssignee) {
        await updateAssignee(editingAssignee.id, {
          name: data.name,
          username: data.username,
          isAdmin: data.isAdmin
        }, passwordToUpdate);
        setEditingAssignee(null);
      } else {
        if (!passwordToUpdate) {
            // This should ideally be caught by Zod validation, but as a safeguard
            form.setError("password", { type: "manual", message: t('passwordIsRequiredForCreation') });
            setIsSubmitting(false);
            return;
        }
        await addAssignee(data.name, data.username, passwordToUpdate, data.isAdmin);
      }
      form.reset({ name: "", username: "", password: "", confirmPassword: "", isAdmin: false });
    } catch (error) {
      console.error("Failed to save assignee:", error);
      // Error toast is likely handled within addAssignee/updateAssignee via useAppStore
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssignee = async (assigneeId: number) => {
    setIsSubmitting(true);
    try {
      await deleteAssignee(assigneeId);
      setAssigneeToDelete(null);
      if (editingAssignee?.id === assigneeId) {
        setEditingAssignee(null);
        form.reset({ name: "", username: "", password: "", confirmPassword: "", isAdmin: false });
      }
    } catch (error) {
      console.error("Failed to delete assignee:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAssignee = (assignee: Assignee) => {
    setEditingAssignee(assignee);
  };

  const handleCancelEdit = () => {
    setEditingAssignee(null);
    form.reset({ name: "", username: "", password: "", confirmPassword: "", isAdmin: false });
  };

  return (
    <div className="flex flex-col flex-grow min-h-screen">
      <main className="flex-grow container mx-auto py-8 px-4">
        <div className="mb-6 flex justify-start">
          <Link href="/" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />{t('backToCalendar')}
            </Button>
          </Link>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>{editingAssignee ? t('editAssignee') : t('addNewAssignee')}</CardTitle>
              <CardDescription>
                {editingAssignee ? t('updateAssigneeDetails') : t('createAssigneeDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('assigneeNameLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('assigneeNamePlaceholder')} {...field} disabled={isSubmitting || isAppStoreLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('usernameLabel')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('usernamePlaceholder')}
                            {...field}
                            disabled={isSubmitting || isAppStoreLoading}
                          />
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
                        <FormLabel>{editingAssignee ? t('newPasswordOptionalLabel') : t('passwordLabel')}</FormLabel>
                        <FormControl>
                           <div className="relative">
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder={editingAssignee ? t('leaveBlankToKeepCurrent') : t('enterPasswordPlaceholder')}
                                {...field}
                                disabled={isSubmitting || isAppStoreLoading}
                                className="pr-10"
                            />
                            <Button
                              type="button" variant="ghost" size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                              onClick={() => setShowPassword(!showPassword)}
                              disabled={isSubmitting || isAppStoreLoading}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage /> {/* This will now show all password-related errors */}
                      </FormItem>
                    )}
                  />
                 {(form.watch('password') || !editingAssignee) && ( // Show confirm password if password has content OR if creating new user
                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('confirmPasswordLabel')}</FormLabel>
                            <FormControl>
                            <div className="relative">
                                <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder={t('confirmPasswordPlaceholder')}
                                    {...field}
                                    disabled={isSubmitting || isAppStoreLoading}
                                    className="pr-10"
                                />
                                 <Button
                                  type="button" variant="ghost" size="icon"
                                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  disabled={isSubmitting || isAppStoreLoading}
                                >
                                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                 )}

                  <FormField
                    control={form.control}
                    name="isAdmin"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isSubmitting || isAppStoreLoading}
                            aria-labelledby="is-admin-label"
                          />
                        </FormControl>
                        <FormLabel id="is-admin-label" className="font-normal">
                          {t('administratorLabel')}
                        </FormLabel>
                         <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex space-x-2">
                    <Button type="submit" className="flex-grow" disabled={isSubmitting || isAppStoreLoading}>
                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (editingAssignee ? <Edit3 className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />)}
                      {editingAssignee ? t('saveChanges') : t('addNewAssignee')}
                    </Button>
                    {editingAssignee && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSubmitting}>
                        <XCircle className="mr-2 h-5 w-5" />{t('cancel')}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="shadow-lg flex flex-col">
            <CardHeader>
              <CardTitle>{t('existingAssignees')}</CardTitle>
              <CardDescription>{t('viewEditManageAssignees')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
             {isAppStoreLoading && <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin" /></div>}
              {!isAppStoreLoading && assignees.length > 0 ? (
                <ScrollArea className="h-full pr-1">
                  <ul className="space-y-3">
                    {assignees.map((assignee) => (
                      <li key={assignee.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-primary" />
                          <span className="font-medium">{assignee.name}</span>
                          {assignee.username && <span className="text-xs text-muted-foreground">(@{assignee.username})</span>}
                          {assignee.isAdmin && <Badge variant="secondary" className="ml-2"><ShieldCheck className="h-3 w-3 mr-1" />{t('adminBadge')}</Badge>}
                        </div>
                        <div className="flex items-center">
                          <Button variant="ghost" size="icon" onClick={() => handleEditAssignee(assignee)} className="text-primary hover:text-primary/80" disabled={isSubmitting}>
                            <Edit3 className="h-5 w-5" /><span className="sr-only">{t('editAssignee')}</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" disabled={isSubmitting}>
                                <Trash2 className="h-5 w-5" /><span className="sr-only">{t('delete')}</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('confirmDeleteAssigneeDescription', { assigneeName: assignee.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setAssigneeToDelete(null)}>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAssignee(assignee.id)} disabled={isSubmitting}>
                                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                !isAppStoreLoading && <p className="text-sm text-muted-foreground text-center py-4">{t('noAssigneesYet')}</p>
              )}
            </CardContent>
             {!isAppStoreLoading && assignees.length > 0 && (
              <CardFooter className="text-sm text-muted-foreground">
                {t('assigneesCount', { count: assignees.length })}
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

    