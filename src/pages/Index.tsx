import { useState, useEffect } from 'react';
import { CalendarEventsList } from '../components/CalendarEventsList';
import { TimeFilterChips } from '../components/TimeFilterChips';
import { TodoSection } from '../components/TodoSection';
import { HorizonSection } from '../components/HorizonSection';
import { KeyEventsSection } from '../components/KeyEventsSection';
import { HolidaysSection } from '../components/HolidaysSection';
import { TimezoneSelector } from '../components/TimezoneSelector';
import { TimezoneProvider, useTimezone } from '../contexts/TimezoneContext';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { TimeFilter, CalendarEvent } from '../types/calendar';
import { getTimeUntilEvent } from '../utils/dateUtils';
import { Calendar, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, PartyPopper, Heart } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { bookmarkApiService } from '../services/bookmarkApi';
import { BookmarkEvent } from '../types/bookmark';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cacheUtils';


// Helper function to get greeting based on time of day
// Uses system time (no timezone conversion) for greeting
const getGreeting = (time: Date) => {
  const hour = time.getHours();
  const dayOfWeek = time.toLocaleDateString('en-US', { weekday: 'short' });
  const dateString = time.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  const timeString = time.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
  
  if (hour >= 5 && hour < 12) {
    return `🌅 Good Morning, it's ${dayOfWeek}, ${dateString}, ${timeString}!`;
  } else if (hour >= 12 && hour < 17) {
    return `☀️ Good Afternoon, it's ${dayOfWeek}, ${dateString}, ${timeString}.`;
  } else {
    return `🌆 Good Evening, it's ${dayOfWeek}, ${dateString}, ${timeString}.`;
  }
};

// Helper function to get ongoing meeting info
const getOngoingMeetingInfo = (todayEvents: CalendarEvent[]): { title: string; timeAgo: string } | null => {
  const now = new Date();
  
  // Helper function to truncate title
  const truncateTitle = (title: string): string => {
    return title.length > 100 ? title.substring(0, 100) + "..." : title;
  };
  
  // Helper function to format time since start
  const getTimeSinceStart = (startTime: Date): string => {
    const diffMs = now.getTime() - startTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 5) {
      return "just started";
    } else if (diffMins < 60) {
      return `started ${diffMins} mins ago`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      if (mins === 0) {
        return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
      } else {
        return hours === 1 ? `1 hour ${mins} mins ago` : `${hours} hours ${mins} mins ago`;
      }
    }
  };
  
  // Find ongoing meeting (started but not ended, excluding all-day events)
  const ongoingEvent = todayEvents.find(event => {
    const startTime = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
    const endTime = new Date(startTime.getTime() + event.duration * 60 * 1000);
    return startTime.getTime() <= now.getTime() && endTime.getTime() > now.getTime() && !event.all_day;
  });
  
  if (ongoingEvent) {
    const startTime = ongoingEvent.startTime instanceof Date ? ongoingEvent.startTime : new Date(ongoingEvent.startTime);
    return {
      title: truncateTitle(ongoingEvent.title),
      timeAgo: getTimeSinceStart(startTime)
    };
  }
  
  return null;
};

