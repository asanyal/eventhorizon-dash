export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  duration: number; // in minutes
  description?: string;
}

export type TimeFilter = 
  | 'today' 
  | 'tomorrow' 
  | 'day-after' 
  | '2-days-after' 
  | 'this-week' 
  | 'next-week' 
  | 'this-month' 
  | 'next-month';

export type UrgencyLevel = 'critical' | 'warning' | 'normal' | 'future';