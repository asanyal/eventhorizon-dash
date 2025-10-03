import { useState, useEffect } from 'react';
import { HolidayItem, EnhancedHoliday } from '../types/holiday';
import { CalendarEvent } from '../types/calendar';
import { BookmarkEvent } from '../types/bookmark';
import { holidayApiService } from '../services/holidayApi';
import { cn } from '../lib/utils';
import { PartyPopper, RefreshCw, AlertTriangle } from 'lucide-react';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cacheUtils';
import { getTimeUntilEvent } from '../utils/dateUtils';

interface HolidaysSectionProps {
  calendarEvents?: CalendarEvent[];
  bookmarkedEvents?: BookmarkEvent[];
}

// Vacation-specific color coding based on days until holiday
const getVacationIntervalColor = (intervalText: string): string => {
  if (intervalText.includes('ago')) {
    return 'text-gray-400'; // Past events - faded gray
  }
  
  // Extract days from the interval text (e.g., "In 15 days" -> 15)
  const daysMatch = intervalText.match(/(\d+(?:\.\d+)?)\s+days?/);
  if (daysMatch) {
    const days = parseFloat(daysMatch[1]);
    
    if (days < 20) {
      return 'text-red-500'; // Less than 20 days - immediate urgency
    } else if (days >= 20 && days < 40) {
      return 'text-orange-500'; // 20-40 days - near-term urgency
    } else if (days >= 40 && days <= 90) {
      return 'text-purple-500'; // 40-90 days - medium-term planning
    } else {
      return 'text-gray-500'; // >90 days - long-term, less urgent
    }
  }
  
  // Handle hours (for very near-term holidays)
  if (intervalText.includes('hour')) {
    return 'text-red-500'; // Any hours are immediate urgency
  }
  
  // Handle minutes (for very immediate holidays)
  if (intervalText.includes('m')) {
    return 'text-red-500'; // Any minutes are immediate urgency
  }
  
  return 'text-productivity-text-primary'; // Default color
};

