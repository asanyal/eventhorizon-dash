import { useState, useEffect } from 'react';
import { CalendarEventsList } from '../components/CalendarEventsList';
import { TimeFilterDropdown } from '../components/TimeFilterDropdown';
import { TodoSection } from '../components/TodoSection';
import { HorizonSection } from '../components/HorizonSection';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { TimeFilter, CalendarEvent } from '../types/calendar';
import { getTimeUntilEvent } from '../utils/dateUtils';
import { Calendar, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';

// Helper function to get greeting based on time of day
const getGreeting = (time: Date) => {
  const hour = time.getHours();
  const timeString = time.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
  
  if (hour >= 5 && hour < 12) {
    return `🌅 Good Morning, it's ${timeString}!`;
  } else if (hour >= 12 && hour < 17) {
    return `☀️ Good Afternoon, it's ${timeString}.`;
  } else {
    return `🌆 Good Evening, it's ${timeString}.`;
  }
};

// Helper function to get the next meeting info
const getNextMeetingInfo = (todayEvents: CalendarEvent[], tomorrowEvents: CalendarEvent[]): string => {
  const now = new Date();
  
  // Helper function to truncate title
  const truncateTitle = (title: string): string => {
    return title.length > 20 ? title.substring(0, 20) + "..." : title;
  };
  
  // Find next meeting today (future events only)
  const futureTodayEvents = todayEvents.filter(event => event.startTime.getTime() > now.getTime());
  
  if (futureTodayEvents.length > 0) {
    const nextEvent = futureTodayEvents[0]; // Events should be sorted by time
    const timeUntil = getTimeUntilEvent(nextEvent.startTime);
    const truncatedTitle = truncateTitle(nextEvent.title);
    return `Your next meeting is "${truncatedTitle}" ${timeUntil.toLowerCase()}.`;
  }
  
  // No more meetings today, check tomorrow's first meeting
  if (tomorrowEvents.length > 0) {
    const firstTomorrowEvent = tomorrowEvents[0]; // First meeting tomorrow
    const timeUntil = getTimeUntilEvent(firstTomorrowEvent.startTime);
    const truncatedTitle = truncateTitle(firstTomorrowEvent.title);
    return `Your next meeting is "${truncatedTitle}" ${timeUntil.toLowerCase()}.`;
  }
  
  return "No upcoming meetings found.";
};

const Index = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [currentTime, setCurrentTime] = useState(new Date());
  const { events, loading, error, refetch } = useCalendarEvents(timeFilter);
  
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
    const currentIndex = timeFilterOptions.indexOf(timeFilter);
    let newIndex;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : timeFilterOptions.length - 1;
    } else {
      newIndex = currentIndex < timeFilterOptions.length - 1 ? currentIndex + 1 : 0;
    }
    
    setTimeFilter(timeFilterOptions[newIndex]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-productivity-text-primary">
              Wake Up
            </h1>
          </div>
          <p className="text-productivity-text-secondary mb-4">
            Each moment is wide open.
          </p>
          <div className="text-2xl font-semibold text-productivity-text-primary">
            {getGreeting(currentTime)}
          </div>
          <div className="text-lg text-productivity-text-secondary mt-2">
            {getNextMeetingInfo(todayEvents, tomorrowEvents)}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Calendar Events */}
          <div>
            {/* Filter Controls */}
            <div className="mb-6">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-productivity-text-secondary">
                  Show events for:
                </span>
                <TimeFilterDropdown 
                  value={timeFilter} 
                  onChange={setTimeFilter}
                />
                
                {/* Navigation Arrows */}
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => navigateTimeFilter('prev')}
                    variant="outline"
                    size="sm"
                    className="p-2"
                    title="Previous time period"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => navigateTimeFilter('next')}
                    variant="outline"
                    size="sm"
                    className="p-2"
                    title="Next time period"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  onClick={refetch}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
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
            />
          </div>

          {/* Right Column - TODO Section and Horizons */}
          <div className="space-y-6">
            <TodoSection />
            <HorizonSection />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
