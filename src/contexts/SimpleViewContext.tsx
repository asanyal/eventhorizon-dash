import { createContext, useContext, useState, ReactNode } from 'react';

interface SimpleViewContextType {
  isSimpleView: boolean;
  toggleSimpleView: () => void;
}

const SimpleViewContext = createContext<SimpleViewContextType | undefined>(undefined);

export const useSimpleView = () => {
  const context = useContext(SimpleViewContext);
  if (context === undefined) {
    throw new Error('useSimpleView must be used within a SimpleViewProvider');
  }
  return context;
};

interface SimpleViewProviderProps {
  children: ReactNode;
}

export const SimpleViewProvider = ({ children }: SimpleViewProviderProps) => {
  const [isSimpleView, setIsSimpleView] = useState(false);

  const toggleSimpleView = () => {
    setIsSimpleView(prev => !prev);
  };

  return (
    <SimpleViewContext.Provider value={{ isSimpleView, toggleSimpleView }}>
      {children}
    </SimpleViewContext.Provider>
  );
};