export const HolidaysSection = ({ calendarEvents = [], bookmarkedEvents = [] }: HolidaysSectionProps) => {
  const [holidays, setHolidays] = useState<EnhancedHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'upcoming' | 'all'>('upcoming');

  useEffect(() => {
    fetchHolidays();
  }, []);


  const fetchHolidays = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      const cacheKey = 'eventhorizon_holidays';
      
      // Try cache first unless force refresh
      if (!forceRefresh) {
        const cachedHolidays = cache.get<EnhancedHoliday[]>(cacheKey);
        if (cachedHolidays) {
          console.log(`📦 Using cached holidays (${cachedHolidays.length} items)`);
          setHolidays(cachedHolidays);
          setLoading(false);
          return;
        }
      }
      
      const today = new Date().toISOString().split('T')[0];
      const rawHolidays = await holidayApiService.getHolidays({ date: today });
      
      const enhancedHolidays = enhanceHolidays(rawHolidays);
      
      // Cache the enhanced holidays
      cache.set(cacheKey, enhancedHolidays, { ttl: CACHE_TTL.HORIZONS }); // 10 minutes like horizons
      
      setHolidays(enhancedHolidays);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    } finally {
      setLoading(false);
    }
  };

  const enhanceHolidays = (rawHolidays: HolidayItem[]): EnhancedHoliday[] => {
    const currentYear = new Date().getFullYear();
    
    return rawHolidays.map((holiday, index) => {
      // Parse the date (e.g., "Sep 1" -> Date object)
      const fullDate = new Date(`${holiday.date}, ${currentYear}`);
      if (fullDate < new Date()) {
        fullDate.setFullYear(currentYear + 1);
      }
      
      // Format date with day of week (e.g., "Tue, Oct 13")
      const formattedDate = fullDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      
      // Calculate formatted time until using the same logic as calendar events
      const formattedTimeUntil = getTimeUntilEvent(fullDate);
      
      const now = new Date();
      const daysUntil = Math.ceil((fullDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isPast = formattedTimeUntil.includes('ago');
      const isUpcoming = !isPast && daysUntil <= 60; // Next 2 months
      
      // Determine if it's a long weekend
      const dayOfWeek = fullDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      let isLongWeekend = false;
      let weekendType: 'friday-monday' | 'thursday-friday' | 'monday-tuesday' | undefined;
      
      if (dayOfWeek === 1) { // Monday
        weekendType = 'friday-monday';
        isLongWeekend = true;
      } else if (dayOfWeek === 5) { // Friday
        weekendType = 'thursday-friday';
        isLongWeekend = true;
      } else if (dayOfWeek === 2) { // Tuesday (Monday holiday)
        weekendType = 'monday-tuesday';
        isLongWeekend = true;
      }
      
      // Categorize holiday
      const category = categorizeHoliday(holiday.name);
      
      // Check for calendar conflicts (events within 3 days of holiday)
      const conflictWindow = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
      const hasCalendarConflicts = calendarEvents.some(event => {
        try {
          const eventDate = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
          return Math.abs(eventDate.getTime() - fullDate.getTime()) <= conflictWindow;
        } catch (error) {
          console.warn('Error processing calendar event date:', error);
          return false;
        }
      });
      
      const hasBookmarkedConflicts = bookmarkedEvents.some(bookmark => {
        try {
          if (!bookmark.time || !bookmark.time.includes('T')) return false;
          const bookmarkDate = new Date(bookmark.time);
          return Math.abs(bookmarkDate.getTime() - fullDate.getTime()) <= conflictWindow;
        } catch (error) {
          console.warn('Error processing bookmark date:', error);
          return false;
        }
      });
      
      
      return {
        ...holiday,
        id: `holiday-${index}`,
        fullDate,
        formattedDate, // Add the formatted date with day of week
        formattedTimeUntil, // Add the formatted time until using calendar logic
        isUpcoming,
        isPast,
        daysUntil,
        isLongWeekend,
        weekendType,
        category,
        hasCalendarConflicts,
        hasBookmarkedConflicts,
      };
    });
  };

  const categorizeHoliday = (name: string): 'major' | 'cultural' | 'observance' | 'federal' => {
    const federal = ['Labor Day', 'Columbus Day', 'Veterans Day', 'Thanksgiving Day', 'Christmas Day', 'New Year\'s Day', 'Martin Luther King Jr. Day', 'Presidents\' Day', 'Memorial Day', 'Independence Day', 'Juneteenth'];
    const major = ['Christmas Eve', 'New Year\'s Eve', 'Easter Sunday', 'Mother\'s Day', 'Father\'s Day'];
    const cultural = ['Halloween', 'Valentine\'s Day', 'St. Patrick\'s Day', 'Cinco de Mayo', 'Black Friday'];
    
    if (federal.some(f => name.includes(f.split(' ')[0]))) return 'federal';
    if (major.some(m => name.includes(m.split(' ')[0]))) return 'major';
    if (cultural.some(c => name.includes(c.split(' ')[0]))) return 'cultural';
    return 'observance';
  };


  const handleRefresh = async () => {
    setRefreshing(true);
    cache.remove('eventhorizon_holidays');
    await fetchHolidays(true);
    setRefreshing(false);
  };

  const getHolidayIcon = (category: string) => {
    switch (category) {
      case 'federal': return '🇺🇸';
      case 'major': return '🎊';
      case 'cultural': return '🎭';
      default: return '📅';
    }
  };


  const upcomingHolidays = holidays.filter(h => h.isUpcoming && !h.isPast).slice(0, 8);
  const allHolidays = holidays.slice(0, 12);

  return (
    <div className="bg-productivity-surface rounded-lg p-4 border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-productivity-text-primary flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-orange-500" />
            Vacation
          </h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 text-productivity-text-secondary hover:text-productivity-text-primary transition-colors"
          title="Refresh Holidays"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* View Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSelectedView('upcoming')}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-full transition-colors",
            selectedView === 'upcoming'
              ? "bg-orange-500 text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          )}
        >
          Upcoming
        </button>
        <button
          onClick={() => setSelectedView('all')}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-full transition-colors",
            selectedView === 'all'
              ? "bg-gray-500 text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          )}
        >
          All Holidays
        </button>
      </div>

      {/* Content */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-productivity-text-tertiary">Loading holidays...</span>
          </div>
        ) : (
          // Holidays List View
          (selectedView === 'upcoming' ? upcomingHolidays : allHolidays).map((holiday) => (
            <div
              key={holiday.id}
              className={cn(
                "p-3 rounded-lg border transition-colors",
                holiday.isPast 
                  ? "bg-gray-50 border-gray-200 opacity-60"
                  : holiday.isLongWeekend 
                    ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                    : "bg-background border-border hover:bg-gray-50"
              )}
            >
              {/* Top row - Holiday name with icon and badges */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg flex-shrink-0">{getHolidayIcon(holiday.category)}</span>
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <span className="font-medium text-sm text-productivity-text-primary">
                    {holiday.name}
                  </span>
                  {holiday.isLongWeekend && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Long Weekend
                    </span>
                  )}
                  {holiday.hasCalendarConflicts && (
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                  )}
                  {holiday.hasBookmarkedConflicts && (
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                  )}
                </div>
              </div>
              
              {/* Bottom row - Date/Time spanning full width with trip score on right */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {/* Big bold date and time with color coding */}
                  <div className="text-base font-bold">
                    <span className="text-productivity-text-primary">{holiday.formattedDate}</span>
                    <span className="text-productivity-text-primary"> • </span>
                    <span className={cn(
                      "font-mono",
                      getVacationIntervalColor(holiday.formattedTimeUntil)
                    )}>
                      {holiday.formattedTimeUntil}
                    </span>
                  </div>
                  
                  {/* Weekend type below the date/time */}
                  {holiday.isLongWeekend && (
                    <div className="text-xs text-blue-600 mt-1">
                      {holiday.weekendType?.replace('-', ' → ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
