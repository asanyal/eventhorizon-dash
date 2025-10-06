import { useState, useEffect } from 'react';
import { CalendarEvent, TimeFilter } from '../types/calendar';
import { calendarApiService, transformApiEvent } from '../services/calendarApi';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cacheUtils';

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => void;
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
    
    // Use system time to determine "today" but format as YYYY-MM-DD in local timezone
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD format in local timezone

    // Helper function to add days to a YYYY-MM-DD string
    const addDays = (dateStr: string, days: number): string => {
      const date = new Date(dateStr + 'T00:00:00'); // Create date in local timezone
      date.setDate(date.getDate() + days);
      return date.toLocaleDateString('en-CA'); // Return as YYYY-MM-DD
    };

    let startStr: string;
    let endStr: string;

    switch (filter) {
      case 'today':
        startStr = todayStr;
        endStr = todayStr;
        break;
      case 'tomorrow':
        startStr = addDays(todayStr, 1);
        endStr = addDays(todayStr, 1);
        break;
      case 'day-after':
        startStr = addDays(todayStr, 2);
        endStr = addDays(todayStr, 2);
        break;
      case '2-days-after':
        startStr = addDays(todayStr, 3);
        endStr = addDays(todayStr, 3);
        break;
      case 'this-week':
        const todayDate = new Date(todayStr + 'T00:00:00');
        const dayOfWeek = todayDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        if (dayOfWeek === 0) {
          // If it's Sunday, show Monday-Friday of the upcoming week
          startStr = addDays(todayStr, 1); // Monday
          endStr = addDays(todayStr, 5);   // Friday
        } else {
          // For other days, show from today until end of the week (Sunday)
          startStr = todayStr;
          const daysUntilSunday = 7 - dayOfWeek;
          endStr = addDays(todayStr, daysUntilSunday);
        }
        break;
      case 'next-week':
        // Calculate Monday of next week
        const todayDateForNextWeek = new Date(todayStr + 'T00:00:00');
        const daysUntilNextMonday = todayDateForNextWeek.getDay() === 0 ? 1 : (8 - todayDateForNextWeek.getDay());
        startStr = addDays(todayStr, daysUntilNextMonday);
        endStr = addDays(startStr, 6); // End of next week (Sunday)
        break;
      case 'this-month':
        startStr = todayStr; // Start from today, not beginning of month
        const todayDateForMonth = new Date(todayStr + 'T00:00:00');
        const lastDayOfMonth = new Date(todayDateForMonth.getFullYear(), todayDateForMonth.getMonth() + 1, 0);
        endStr = lastDayOfMonth.toLocaleDateString('en-CA');
        break;
      case 'next-month':
        const todayDateForNextMonth = new Date(todayStr + 'T00:00:00');
        const firstDayNextMonth = new Date(todayDateForNextMonth.getFullYear(), todayDateForNextMonth.getMonth() + 1, 1);
        const lastDayNextMonth = new Date(todayDateForNextMonth.getFullYear(), todayDateForNextMonth.getMonth() + 2, 0);
        startStr = firstDayNextMonth.toLocaleDateString('en-CA');
        endStr = lastDayNextMonth.toLocaleDateString('en-CA');
        break;
      default:
        startStr = todayStr;
        endStr = todayStr;
    }
    
    console.log(`📅 Date range calculation for ${filter}:`, {
      systemTime: now.toLocaleString(),
      today: todayStr,
      start: startStr,
      end: endStr
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
      const cacheKey = CACHE_KEYS.CALENDAR_EVENTS(timeFilter, specificDate);
      
      // Try to get from cache first
      const cachedEvents = cache.get<CalendarEvent[]>(cacheKey);
      if (cachedEvents) {
        console.log(`📦 Using cached events for ${timeFilter}, specificDate: ${specificDate || 'none'} (${cachedEvents.length} events)`);
        if (cachedEvents.length > 0) {
          const cachedDates = cachedEvents.map(e => e.startTime.toISOString().split('T')[0]);
          console.log(`📦 Cached event dates: ${[...new Set(cachedDates)].join(', ')}`);
        }
        setEvents(cachedEvents);
        setLoading(false);
        return;
      }
      
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
      
      // Cache the processed events
      cache.set(cacheKey, filteredEvents, { ttl: CACHE_TTL.EVENTS });
      
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
    // Clear events immediately when filter changes to avoid showing stale data
    console.log(`###Atin useCalendarEvents useEffect triggered - timeFilter: ${timeFilter}, specificDate: ${specificDate || 'none'}`);
    setEvents([]);
    setLoading(true);
    fetchEvents();
  }, [timeFilter, specificDate]);

  const refetch = (forceRefresh: boolean = false) => {
    if (forceRefresh) {
      // Clear cache for this specific query
      const cacheKey = CACHE_KEYS.CALENDAR_EVENTS(timeFilter, specificDate);
      cache.remove(cacheKey);
      console.log(`🔄 Force refresh: cleared cache for ${timeFilter}`);
    }
    fetchEvents();
  };

  return {
    events,
    loading,
    error,
    refetch
  };
};
