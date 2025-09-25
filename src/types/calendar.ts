export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  duration: number; // in minutes
  description?: string;
  attendees: string[];
  organizerEmail: string;
}

// API Response types
export interface ApiEvent {
  event: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  time_until: string;
  attendees: string[];
  organizer_email: string;
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