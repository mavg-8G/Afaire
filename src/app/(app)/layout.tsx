
"use client";

import React, { useEffect } from 'react';
import { useAppStore } from '@/hooks/use-app-store';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/layout/app-header';

export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    // Wait for isLoading to be false before checking isAuthenticated
    // to ensure state is loaded from localStorage.
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    // Show a loading state or null while checking auth / redirecting
    // This prevents flashing the content of authenticated pages briefly.
    return (
        <div className="flex items-center justify-center min-h-screen">
            {/* You can replace this with a proper loading spinner component */}
            <p>Loading...</p> 
        </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow min-h-screen">
      <AppHeader />
      <main className="flex-grow">
        {children}
      </main>
    </div>
  );
}
