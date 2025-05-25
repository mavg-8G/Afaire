
"use client";

import React, { useState, useEffect } from 'react';
import { useTranslations } from '@/contexts/language-context';
import { translations } from '@/lib/translations'; // Import translations directly

export default function AppFooter() {
  const { locale } = useTranslations();
  const [currentPhrase, setCurrentPhrase] = useState('');

  useEffect(() => {
    // This effect runs only on the client after mount
    const phrasesForLocale = translations[locale].motivationalPhrases || translations['en'].motivationalPhrases;
    if (phrasesForLocale && phrasesForLocale.length > 0) {
      setCurrentPhrase(phrasesForLocale[Math.floor(Math.random() * phrasesForLocale.length)]);
    } else {
      setCurrentPhrase("Keep up the great work!"); // Fallback
    }
  }, [locale]); // Re-run if locale changes

  if (!currentPhrase) {
    return null; // Don't render anything if no phrase is selected yet (avoids flash of empty footer)
  }

  return (
    <footer className="fixed bottom-0 left-0 right-0 w-full p-6 bg-background/90 backdrop-blur-sm border-t border-border/30 text-xs text-muted-foreground z-40">
      <p className="italic text-left md:text-center">{currentPhrase}</p>
    </footer>
  );
}

    