
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
  display: 'swap', // Optimize LCP
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap', // Optimize LCP
});

export const metadata: Metadata = {
  title: 'À faire - Manage Your Activities',
  description: 'A smart todo and activity manager with AI-powered suggestions.',
  manifest: "/manifest.json", // Ensures Next.js is aware of the manifest for metadata generation
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Dynamic theme-color is managed by AppProvider */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="À faire" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" data-ai-hint="app logo" />
        {/* Ensure you have /public/icons/apple-touch-icon.png (e.g., 180x180px) */}
        {/* Ensure you have /public/icons/icon-192x192.png and icon-512x512.png for the manifest */}
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
