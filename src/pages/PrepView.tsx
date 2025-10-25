import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { CalendarEvent } from '../types/calendar';
import { getTimeUntilEvent, getIntervalColor } from '../utils/dateUtils';
import { TimezoneProvider } from '../contexts/TimezoneContext';

type PrepTimeFilter = 'today' | 'tomorrow' | 'this-week' | 'next-week';

// Helper to extract external domains from attendees
const getExternalDomains = (attendees: string[]): string[] => {
  const domains = new Set<string>();

  attendees.forEach(email => {
    // Skip galileo.ai emails
    if (!email.toLowerCase().includes('@galileo.ai')) {
      const match = email.match(/@([^@]+)$/);
      if (match) {
        domains.add(match[1]);
      }
    }
  });

  return Array.from(domains);
};

// Helper to extract names from emails
const getAttendeeNames = (attendees: string[]): string[] => {
  return attendees.map(email => {
    // Extract name before @ symbol
    const match = email.match(/^([^@]+)@/);
    return match ? match[1] : email;
  });
};

// Helper to check if event is external (has non-galileo.ai attendees)
const isExternalEvent = (attendees: string[]): boolean => {
  return attendees.some(email => !email.toLowerCase().includes('@galileo.ai'));
};

// Helper to filter events based on prep rules
const filterPrepEvents = (events: CalendarEvent[]): CalendarEvent[] => {
  const now = new Date();

  // Blocklist - events that should NOT be shown
  const blocklist = ['DNS - Focus Time'];

  // Exception list - events that should always be shown regardless of attendee count
  const exceptions = ['☀️🌻Burlingame Office Crew'];

  return events.filter(event => {
    // Only future events
    const eventTime = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
    if (eventTime.getTime() <= now.getTime()) {
      return false;
    }

    // Check if event is in blocklist
    const isBlocked = blocklist.some(blocked => event.title.includes(blocked));
    if (isBlocked) {
      return false;
    }

    // Check if event is in exceptions list
    const isException = exceptions.some(exception => event.title.includes(exception));

    // Ignore meetings with >5 people unless external or in exceptions list
    const attendeeCount = event.attendees.length;
    if (attendeeCount > 5 && !isExternalEvent(event.attendees) && !isException) {
      return false;
    }

    return true;
  });
};

const PrepViewContent = () => {
  const [selectedFilter, setSelectedFilter] = useState<PrepTimeFilter>('today');
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  // Fetch events for each time range
  const { events: todayEvents, loading: todayLoading } = useCalendarEvents('today');
  const { events: tomorrowEvents, loading: tomorrowLoading } = useCalendarEvents('tomorrow');
  const { events: thisWeekEvents, loading: thisWeekLoading } = useCalendarEvents('this-week');
  const { events: nextWeekEvents, loading: nextWeekLoading } = useCalendarEvents('next-week');

  // Update clock every minute for countdown updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 60000ms = 1 minute

    return () => clearInterval(timer);
  }, []);

  // Escape key to go back
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  // Get filtered events based on selected filter
  const getFilteredEvents = (): CalendarEvent[] => {
    let events: CalendarEvent[] = [];

    switch (selectedFilter) {
      case 'today':
        events = todayEvents;
        break;
      case 'tomorrow':
        events = tomorrowEvents;
        break;
      case 'this-week':
        events = thisWeekEvents;
        break;
      case 'next-week':
        events = nextWeekEvents;
        break;
    }

    return filterPrepEvents(events);
  };

  const filteredEvents = getFilteredEvents();
  const isLoading = todayLoading || tomorrowLoading || thisWeekLoading || nextWeekLoading;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Back Button */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center justify-center pt-6 md:pt-12 pb-6 md:pb-8 px-4">
        <div className="flex flex-wrap gap-2 md:gap-4 justify-center">
          {(['today', 'tomorrow', 'this-week', 'next-week'] as PrepTimeFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-4 py-2 md:px-8 md:py-4 rounded-full text-sm md:text-xl font-bold transition-all duration-200 ${
                selectedFilter === filter
                  ? 'bg-red-600 text-white shadow-lg scale-105'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {filter === 'today' && 'Today'}
              {filter === 'tomorrow' && 'Tomorrow'}
              {filter === 'this-week' && 'This Week'}
              {filter === 'next-week' && 'Next Week'}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="container mx-auto px-4 md:px-8 pb-12">
        {isLoading ? (
          <div className="text-center text-gray-500 text-lg md:text-2xl mt-8 md:mt-12">
            Loading events...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center text-gray-500 text-lg md:text-2xl mt-8 md:mt-12">
            No events to prepare for
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto">
            {filteredEvents.map((event, index) => {
              const eventTime = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
              const timeUntil = getTimeUntilEvent(eventTime);
              const intervalColor = getIntervalColor(timeUntil);
              const externalDomains = getExternalDomains(event.attendees);
              const attendeeNames = getAttendeeNames(event.attendees);

              return (
                <div
                  key={`${event.id}-${index}`}
                  className="py-4 md:py-8 relative"
                >
                  {/* External Domains at top */}
                  {externalDomains.length > 0 && (
                    <div className="mb-3 md:mb-4 flex gap-2 flex-wrap">
                      {externalDomains.map((domain, idx) => (
                        <span
                          key={idx}
                          className="text-yellow-400 font-bold text-sm md:text-lg px-2 py-1 md:px-3 md:py-1 bg-yellow-400/10 rounded"
                        >
                          {domain}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Main Content: Mobile - Stack vertically, Desktop - Countdown on left, Title centered */}
                  <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-8">
                    {/* Countdown - Top on mobile, Left side on desktop */}
                    <div className={`flex-shrink-0 text-xl md:text-2xl font-bold ${intervalColor} md:min-w-[180px]`}>
                      {timeUntil}
                    </div>

                    {/* Title - BIG and centered on desktop, left-aligned on mobile */}
                    <div className="flex-1 md:text-center">
                      <h2 className="text-2xl md:text-5xl font-bold leading-tight">
                        {event.title}
                      </h2>
                    </div>

                    {/* Spacer to balance the countdown on left (desktop only) */}
                    <div className="hidden md:block flex-shrink-0 min-w-[180px]"></div>
                  </div>

                  {/* Attendee names at bottom */}
                  {attendeeNames.length > 0 && (
                    <div className="mt-3 md:mt-4 text-gray-400 text-sm md:text-lg">
                      <span className="font-semibold">With:</span> {attendeeNames.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const PrepView = () => {
  return (
    <TimezoneProvider>
      <PrepViewContent />
    </TimezoneProvider>
  );
};

export default PrepView;
