import React, { createContext, useContext, useState, ReactNode } from 'react';

type FocusMode = 'important' | 'horizons-todos' | null;

interface FocusModeContextType {
  focusMode: FocusMode;
  setFocusMode: (mode: FocusMode) => void;
  exitFocusMode: () => void;
}

const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined);

export const FocusModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [focusMode, setFocusMode] = useState<FocusMode>(null);

  const exitFocusMode = () => setFocusMode(null);

  return (
    <FocusModeContext.Provider value={{ focusMode, setFocusMode, exitFocusMode }}>
      {children}
    </FocusModeContext.Provider>
  );
};

export const useFocusMode = (): FocusModeContextType => {
  const context = useContext(FocusModeContext);
  if (!context) {
    throw new Error('useFocusMode must be used within a FocusModeProvider');
  }
  return context;
};
