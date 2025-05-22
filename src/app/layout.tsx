
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/components/providers/app-provider';
import { Toaster } from '@/components/ui/toaster';
import { LanguageProvider } from '@/contexts/language-context';
import { ThemeProvider } from '@/contexts/theme-provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'À faire - Manage Your Activities',
  description: 'A smart todo and activity manager with AI-powered suggestions.',
  // Adding manifest related metadata for better PWA discovery if needed by some tools
  // manifest: "/manifest.json", // Next.js 13+ app router typically doesn't need this here if linked in head
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="À faire" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" data-ai-hint="app logo" />
        {/* The theme-color for the manifest is #FAD0C3 (Personal Light Primary) */}
        {/* This meta tag can influence the browser toolbar color */}
        <meta name="theme-color" content="#FAD0C3" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <AppProvider> {/* AppProvider now wraps everything */}
              {children}
              <Toaster />
            </AppProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