// Helper function to get the next meeting info
const getNextMeetingInfo = (todayEvents: CalendarEvent[], tomorrowEvents: CalendarEvent[], convertTime: (date: Date) => Date): { prefix: string; meetingDetails: string | null; suffix: string } => {
  const now = new Date();
  
  // Helper function to truncate title
  const truncateTitle = (title: string): string => {
    return title.length > 100 ? title.substring(0, 100) + "..." : title;
  };
  
  // Find next meeting today (future events only, excluding all-day events)
  const futureTodayEvents = todayEvents.filter(event => {
    // Ensure startTime is a Date object
    const startTime = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
    return startTime.getTime() > now.getTime() && !event.all_day;
  });
  
  if (futureTodayEvents.length > 0) {
    const nextEvent = futureTodayEvents[0]; // Events should be sorted by time
    const startTime = nextEvent.startTime instanceof Date ? nextEvent.startTime : new Date(nextEvent.startTime);
    const timeUntil = getTimeUntilEvent(startTime); // Use original time for interval calculation
    const truncatedTitle = truncateTitle(nextEvent.title);
    return {
      prefix: "Your next event is",
      meetingDetails: `"${truncatedTitle}" ${timeUntil.toLowerCase()}`,
      suffix: "."
    };
  }
  
  // No more meetings today, check tomorrow's first meeting (excluding all-day events)
  const tomorrowTimedEvents = tomorrowEvents.filter(event => !event.all_day);
  if (tomorrowTimedEvents.length > 0) {
    const firstTomorrowEvent = tomorrowTimedEvents[0]; // First meeting tomorrow
    const startTime = firstTomorrowEvent.startTime instanceof Date ? firstTomorrowEvent.startTime : new Date(firstTomorrowEvent.startTime);
    const timeUntil = getTimeUntilEvent(startTime); // Use original time for interval calculation
    const truncatedTitle = truncateTitle(firstTomorrowEvent.title);
    return {
      prefix: "Your next event is",
      meetingDetails: `"${truncatedTitle}" ${timeUntil.toLowerCase()}`,
      suffix: "."
    };
  }
  
  return {
    prefix: "No upcoming events found",
    meetingDetails: null,
    suffix: "."
  };
};

type PageType = 'calendar' | 'health' | 'holidays';

