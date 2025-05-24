
"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { translations, type Locale, type Translations } from '@/lib/translations';

type TranslationFunction = <K extends keyof Translations>(
  key: K,
  // Parameters for functions, or Record for simple replacement
  params?: Translations[K] extends (...args: any[]) => string 
          ? Parameters<Translations[K]>[0] 
          : Record<string, string | number>
) => string;

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationFunction;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LOCAL_STORAGE_LOCALE_KEY = 'todoFlowLocale';

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>('en'); 

  useEffect(() => {
    const storedLocale = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_LOCALE_KEY) as Locale | null : null;
    if (storedLocale && (storedLocale === 'en' || storedLocale === 'es' || storedLocale === 'fr')) {
      setLocaleState(storedLocale);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_LOCALE_KEY, newLocale);
    }
  }, []);

  const t = useCallback(<K extends keyof Translations>(
    key: K,
    params?: Translations[K] extends (...args: any[]) => string 
            ? Parameters<Translations[K]>[0] 
            : Record<string, string | number>
  ): string => {
    const translationSet = translations[locale] || translations['en'];
    const translationValue = translationSet[key];

    if (typeof translationValue === 'function') {
      // If params is not provided for a function that expects it,
      // we might need a default or to handle it gracefully.
      // For now, assuming params will be provided if the translation is a function.
      return (translationValue as (...args: any[]) => string)(params as any);
    }
    
    let text = String(translationValue || key); // Fallback to key if translation not found

    if (typeof params === 'object' && params !== null) {
      Object.keys(params).forEach(paramKey => {
        const regex = new RegExp(`{${paramKey}}`, 'g');
        text = text.replace(regex, String((params as Record<string, string | number>)[paramKey]));
      });
    }
    return text;
  }, [locale]);
  

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslations = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslations must be used within a LanguageProvider');
  }
  return context;
};

    