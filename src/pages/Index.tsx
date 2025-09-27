import { useState, useEffect } from 'react';
import { CalendarEventsList } from '../components/CalendarEventsList';
import { TimeFilterDropdown } from '../components/TimeFilterDropdown';
import { TodoSection } from '../components/TodoSection';
import { HorizonSection } from '../components/HorizonSection';
import { KeyEventsSection } from '../components/KeyEventsSection';
import { TimezoneSelector } from '../components/TimezoneSelector';
import { TimezoneProvider, useTimezone } from '../contexts/TimezoneContext';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { TimeFilter, CalendarEvent } from '../types/calendar';
import { getTimeUntilEvent } from '../utils/dateUtils';
import { Calendar, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { bookmarkApiService } from '../services/bookmarkApi';
import { BookmarkEvent } from '../types/bookmark';

// Helper function to get greeting based on time of day
const getGreeting = (time: Date, convertTime: (date: Date) => Date) => {
  const localTime = convertTime(time);
  const hour = localTime.getHours();
  const dateString = localTime.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  const timeString = localTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
  
  if (hour >= 5 && hour < 12) {
    return `🌅 Good Morning, it's ${dateString}, ${timeString}!`;
  } else if (hour >= 12 && hour < 17) {
    return `☀️ Good Afternoon, it's ${dateString}, ${timeString}.`;
  } else {
    return `🌆 Good Evening, it's ${dateString}, ${timeString}.`;
  }
};

// Helper function to get the next meeting info
const getNextMeetingInfo = (todayEvents: CalendarEvent[], tomorrowEvents: CalendarEvent[], convertTime: (date: Date) => Date): { prefix: string; meetingDetails: string | null; suffix: string } => {
  const now = new Date();
  
  // Helper function to truncate title
  const truncateTitle = (title: string): string => {
    return title.length > 100 ? title.substring(0, 100) + "..." : title;
  };
  
  // Find next meeting today (future events only, excluding all-day events)
  const futureTodayEvents = todayEvents.filter(event => 
    event.startTime.getTime() > now.getTime() && !event.all_day
  );
  
  if (futureTodayEvents.length > 0) {
    const nextEvent = futureTodayEvents[0]; // Events should be sorted by time
    const timeUntil = getTimeUntilEvent(nextEvent.startTime); // Use original time for interval calculation
    const truncatedTitle = truncateTitle(nextEvent.title);
    return {
      prefix: "Your next meeting is",
      meetingDetails: `"${truncatedTitle}" ${timeUntil.toLowerCase()}`,
      suffix: "."
    };
  }
  
  // No more meetings today, check tomorrow's first meeting (excluding all-day events)
  const tomorrowTimedEvents = tomorrowEvents.filter(event => !event.all_day);
  if (tomorrowTimedEvents.length > 0) {
    const firstTomorrowEvent = tomorrowTimedEvents[0]; // First meeting tomorrow
    const timeUntil = getTimeUntilEvent(firstTomorrowEvent.startTime); // Use original time for interval calculation
    const truncatedTitle = truncateTitle(firstTomorrowEvent.title);
    return {
      prefix: "Your next meeting is",
      meetingDetails: `"${truncatedTitle}" ${timeUntil.toLowerCase()}`,
      suffix: "."
    };
  }
  
  return {
    prefix: "No upcoming meetings found",
    meetingDetails: null,
    suffix: "."
  };
};

const IndexContent = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD format
  const [currentTime, setCurrentTime] = useState(new Date());
  const [bookmarkRefreshTrigger, setBookmarkRefreshTrigger] = useState(0);
  const [bookmarkedEventTitles, setBookmarkedEventTitles] = useState<string[]>([]);
  const { convertTime } = useTimezone();
  const { events, loading, error, refetch } = useCalendarEvents(timeFilter, selectedDate);
  
  // Get today's and tomorrow's events for next meeting info
  const { events: todayEvents } = useCalendarEvents('today');
  const { events: tomorrowEvents } = useCalendarEvents('tomorrow');

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
        const bookmarks = await bookmarkApiService.getBookmarks();
        const titles = bookmarks.map(bookmark => bookmark.event_title);
        setBookmarkedEventTitles(titles);
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
            {getGreeting(currentTime, convertTime)}
          </div>
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Left Column - Calendar Events */}
          <div>
            {/* Filter Controls */}
            <div className="mb-4">
              {/* Mobile: Stack controls vertically */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2">
                {/* Primary filters row */}
                <div className="flex items-center gap-2 flex-1">
                  <TimeFilterDropdown 
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
                    onChange={(e) => setSelectedDate(e.target.value)}
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
                
                {/* Navigation and action buttons */}
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

                  <Button
                    onClick={refetch}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="p-1 h-7 w-7"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
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

            {/* Events List */}
            <CalendarEventsList 
              events={events} 
              timeFilter={timeFilter}
              loading={loading}
              onBookmarkCreated={handleBookmarkCreated}
              selectedDate={selectedDate}
              bookmarkedEventTitles={bookmarkedEventTitles}
            />
            
            {/* TODO Section - moved below Calendar Events */}
            <div className="mt-4 md:mt-6">
              <TodoSection />
            </div>
          </div>

          {/* Right Column - Key Events and Horizons */}
          <div className="space-y-4 md:space-y-6">
            <KeyEventsSection refreshTrigger={bookmarkRefreshTrigger} />
            <HorizonSection />
          </div>
        </div>
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
