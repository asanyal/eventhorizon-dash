import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Timezone = 'PST' | 'EST' | 'GMT' | 'IST' | 'CET';

export const timezoneOptions: { value: Timezone; label: string; offset: number }[] = [
  { value: 'PST', label: 'PST (Pacific)', offset: 0 }, // Base timezone
  { value: 'EST', label: 'EST (Eastern)', offset: 3 }, // PST + 3 hours
  { value: 'GMT', label: 'GMT (London)', offset: 8 }, // PST + 8 hours
  { value: 'IST', label: 'IST (India)', offset: 13.5 }, // PST + 13.5 hours
  { value: 'CET', label: 'CET (Paris)', offset: 9 }, // PST + 9 hours
];

// Helper function to convert PST time to selected timezone
export const convertToTimezone = (pstDate: Date, timezone: Timezone): Date => {
  const option = timezoneOptions.find(tz => tz.value === timezone);
  if (!option) return pstDate;
  
  const offsetMs = option.offset * 60 * 60 * 1000;
  return new Date(pstDate.getTime() + offsetMs);
};

interface TimezoneContextType {
  selectedTimezone: Timezone;
  setTimezone: (timezone: Timezone) => void;
  convertTime: (pstDate: Date) => Date;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

interface TimezoneProviderProps {
  children: ReactNode;
}

export const TimezoneProvider: React.FC<TimezoneProviderProps> = ({ children }) => {
  const [selectedTimezone, setSelectedTimezone] = useState<Timezone>(() => {
    // Load from localStorage or default to PST
    const saved = localStorage.getItem('calendar-timezone');
    return (saved as Timezone) || 'PST';
  });

  const setTimezone = (timezone: Timezone) => {
    setSelectedTimezone(timezone);
    localStorage.setItem('calendar-timezone', timezone);
  };

  const convertTime = (pstDate: Date) => {
    return convertToTimezone(pstDate, selectedTimezone);
  };

  return (
    <TimezoneContext.Provider value={{ selectedTimezone, setTimezone, convertTime }}>
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
};
