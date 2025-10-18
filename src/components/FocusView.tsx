import React, { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusMode } from '@/contexts/FocusModeContext';

interface FocusViewProps {
  children: ReactNode;
  title: string;
}

export const FocusView: React.FC<FocusViewProps> = ({ children, title }) => {
  const { exitFocusMode } = useFocusMode();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitFocusMode();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [exitFocusMode]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-8 animate-in fade-in duration-200">
      {/* Close button */}
      <button
        onClick={exitFocusMode}
        className="fixed top-6 right-6 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-gray-300 hover:text-white z-10 group"
        aria-label="Exit focus mode"
      >
        <X className="h-6 w-6" />
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 text-sm text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Press Esc
        </span>
      </button>

      {/* Title */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 text-gray-400 text-sm font-medium tracking-wide">
        {title}
      </div>

      {/* Content */}
      <div className="w-full max-w-7xl max-h-[85vh] overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );
};
