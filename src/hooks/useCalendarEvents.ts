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

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    console.log(`📅 Date range calculation for ${filter}:`, {
      today: today.toISOString().split('T')[0],
      start: startStr,
      end: endStr,
      startDate: start.toDateString(),
      endDate: end.toDateString()
    });

    return {
      start: startStr, // YYYY-MM-DD format
      end: endStr
    };
  };

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const dateRange = getDateRange(timeFilter);
      console.log(`🗓️  Fetching events for ${timeFilter}:`, dateRange);
      const apiEvents = await calendarApiService.getEvents(dateRange);
      console.log(`📅 Received ${apiEvents.length} events from API for ${timeFilter}`);
      const transformedEvents = apiEvents.map((apiEvent, index) => 
        transformApiEvent(apiEvent, index)
      );
      
      // For single-day filters, filter events to only include the target date
      let filteredEvents = transformedEvents;
      if (['today', 'tomorrow', 'day-after', '2-days-after'].includes(timeFilter)) {
        const targetDateStr = dateRange.start; // The target date in YYYY-MM-DD format
        filteredEvents = transformedEvents.filter(event => {
          const eventDateStr = event.startTime.toISOString().split('T')[0];
          const isTargetDate = eventDateStr === targetDateStr;
          if (!isTargetDate) {
            console.log(`🚫 Filtering out event "${event.title}" (${eventDateStr}) - not target date (${targetDateStr})`);
          }
          return isTargetDate;
        });
        console.log(`🎯 After filtering to target date ${targetDateStr}: ${filteredEvents.length} events`);
      }
      
      // Sort events by start time
      filteredEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      setEvents(filteredEvents);
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
