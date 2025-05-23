
"use client";

import React, { useEffect } from 'react';
import { useAppStore } from '@/hooks/use-app-store';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/layout/app-header';
import AppFooter from '@/components/layout/app-footer'; // Import the new footer

export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <p>Loading...</p> 
        </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow min-h-screen">
      <AppHeader />
      {/* Add padding-bottom to main to account for the fixed footer height */}
      {/* Footer p-4 height ~2.75rem, pb-16 (4rem) should be enough */}
      <main className="flex-grow pb-16"> 
        {children}
      </main>
      <AppFooter /> {/* Render the AppFooter here */}
    </div>
  );
}
