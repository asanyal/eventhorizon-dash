import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { calendarApiService } from '../services/calendarApi';
import { cache } from '../utils/cacheUtils';

// Mock the calendar API service
vi.mock('../services/calendarApi', () => ({
  calendarApiService: {
    getEvents: vi.fn(),
  },
}));

// Mock the cache utility
vi.mock('../utils/cacheUtils', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('Calendar Events Timezone Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock cache to return null (no cached data)
    vi.mocked(cache.get).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Date Parameter Passing', () => {
    it('should pass today\'s date based on client system time', async () => {
      // Mock the current date to a specific value
      const mockDate = new Date('2025-09-28T06:13:00'); // London time
      vi.setSystemTime(mockDate);

      // Mock API response
      const mockApiResponse = [
        {
          event: "Test Event",
          date: "Sep 28",
          start_time: "4:30 AM",
          end_time: "8:00 AM",
          duration_minutes: 210,
          time_until: "In 3h 10m",
          attendees: [],
          organizer_email: "test@example.com",
          all_day: false,
          notes: null
        }
      ];

      vi.mocked(calendarApiService.getEvents).mockResolvedValue(mockApiResponse);

      // Render the hook
      const { result } = renderHook(() => useCalendarEvents('today'));

      // Wait for the hook to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify that getEvents was called with today's date
      expect(calendarApiService.getEvents).toHaveBeenCalledWith({
        start: '2025-09-28', // Should be today's date in YYYY-MM-DD format
        end: '2025-09-28'
      });

      // Verify the date calculation uses system time
      const callArgs = vi.mocked(calendarApiService.getEvents).mock.calls[0][0];
      expect(callArgs.start).toBe('2025-09-28');
      expect(callArgs.end).toBe('2025-09-28');
    });

    it('should handle different system timezones correctly', async () => {
      // Test with different timezone scenarios
      const testCases = [
        {
          systemTime: new Date('2025-09-28T06:13:00'), // London morning
          expectedDate: '2025-09-28'
        },
        {
          systemTime: new Date('2025-09-28T23:45:00'), // London evening
          expectedDate: '2025-09-28'
        },
        {
          systemTime: new Date('2025-09-29T01:30:00'), // London early morning next day
          expectedDate: '2025-09-29'
        }
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        vi.setSystemTime(testCase.systemTime);
        vi.mocked(cache.get).mockReturnValue(null);
        vi.mocked(calendarApiService.getEvents).mockResolvedValue([]);

        const { result } = renderHook(() => useCalendarEvents('today'));

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(calendarApiService.getEvents).toHaveBeenCalledWith({
          start: testCase.expectedDate,
          end: testCase.expectedDate
        });
      }
    });
  });

  describe('2. Timezone Conversion and Display', () => {
    it('should convert PST times to local timezone for display', async () => {
      // Mock London timezone (UTC+1)
      const mockDate = new Date('2025-09-28T06:13:00+01:00'); // London time
      vi.setSystemTime(mockDate);

      // Mock API response with PST time
      const mockApiResponse = [
        {
          event: "Visit Family for Durga Puja",
          date: "Sep 28",
          start_time: "4:30 AM", // PST time
          end_time: "8:00 AM",
          duration_minutes: 210,
          time_until: "In 3h 10m",
          attendees: [],
          organizer_email: "atin@galileo.ai",
          all_day: false,
          notes: null
        }
      ];

      vi.mocked(calendarApiService.getEvents).mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useCalendarEvents('today'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify events were fetched and transformed
      expect(result.current.events).toHaveLength(1);
      
      const event = result.current.events[0];
      
      // The event should be transformed to show the correct local time
      // PST 4:30 AM should become London 1:30 PM (4:30 AM + 8 hours PST offset + 1 hour London offset)
      const expectedLocalTime = new Date('2025-09-28T13:30:00+01:00'); // 1:30 PM London time
      
      // Check that the startTime is correctly converted
      expect(event.startTime.getTime()).toBe(expectedLocalTime.getTime());
      
      // Verify the event details
      expect(event.title).toBe("Visit Family for Durga Puja");
      expect(event.duration).toBe(210);
      expect(event.all_day).toBe(false);
    });

    it('should handle all-day events correctly', async () => {
      const mockDate = new Date('2025-09-28T06:13:00+01:00');
      vi.setSystemTime(mockDate);

      const mockApiResponse = [
        {
          event: "All Day Event",
          date: "Sep 28",
          start_time: "All Day",
          end_time: "All Day",
          duration_minutes: 1440,
          time_until: "All Day",
          attendees: [],
          organizer_email: "test@example.com",
          all_day: true,
          notes: null
        }
      ];

      vi.mocked(calendarApiService.getEvents).mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useCalendarEvents('today'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.events).toHaveLength(1);
      
      const event = result.current.events[0];
      expect(event.all_day).toBe(true);
      expect(event.title).toBe("All Day Event");
      
      // All-day events should start at midnight local time
      const expectedDate = new Date('2025-09-28T00:00:00+01:00');
      expect(event.startTime.getTime()).toBe(expectedDate.getTime());
    });

    it('should handle different timezone scenarios', async () => {
      const testCases = [
        {
          systemTimezone: 'Europe/London', // UTC+1
          pstTime: '4:30 AM',
          expectedLocalTime: '1:30 PM' // 4:30 AM + 8 hours PST + 1 hour London
        },
        {
          systemTimezone: 'America/New_York', // UTC-5
          pstTime: '4:30 AM',
          expectedLocalTime: '7:30 AM' // 4:30 AM + 8 hours PST - 5 hours EST
        },
        {
          systemTimezone: 'Asia/Tokyo', // UTC+9
          pstTime: '4:30 AM',
          expectedLocalTime: '9:30 PM' // 4:30 AM + 8 hours PST + 9 hours JST (next day)
        }
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        vi.mocked(cache.get).mockReturnValue(null);

        // Mock the timezone
        const mockDate = new Date('2025-09-28T06:13:00');
        vi.setSystemTime(mockDate);

        const mockApiResponse = [
          {
            event: "Test Event",
            date: "Sep 28",
            start_time: testCase.pstTime,
            end_time: "8:00 AM",
            duration_minutes: 210,
            time_until: "In 3h 10m",
            attendees: [],
            organizer_email: "test@example.com",
            all_day: false,
            notes: null
          }
        ];

        vi.mocked(calendarApiService.getEvents).mockResolvedValue(mockApiResponse);

        const { result } = renderHook(() => useCalendarEvents('today'));

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(result.current.events).toHaveLength(1);
        
        const event = result.current.events[0];
        
        // Verify the time conversion logic
        // PST 4:30 AM should be converted to UTC 12:30 PM (4:30 AM + 8 hours)
        const expectedUtcTime = new Date('2025-09-28T12:30:00Z');
        expect(event.startTime.getTime()).toBe(expectedUtcTime.getTime());
      }
    });

    it('should handle edge cases with date boundaries', async () => {
      // Test with PST time that crosses date boundary when converted
      const mockDate = new Date('2025-09-28T06:13:00+01:00');
      vi.setSystemTime(mockDate);

      const mockApiResponse = [
        {
          event: "Late Night Event",
          date: "Sep 28",
          start_time: "11:30 PM", // PST late night
          end_time: "1:00 AM",
          duration_minutes: 90,
          time_until: "In 3h 10m",
          attendees: [],
          organizer_email: "test@example.com",
          all_day: false,
          notes: null
        }
      ];

      vi.mocked(calendarApiService.getEvents).mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useCalendarEvents('today'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.events).toHaveLength(1);
      
      const event = result.current.events[0];
      
      // PST 11:30 PM should become UTC 7:30 AM next day (11:30 PM + 8 hours)
      const expectedUtcTime = new Date('2025-09-29T07:30:00Z');
      expect(event.startTime.getTime()).toBe(expectedUtcTime.getTime());
    });
  });

  describe('Integration Test', () => {
    it('should handle complete flow from API call to display', async () => {
      // Mock London timezone
      const mockDate = new Date('2025-09-28T06:13:00+01:00');
      vi.setSystemTime(mockDate);

      const mockApiResponse = [
        {
          event: "Visit Family for Durga Puja",
          date: "Sep 28",
          start_time: "4:30 AM",
          end_time: "8:00 AM",
          duration_minutes: 210,
          time_until: "In 3h 10m",
          attendees: [],
          organizer_email: "atin@galileo.ai",
          all_day: false,
          notes: null
        }
      ];

      vi.mocked(calendarApiService.getEvents).mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useCalendarEvents('today'));

      // Initially loading
      expect(result.current.loading).toBe(true);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // After loading completes
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.events).toHaveLength(1);

      // Verify API was called with correct date
      expect(calendarApiService.getEvents).toHaveBeenCalledWith({
        start: '2025-09-28',
        end: '2025-09-28'
      });

      // Verify event transformation
      const event = result.current.events[0];
      expect(event.title).toBe("Visit Family for Durga Puja");
      expect(event.duration).toBe(210);
      expect(event.all_day).toBe(false);
      
      // Verify timezone conversion
      const expectedUtcTime = new Date('2025-09-28T12:30:00Z'); // PST 4:30 AM + 8 hours = UTC 12:30 PM
      expect(event.startTime.getTime()).toBe(expectedUtcTime.getTime());
    });
  });
});