const IndexContent = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD format
  const [currentTime, setCurrentTime] = useState(new Date());
  const [bookmarkRefreshTrigger, setBookmarkRefreshTrigger] = useState(0);
  const [bookmarkedEventTitles, setBookmarkedEventTitles] = useState<string[]>([]);
  const [bookmarkedEvents, setBookmarkedEvents] = useState<BookmarkEvent[]>([]);
  const [currentPage, setCurrentPage] = useState<PageType>('calendar');
  const { convertTime } = useTimezone();
  
  console.log(`###Atin Index component - calling useCalendarEvents with timeFilter: ${timeFilter}, selectedDate: ${selectedDate || 'empty'}`);
  const { events, loading, error, refetch } = useCalendarEvents(timeFilter, selectedDate);
  
  // Get today's and tomorrow's events for next meeting info
  const { events: todayEvents } = useCalendarEvents('today');
  const { events: tomorrowEvents } = useCalendarEvents('tomorrow');

  // Clear any corrupted cache on app startup (one-time fix)
  useEffect(() => {
    const hasCleared = localStorage.getItem('eventhorizon_cache_cleared_v2');
    if (!hasCleared) {
      console.log('🧹 Clearing potentially corrupted cache on startup (v2)');
      cache.clear();
      localStorage.setItem('eventhorizon_cache_cleared_v2', 'true');
    }
  }, []);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 60000ms = 1 minute

    return () => clearInterval(timer);
  }, []);

  // Fetch bookmarked event titles when bookmarkRefreshTrigger changes
  useEffect(() => {
    const fetchBookmarkedEventTitles = async () => {
      try {
        // Try to get from cache first
        const cachedTitles = cache.get<string[]>(CACHE_KEYS.BOOKMARK_TITLES);
        if (cachedTitles) {
          console.log(`📦 Using cached bookmark titles (${cachedTitles.length} items)`);
          setBookmarkedEventTitles(cachedTitles);
          return;
        }
        
        const bookmarks = await bookmarkApiService.getBookmarks();
        const titles = bookmarks.map(bookmark => bookmark.event_title);
        
        // Cache the titles
        cache.set(CACHE_KEYS.BOOKMARK_TITLES, titles, { ttl: CACHE_TTL.BOOKMARKS });
        
        setBookmarkedEventTitles(titles);
        setBookmarkedEvents(bookmarks);
      } catch (error) {
        console.error('Error fetching bookmarked event titles:', error);
      }
    };

    fetchBookmarkedEventTitles();
  }, [bookmarkRefreshTrigger]);

  // Array of time filter options in order
  const timeFilterOptions: TimeFilter[] = [
    'today',
    'tomorrow', 
    'day-after',
    '2-days-after',
    'this-week',
    'next-week',
    'this-month',
    'next-month'
  ];

  const navigateTimeFilter = (direction: 'prev' | 'next') => {
    if (selectedDate) {
      // Navigate by days when a specific date is selected
      const currentDate = new Date(selectedDate);
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
      setSelectedDate(newDate.toISOString().split('T')[0]);
    } else {
      // Navigate by time filter options
      const currentIndex = timeFilterOptions.indexOf(timeFilter);
      let newIndex;
      
      if (direction === 'prev') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : timeFilterOptions.length - 1;
      } else {
        newIndex = currentIndex < timeFilterOptions.length - 1 ? currentIndex + 1 : 0;
      }
      
      setTimeFilter(timeFilterOptions[newIndex]);
    }
  };

  const handleBookmarkCreated = () => {
    // Clear bookmark-related caches
    cache.remove(CACHE_KEYS.BOOKMARKS);
    cache.remove(CACHE_KEYS.BOOKMARK_TITLES);
    
    // Trigger refresh of KeyEventsSection
    setBookmarkRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <Calendar className="w-6 h-6 md:w-8 md:h-8 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-productivity-text-primary">
                Wake Up
              </h1>
            </div>
            <TimezoneSelector />
          </div>
          <p className="text-sm md:text-base text-productivity-text-secondary mb-3 md:mb-4">
            Each moment is wide open.
          </p>
          <div className="text-lg md:text-2xl font-semibold text-productivity-text-primary">
            {getGreeting(currentTime)}
          </div>
          
          {/* Ongoing Meeting Info */}
          {(() => {
            const ongoingInfo = getOngoingMeetingInfo(todayEvents);
            if (ongoingInfo) {
              return (
                <div className="text-sm md:text-lg mt-2">
                  <span className="text-productivity-text-secondary">
                    Ongoing event <span className="font-bold text-productivity-text-primary">"{ongoingInfo.title}"</span> {ongoingInfo.timeAgo}
                  </span>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Next Meeting Info */}
          <div className="text-sm md:text-lg mt-2">
            {(() => {
              const meetingInfo = getNextMeetingInfo(todayEvents, tomorrowEvents, convertTime);
              return (
                <span className="text-productivity-text-secondary">
                  {meetingInfo.prefix}
                  {meetingInfo.meetingDetails && (
                    <span className="ml-1 px-2 py-1 md:px-3 md:py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 transform hover:scale-105 cursor-pointer text-xs md:text-sm">
                      {meetingInfo.meetingDetails}
                    </span>
                  )}
                  <span className="text-productivity-text-secondary">{meetingInfo.suffix}</span>
                </span>
              );
            })()}
          </div>
        </div>

        {/* Navigation Menu Bar */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-center">
            <div className="bg-productivity-surface rounded-full p-1 border border-border shadow-sm">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage('calendar')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    currentPage === 'calendar'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-productivity-text-secondary hover:text-productivity-text-primary hover:bg-background'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Calendar
                </button>
                <button
                  onClick={() => setCurrentPage('health')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    currentPage === 'health'
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'text-productivity-text-secondary hover:text-productivity-text-primary hover:bg-background'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  Health
                </button>
                <button
                  onClick={() => setCurrentPage('holidays')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    currentPage === 'holidays'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-productivity-text-secondary hover:text-productivity-text-primary hover:bg-background'
                  }`}
                >
                  <PartyPopper className="w-4 h-4" />
                  Vacation
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {currentPage === 'calendar' ? (
          /* Calendar Page Content */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Left Column - Key Events (Important events) and Calendar Events */}
          <div className="space-y-4 md:space-y-6">
            <KeyEventsSection
              refreshTrigger={bookmarkRefreshTrigger}
              onBookmarkDeleted={handleBookmarkCreated}
            />

            {/* Calendar Events Container */}
            <div className="bg-productivity-surface rounded-lg border border-border max-h-[800px] overflow-hidden flex flex-col">
              {/* Title and Filter Controls */}
              <div className="p-4 pb-0 flex-shrink-0">
                {/* Events Title */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-productivity-text-primary flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-green-500" />
                      Events
                    </h3>
                    {/* Event count badge */}
                    {!loading && events.length > 0 && (
                      <div className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full border border-green-200">
                        {events.length}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => (refetch as (forceRefresh?: boolean) => void)(true)}
                    disabled={loading}
                    className="p-1 text-productivity-text-secondary hover:text-productivity-text-primary transition-colors"
                    title="Refresh Events"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="mb-4">
                {/* Mobile: Stack controls vertically */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2">
                  {/* Primary filters row */}
                  <div className="flex items-center gap-2 flex-1">
                    <TimeFilterChips
                      value={timeFilter}
                      onChange={(value) => {
                        setTimeFilter(value);
                        setSelectedDate('');
                      }}
                      isDateSelected={!!selectedDate}
                    />

                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        console.log(`###Atin Date picker onChange - old: ${selectedDate}, new: ${newDate}`);
                        if (newDate) {
                          // Clear ALL cache entries for the current timeFilter to avoid stale data
                          // This includes both with and without specific dates
                          const cacheKeyWithDate = `eventhorizon_events_${timeFilter}_${newDate}`;
                          const cacheKeyWithoutDate = `eventhorizon_events_${timeFilter}`;
                          cache.remove(cacheKeyWithDate);
                          cache.remove(cacheKeyWithoutDate);
                          console.log(`🗑️ Cleared cache for keys: ${cacheKeyWithDate}, ${cacheKeyWithoutDate}`);
                        }
                        console.log(`###Atin About to call setSelectedDate with: ${newDate}`);
                        setSelectedDate(newDate);
                        console.log(`###Atin setSelectedDate called`);
                      }}
                      className="px-2 py-1 text-xs border border-border rounded bg-background text-productivity-text-primary focus:outline-none focus:ring-1 focus:ring-primary w-32 sm:w-28"
                      title="Select specific date"
                    />

                    {selectedDate && (
                      <Button
                        onClick={() => setSelectedDate('')}
                        variant="outline"
                        size="sm"
                        className="p-1 h-7 w-7 flex-shrink-0"
                        title="Clear date"
                      >
                        ×
                      </Button>
                    )}
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <Button
                      onClick={() => navigateTimeFilter('prev')}
                      variant="outline"
                      size="sm"
                      className="p-1 h-7 w-7"
                      title="Previous"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => navigateTimeFilter('next')}
                      variant="outline"
                      size="sm"
                      className="p-1 h-7 w-7"
                      title="Next"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                </div>

                {/* Error Alert */}
                {error && (
                  <Alert className="mb-6" variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Failed to load events: {error}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Events List - Scrollable */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <CalendarEventsList
                  events={events}
                  timeFilter={timeFilter}
                  loading={loading}
                  onBookmarkCreated={handleBookmarkCreated}
                  selectedDate={selectedDate}
                  bookmarkedEventTitles={bookmarkedEventTitles}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Horizons and TODO Section */}
          <div className="space-y-4 md:space-y-6">
            <HorizonSection />
            <TodoSection />
          </div>
          </div>
        ) : currentPage === 'health' ? (
          /* Health Page Content */
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Heart className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-productivity-text-primary mb-2">Health Page</h2>
              <p className="text-productivity-text-secondary">
                Coming soon! This will show health tracking and wellness information.
              </p>
            </div>
          </div>
        ) : (
          /* Holidays Page Content */
          <div className="max-w-4xl mx-auto">
            <HolidaysSection 
              calendarEvents={events}
              bookmarkedEvents={bookmarkedEvents}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const Index = () => {
  return (
    <TimezoneProvider>
      <IndexContent />
    </TimezoneProvider>
  );
};

export default Index;
