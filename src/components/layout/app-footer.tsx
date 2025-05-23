
"use client";

import React, { useState, useEffect } from 'react';
import { MOTIVATIONAL_PHRASES } from '@/lib/constants';

export default function AppFooter() {
  const [currentPhrase, setCurrentPhrase] = useState('');

  useEffect(() => {
    // This effect runs only on the client after mount
    setCurrentPhrase(MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)]);
  }, []);

  if (!currentPhrase) {
    return null; // Don't render anything if no phrase is selected yet (avoids flash of empty footer)
  }

  return (
    <footer className="fixed bottom-0 left-0 right-0 w-full p-2 bg-background/90 backdrop-blur-sm border-t border-border/30 text-center text-xs text-muted-foreground z-40">
      <p className="italic">{currentPhrase}</p>
    </footer>
  );
}
