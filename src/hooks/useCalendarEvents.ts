import { useState, useEffect } from 'react';
import { CalendarEvent, TimeFilter } from '../types/calendar';
import { calendarApiService, transformApiEvent } from '../services/calendarApi';

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useCalendarEvents = (timeFilter: TimeFilter, specificDate?: string): UseCalendarEventsResult => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = (filter: TimeFilter) => {
    // If a specific date is provided, use it instead of the filter
    if (specificDate) {
      const selectedDateObj = new Date(specificDate);
      return {
        start: specificDate,
        end: specificDate
      };
    }
    
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
        // Calculate Monday of next week
        const daysUntilNextMonday = today.getDay() === 0 ? 1 : (8 - today.getDay()); // If Sunday, next Monday is 1 day away, otherwise 8 - current day
        start = new Date(today.getTime() + daysUntilNextMonday * 24 * 60 * 60 * 1000);
        end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000); // End of next week (Sunday)
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
      
      // Filter events to only include events within the calculated date range
      let filteredEvents = transformedEvents;
      if (['today', 'tomorrow', 'day-after', '2-days-after'].includes(timeFilter)) {
        // For single-day filters, filter events to only include the target date
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
      } else {
        // For multi-day filters, filter events to be within the date range
        const startDateStr = dateRange.start;
        const endDateStr = dateRange.end;
        filteredEvents = transformedEvents.filter(event => {
          const eventDateStr = event.startTime.toISOString().split('T')[0];
          const isWithinRange = eventDateStr >= startDateStr && eventDateStr <= endDateStr;
          if (!isWithinRange) {
            console.log(`🚫 Filtering out event "${event.title}" (${eventDateStr}) - outside range (${startDateStr} to ${endDateStr})`);
          }
          return isWithinRange;
        });
        console.log(`🎯 After filtering to date range ${startDateStr} to ${endDateStr}: ${filteredEvents.length} events`);
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
  }, [timeFilter, specificDate]);

  return {
    events,
    loading,
    error,
    refetch: fetchEvents
  };
};
