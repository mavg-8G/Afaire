import { useContext } from 'react';
import { AppContext, type AppContextType } from '@/components/providers/app-provider';

export const useAppStore = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
};
