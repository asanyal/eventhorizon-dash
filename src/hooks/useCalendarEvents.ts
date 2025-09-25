import { useState, useEffect } from 'react';
import { CalendarEvent, TimeFilter } from '../types/calendar';
import { calendarApiService, transformApiEvent } from '../services/calendarApi';

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useCalendarEvents = (timeFilter: TimeFilter): UseCalendarEventsResult => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = (filter: TimeFilter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let start: Date;
    let end: Date;

    switch (filter) {
      case 'today':
        start = new Date(today);
        end = new Date(today); // Same day for both start and end
        break;
      case 'tomorrow':
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        start = new Date(tomorrow);
        end = new Date(tomorrow); // Same day for both start and end
        break;
      case 'day-after':
        const dayAfter = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
        start = new Date(dayAfter);
        end = new Date(dayAfter); // Same day for both start and end
        break;
      case '2-days-after':
        const twoDaysAfter = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        start = new Date(twoDaysAfter);
        end = new Date(twoDaysAfter); // Same day for both start and end
        break;
      case 'this-week':
        start = new Date(today); // Start from today, not beginning of week
        end = new Date(today.getTime() + (6 - today.getDay()) * 24 * 60 * 60 * 1000); // End of week (Sunday)
        break;
      case 'next-week':
        start = new Date(today.getTime() + (7 - today.getDay()) * 24 * 60 * 60 * 1000);
        end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000); // End of next week
        break;
      case 'this-month':
        start = new Date(today); // Start from today, not beginning of month
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
        break;
      case 'next-month':
        start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        end = new Date(today.getFullYear(), today.getMonth() + 2, 0); // Last day of next month
        break;
      default:
        start = new Date(today);
        end = new Date(today);
    }

    return {
      start: start.toISOString().split('T')[0], // YYYY-MM-DD format
      end: end.toISOString().split('T')[0]
    };
  };

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const dateRange = getDateRange(timeFilter);
      const apiEvents = await calendarApiService.getEvents(dateRange);
      const transformedEvents = apiEvents.map((apiEvent, index) => 
        transformApiEvent(apiEvent, index)
      );
      
      // Sort events by start time
      transformedEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      setEvents(transformedEvents);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch events';
      setError(errorMessage);
      console.error('Error fetching calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [timeFilter]);

  return {
    events,
    loading,
    error,
    refetch: fetchEvents
  };
};
