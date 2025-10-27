import { CalendarEvent, TimeFilter } from '../types/calendar';
import { formatDateTime, getTimeUntilEvent, formatDuration, getUrgencyLevel, getUrgencyColor, getIntervalColor } from '../utils/dateUtils';
import { cn } from '../lib/utils';
import { useState, useEffect, useRef } from 'react';
import { Bookmark, FileText, Search, X } from 'lucide-react';
import { bookmarkApiService } from '../services/bookmarkApi';
import { CreateBookmarkRequest } from '../types/bookmark';
import { useTimezone } from '../contexts/TimezoneContext';
import { useSimpleView } from '../contexts/SimpleViewContext';
import { useIsMobile } from '../hooks/use-mobile';

// Add CSS for subtle blinking animation
const style = document.createElement('style');
style.textContent = `
  @keyframes subtle-blink {
    0%, 100% { 
      opacity: 1;
      filter: brightness(1);
    }
    50% { 
      opacity: 0.5;
      filter: brightness(1.1) saturate(1.3) hue-rotate(-10deg);
    }
  }

  @keyframes inner-glow {
    0%, 100% {
      box-shadow: inset 0 0 6px rgba(239,68,68,0.3);
    }
    50% {
      box-shadow: inset 0 0 12px rgba(239,68,68,0.6);
    }
  }
  .ongoing-event {
    animation: inner-glow 10s ease-in-out infinite;
  }
`;
document.head.appendChild(style);

interface CalendarEventsListProps {
  events: CalendarEvent[];
  timeFilter: TimeFilter;
  loading?: boolean;
  onBookmarkCreated?: () => void;
  selectedDate?: string;
  bookmarkedEventTitles?: string[];
}

// Helper function to get initials from email
const getInitials = (email: string): string => {
  const name = email.split('@')[0];
  return name.charAt(0).toUpperCase();
};

// Helper function to filter out resource emails (calendar rooms, etc.)
const isHumanAttendee = (email: string): boolean => {
  return !email.includes('resource.calendar.google.com') && !email.includes('c_');
};

// Helper function to format date as "Thu, Sep 23"
const formatMinimalDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Helper function to check if meeting is external (has non-Galileo attendees)
const isExternalMeeting = (attendees: string[]): boolean => {
  const humanAttendees = attendees.filter(isHumanAttendee);
  return humanAttendees.some(email => 
    !email.endsWith('@galileo.ai') && !email.endsWith('@rungalileo.io')
  );
};

// Helper functions for summary calculations
const getMeetingTypes = (events: CalendarEvent[]) => {
  const external = events.filter(e => isExternalMeeting(e.attendees)).length;
  const internal = events.length - external;
  
  return [
    { label: 'Internal', count: internal },
    { label: 'External', count: external }
  ].filter((type, idx) => (idx === 0 ? internal : external) > 0);
};

const getTimeDistribution = (events: CalendarEvent[]) => {
  const morning = events.filter(e => e.startTime.getHours() < 12).length;
  const afternoon = events.filter(e => e.startTime.getHours() >= 12).length;
  
  return [
    { label: 'Morning:', count: morning },
    { label: 'Afternoon:', count: afternoon }
  ].filter((time, idx) => (idx === 0 ? morning : afternoon) > 0);
};

// Helper function to get day key for grouping
const getDayKey = (date: Date): string => {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

// Helper function to check if two dates are on the same day
const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

// Helper function to format free time duration
const formatFreeTimeDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}min`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins}min`;
  }
};

// Helper function to format selected date or date range for display
const formatDateRangeDisplay = (timeFilter: TimeFilter, selectedDate?: string): string => {
  if (selectedDate) {
    // Date picker selection - format as "Mon, Oct 5"
    const date = new Date(selectedDate + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  
  // Calculate date ranges for chip selections
  const now = new Date();
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatDateWithDay = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  switch (timeFilter) {
    case 'today':
      return formatDateWithDay(now);
    case 'tomorrow': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return formatDateWithDay(tomorrow);
    }
    case 'day-after': {
      const dayAfter = new Date(now);
      dayAfter.setDate(dayAfter.getDate() + 2);
      return formatDateWithDay(dayAfter);
    }
    case '2-days-after': {
      const twoDaysAfter = new Date(now);
      twoDaysAfter.setDate(twoDaysAfter.getDate() + 3);
      return formatDateWithDay(twoDaysAfter);
    }
    case 'this-week': {
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      if (dayOfWeek === 0) {
        // If it's Sunday, show Monday-Friday of the upcoming week
        const monday = new Date(now);
        monday.setDate(monday.getDate() + 1);
        const friday = new Date(now);
        friday.setDate(friday.getDate() + 5);
        return `${formatDate(monday)} - ${formatDate(friday)}`;
      } else {
        // For other days, show from today until end of the week (Sunday)
        const endOfWeek = new Date(now);
        endOfWeek.setDate(endOfWeek.getDate() + (7 - dayOfWeek));
        return `${formatDate(now)} - ${formatDate(endOfWeek)}`;
      }
    }
    case 'next-week': {
      const nextWeekStart = new Date(now);
      nextWeekStart.setDate(nextWeekStart.getDate() + (7 - now.getDay()));
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
      return `${formatDate(nextWeekStart)} - ${formatDate(nextWeekEnd)}`;
    }
    case 'this-month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return `${formatDate(startOfMonth)} - ${formatDate(endOfMonth)}`;
    }
    case 'next-month': {
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return `${formatDate(startOfNextMonth)} - ${formatDate(endOfNextMonth)}`;
    }
    default:
      return '';
  }
};

// Calculate free time between events
interface FreeTimeBlock {
  duration: string;
  show: boolean;
  type: 'before-first' | 'between' | 'after-last';
}

// Calculate free time BEFORE the first event of the day
const calculateBeforeFirstFreeTime = (
  firstEvent: CalendarEvent,
  convertTime: (date: Date) => Date,
  loggedSet?: Set<string>
): FreeTimeBlock => {
  const now = new Date();
  const currentStartConverted = convertTime(firstEvent.startTime);
  
  // Define day boundaries in system timezone (events are already in system timezone)
  const dayStart = new Date(currentStartConverted);
  dayStart.setHours(6, 30, 0, 0);
  
  if (currentStartConverted.getTime() > dayStart.getTime()) {
    const gapMinutes = Math.floor((currentStartConverted.getTime() - dayStart.getTime()) / (1000 * 60));
    
    // Show ribbon if gap >= 75 minutes, regardless of current time
    if (gapMinutes >= 75) {
      const logKey = `before-${firstEvent.id}`;
      if (loggedSet && !loggedSet.has(logKey)) {
        console.log(`###Atin Free time detected BEFORE FIRST event - Gap: ${gapMinutes} min, Next: "${firstEvent.title}"`);
        loggedSet.add(logKey);
      }
      
      // Check if we're currently in the free time period to show remaining time
      if (now.getTime() >= dayStart.getTime() && now.getTime() < currentStartConverted.getTime()) {
        const remainingMinutes = Math.floor((currentStartConverted.getTime() - now.getTime()) / (1000 * 60));
        const totalDuration = formatFreeTimeDuration(gapMinutes);
        const remaining = formatFreeTimeDuration(remainingMinutes);
        return {
          duration: `${totalDuration} free (${remaining} left)`,
          show: true,
          type: 'before-first'
        };
      }
      
      return {
        duration: `${formatFreeTimeDuration(gapMinutes)} free`,
        show: true,
        type: 'before-first'
      };
    }
  }
  
  return { duration: '', show: false, type: 'before-first' };
};

// Calculate free time AFTER an event (between events or after last event)
const calculateFreeTime = (
  currentEvent: CalendarEvent,
  nextEvent: CalendarEvent | null,
  isLastOfDay: boolean,
  convertTime: (date: Date) => Date,
  loggedSet?: Set<string>
): FreeTimeBlock => {
  const now = new Date();
  console.log(`###Atin calculateFreeTime called for "${currentEvent.title}", isLast: ${isLastOfDay}, nextEvent: ${nextEvent?.title || 'none'}`);
  
  // Convert times to system timezone for display
  const currentStartConverted = convertTime(currentEvent.startTime);
  const currentEndTime = new Date(currentEvent.startTime.getTime() + currentEvent.duration * 60 * 1000);
  const currentEndConverted = convertTime(currentEndTime);
  
  // Check if event spans multiple days - ignore these
  if (!isSameDay(currentStartConverted, currentEndConverted)) {
    return { duration: '', show: false, type: 'between' };
  }
  
  // Define day boundaries in system timezone (events are already in system timezone)
  const dayEnd = new Date(currentStartConverted);
  dayEnd.setHours(19, 30, 0, 0);
  
  // Check for free time between events (or to end of day if no more timed events)
  if (nextEvent) {
    const nextStartConverted = convertTime(nextEvent.startTime);
    const sameDay = isSameDay(currentEndConverted, nextStartConverted);
    console.log(`###Atin Checking between "${currentEvent.title}" and "${nextEvent.title}" - all_day: ${nextEvent.all_day}, sameDay: ${sameDay}, currentEnd: ${currentEndConverted.toLocaleString()}, nextStart: ${nextStartConverted.toLocaleString()}`);
    
    if (sameDay) {
      // If next event is all-day or after 7:30 PM, cap at 7:30 PM
      if (nextEvent.all_day || nextStartConverted.getTime() >= dayEnd.getTime()) {
        const freeTimeEnd = dayEnd;
        const gapMinutes = Math.floor((freeTimeEnd.getTime() - currentEndConverted.getTime()) / (1000 * 60));
        
        console.log(`###Atin Next event is all-day or after 7:30 PM, capping - gapMinutes: ${gapMinutes}, Prev: "${currentEvent.title}"`);
        
        // Show ribbon if gap >= 75 minutes, regardless of current time
        if (gapMinutes >= 75 && currentEndConverted.getTime() < freeTimeEnd.getTime()) {
          const logKey = `between-capped-${currentEvent.id}`;
          if (loggedSet && !loggedSet.has(logKey)) {
            console.log(`###Atin Free time detected (capped) - Gap: ${gapMinutes} min, Prev: "${currentEvent.title}"`);
            loggedSet.add(logKey);
          }
          
          // Check if we're currently in the free time period to show remaining time
          if (now.getTime() >= currentEndConverted.getTime() && now.getTime() < freeTimeEnd.getTime()) {
            const remainingMinutes = Math.floor((freeTimeEnd.getTime() - now.getTime()) / (1000 * 60));
            const totalDuration = formatFreeTimeDuration(gapMinutes);
            const remaining = formatFreeTimeDuration(remainingMinutes);
            return {
              duration: `${totalDuration} free (${remaining} left)`,
              show: true,
              type: 'between'
            };
          }
          
          return {
            duration: `${formatFreeTimeDuration(gapMinutes)} free`,
            show: true,
            type: 'between'
          };
        }
      } else {
        // Next event is timed and before 7:30 PM - normal between-events calculation
        const freeTimeEnd = nextStartConverted;
        const gapMinutes = Math.floor((freeTimeEnd.getTime() - currentEndConverted.getTime()) / (1000 * 60));
        
        console.log(`###Atin Between meetings - gapMinutes: ${gapMinutes}, Prev: "${currentEvent.title}", Next: "${nextEvent.title}"`);
        
        // Show ribbon if gap >= 75 minutes, regardless of current time
        if (gapMinutes >= 75) {
          const logKey = `between-${currentEvent.id}-${nextEvent.id}`;
          if (loggedSet && !loggedSet.has(logKey)) {
            console.log(`###Atin Free time detected - Gap: ${gapMinutes} min, Prev: "${currentEvent.title}", Next: "${nextEvent.title}"`);
            loggedSet.add(logKey);
          }
          
          // Check if we're currently in the free time period to show remaining time
          if (now.getTime() >= currentEndConverted.getTime() && now.getTime() < freeTimeEnd.getTime()) {
            const remainingMinutes = Math.floor((freeTimeEnd.getTime() - now.getTime()) / (1000 * 60));
            const totalDuration = formatFreeTimeDuration(gapMinutes);
            const remaining = formatFreeTimeDuration(remainingMinutes);
            return {
              duration: `${totalDuration} free (${remaining} left)`,
              show: true,
              type: 'between'
            };
          }
          
          return {
            duration: `${formatFreeTimeDuration(gapMinutes)} free`,
            show: true,
            type: 'between'
          };
        }
      }
    }
  }
  
  // Check for free time after last event
  // This applies if: (1) it's marked as last of day, OR (2) next event is after 7:30 PM
  const isEffectivelyLastEvent = isLastOfDay || (nextEvent && convertTime(nextEvent.startTime).getTime() >= dayEnd.getTime());
  
  if (isEffectivelyLastEvent && currentEndConverted.getTime() < dayEnd.getTime()) {
    const gapMinutes = Math.floor((dayEnd.getTime() - currentEndConverted.getTime()) / (1000 * 60));
    console.log(`###Atin AFTER LAST event - gapMinutes: ${gapMinutes}, Prev: "${currentEvent.title}", isLastOfDay: ${isLastOfDay}, isEffectivelyLast: ${isEffectivelyLastEvent}`);
    
    // Show ribbon if gap >= 75 minutes, regardless of current time
    if (gapMinutes >= 75) {
      const logKey = `after-${currentEvent.id}`;
      if (loggedSet && !loggedSet.has(logKey)) {
        console.log(`###Atin Free time detected AFTER LAST event - Gap: ${gapMinutes} min, Prev: "${currentEvent.title}"`);
        loggedSet.add(logKey);
      }
      
      // Check if we're currently in the free time period to show remaining time
      if (now.getTime() >= currentEndConverted.getTime() && now.getTime() < dayEnd.getTime()) {
        const remainingMinutes = Math.floor((dayEnd.getTime() - now.getTime()) / (1000 * 60));
        const totalDuration = formatFreeTimeDuration(gapMinutes);
        const remaining = formatFreeTimeDuration(remainingMinutes);
        return {
          duration: `${totalDuration} free (${remaining} left)`,
          show: true,
          type: 'after-last'
        };
      }
      
      return {
        duration: `${formatFreeTimeDuration(gapMinutes)} free`,
        show: true,
        type: 'after-last'
      };
    }
  }
  
  return { duration: '', show: false, type: 'between' };
};


// Helper function to filter events based on search query
const filterEventsBySearch = (events: CalendarEvent[], searchQuery: string, convertTime: (date: Date) => Date) => {
  if (!searchQuery.trim()) return events;
  
  const query = searchQuery.toLowerCase().trim();
  
  return events.filter(event => {
    const convertedEvent = {
      ...event,
      startTime: convertTime(event.startTime)
    };
    
    // Search in event title
    if (event.title.toLowerCase().includes(query)) return true;
    
    // Search in attendees
    if (event.attendees.some(attendee => attendee.toLowerCase().includes(query))) return true;
    
    // Search in formatted date (e.g., "Oct 3", "Thu, Oct 3")
    const formattedDate = formatMinimalDate(convertedEvent.startTime).toLowerCase();
    if (formattedDate.includes(query)) return true;
    
    // Search in formatted time
    const formattedTime = formatDateTime(convertedEvent.startTime).toLowerCase();
    if (formattedTime.includes(query)) return true;
    
    // Search in duration
    const duration = formatDuration(event.duration).toLowerCase();
    if (duration.includes(query)) return true;
    
    // Search in notes (if available)
    if (event.notes && event.notes.toLowerCase().includes(query)) return true;
    
    // Search in organizer email
    if (event.organizerEmail && event.organizerEmail.toLowerCase().includes(query)) return true;
    
    return false;
  });
};

export const CalendarEventsList = ({ events, timeFilter, loading = false, onBookmarkCreated, selectedDate, bookmarkedEventTitles = [] }: CalendarEventsListProps) => {
  const [clickedChip, setClickedChip] = useState<string | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [showAllDayEvents, setShowAllDayEvents] = useState(false);
  const [pinnedTooltip, setPinnedTooltip] = useState<string | null>(null);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { convertTime } = useTimezone();
  const { isSimpleView } = useSimpleView();
  const isMobile = useIsMobile();
  const loggedFreeTimeRef = useRef(new Set<string>());

  // Debug: Log received events
  console.log(`###Atin CalendarEventsList received ${events.length} events for timeFilter: ${timeFilter}, selectedDate: ${selectedDate || 'none'}`);
  if (events.length > 0) {
    const eventDates = events.map(e => e.startTime.toISOString().split('T')[0]);
    const uniqueDates = [...new Set(eventDates)];
    console.log(`###Atin Event dates in list: ${uniqueDates.join(', ')}`);
  }

  // Timer to refresh free time remaining calculations every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 60000); // Update every 60 seconds

    return () => clearInterval(timer);
  }, []);

  // Clear logged free time when events change
  useEffect(() => {
    loggedFreeTimeRef.current.clear();
  }, [events, timeFilter, selectedDate, searchQuery, showPastEvents, meetingTypeFilter]);

  // Handle escape key to close pinned tooltip
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinnedTooltip(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleTooltipClick = (eventId: string) => {
    if (pinnedTooltip === eventId) {
      setPinnedTooltip(null); // Unpin if already pinned
    } else {
      setPinnedTooltip(eventId); // Pin this tooltip
    }
  };

  
  const handleBookmark = async (event: CalendarEvent) => {
    try {
      const isCurrentlyBookmarked = bookmarkedEventTitles.includes(event.title);
      
      if (isCurrentlyBookmarked) {
        // Unbookmark the event
        await bookmarkApiService.deleteBookmarkByTitle(event.title);
      } else {
        // Bookmark the event
        const bookmarkData: CreateBookmarkRequest = {
          date: formatMinimalDate(event.startTime),
          time: event.startTime.toISOString(), // Store actual event start time instead of relative time
          event_title: event.title,
          duration: event.duration,
          attendees: event.attendees
        };
        
        await bookmarkApiService.createBookmark(bookmarkData);
      }
      
      // Notify parent component that bookmark state changed
      if (onBookmarkCreated) {
        onBookmarkCreated();
      }
    } catch (error) {
      console.error('Error updating bookmark:', error);
    }
  };
  
  // Apply search filter first, then calculate summary data
  const searchFilteredEvents = filterEventsBySearch(events, searchQuery, convertTime);
  
  // Calculate summary data with timezone conversion
  const eventsWithConvertedTimes = searchFilteredEvents.map(event => ({
    ...event,
    startTime: convertTime(event.startTime)
  }));
  
  const meetingTypes = getMeetingTypes(searchFilteredEvents);
  const timeDistribution = getTimeDistribution(eventsWithConvertedTimes);
  
  // Simple View - Show only essential information
  if (isSimpleView) {
    return (
      <div className="space-y-4">
        {/* Sticky Header: Date Display and Search Bar */}
        <div className="sticky top-0 z-10 bg-white pb-4 space-y-4">
          {/* Selected Date Display */}
          <div className="bg-blue-50 border-l-4 border-blue-400 px-4 py-2 rounded-r-lg">
            <div className="text-sm font-medium text-blue-900">
              📅 {formatDateRangeDisplay(timeFilter, selectedDate)}
            </div>
          </div>

          {/* Search Bar */}
          {events.length > 0 && !loading && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search events, attendees, dates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>


        {/* Simple View - Events List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-lg text-gray-500">
              Loading events...
            </div>
          ) : searchFilteredEvents.length === 0 ? (
            <div className="text-center py-8 text-lg text-gray-500">
              {searchQuery ? `No events found matching "${searchQuery}"` : "No events found"}
            </div>
          ) : (
            (() => {
              const filteredEvents = searchFilteredEvents.filter(event => {
                const eventEndTime = new Date(event.startTime.getTime() + event.duration * 60 * 1000);
                const isPastEvent = eventEndTime.getTime() < new Date().getTime();
                const pastEventFilter = showPastEvents || !isPastEvent;
                const allDayFilter = showAllDayEvents || !event.all_day;
                return pastEventFilter && allDayFilter;
              });
              
              // Filter out all-day events for free time calculation
              const timedEvents = filteredEvents.filter(e => !e.all_day);
              
              // Group events by day
              const eventsByDay = new Map<string, CalendarEvent[]>();
              timedEvents.forEach(event => {
                const convertedStart = convertTime(event.startTime);
                const dayKey = getDayKey(convertedStart);
                if (!eventsByDay.has(dayKey)) {
                  eventsByDay.set(dayKey, []);
                }
                eventsByDay.get(dayKey)!.push(event);
              });
              
              // Sort events within each day
              eventsByDay.forEach(dayEvents => {
                dayEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
              });
              
              return filteredEvents.map((event, index) => {
                const convertedEvent = {
                  ...event,
                  startTime: convertTime(event.startTime)
                };
                
                const eventEndTime = new Date(event.startTime.getTime() + event.duration * 60 * 1000);
                const now = new Date();
                const isPastEvent = eventEndTime.getTime() < now.getTime();
                const isOngoing = event.startTime.getTime() <= now.getTime() && eventEndTime.getTime() > now.getTime();
                const isBookmarked = bookmarkedEventTitles.includes(event.title);
                
                // Calculate free time for timed events only (refreshes with refreshTrigger)
                let beforeFirstFreeTime: FreeTimeBlock = { duration: '', show: false, type: 'before-first' };
                let freeTime: FreeTimeBlock = { duration: '', show: false, type: 'between' };
                
                if (!event.all_day) {
                  const dayKey = getDayKey(convertedEvent.startTime);
                  const dayEvents = eventsByDay.get(dayKey) || [];
                  const eventIndexInDay = dayEvents.findIndex(e => e.id === event.id);
                  
                  if (eventIndexInDay !== -1) {
                    const isFirstOfDay = eventIndexInDay === 0;
                    const isLastOfDay = eventIndexInDay === dayEvents.length - 1;
                    const nextEvent = !isLastOfDay ? dayEvents[eventIndexInDay + 1] : null;
                    
                    // Check for free time before first event
                    if (isFirstOfDay) {
                      beforeFirstFreeTime = calculateBeforeFirstFreeTime(event, convertTime, loggedFreeTimeRef.current);
                    }
                    
                    // Check for free time after event
                    freeTime = calculateFreeTime(event, nextEvent, isLastOfDay, convertTime, loggedFreeTimeRef.current);
                  }
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
                void refreshTrigger; // Force re-render every minute to update remaining time
                
                return (
                  <div key={event.id}>
                    {/* Free Time Ribbon - Before First Event */}
                    {beforeFirstFreeTime.show && (
                      <div className="mb-3">
                        <div className="bg-emerald-50 border-l-4 border-emerald-300 px-3 py-1 rounded-r-md">
                          <div className="text-sm font-medium text-emerald-700">
                            {beforeFirstFreeTime.duration}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    
                    <div
                      className={cn(
                        "rounded-lg p-4 border-2 transition-all duration-200",
                        isBookmarked 
                          ? "bg-red-50 border-red-200 hover:border-red-300 hover:shadow-md"
                          : isPastEvent 
                          ? "border-gray-200 bg-gray-50" 
                          : "bg-white border-blue-200 hover:border-blue-300 hover:shadow-md",
                        isOngoing && !event.all_day && "ongoing-event"
                      )}
                    >
                    <div className="flex items-center gap-3">
                      {/* Interval Cell */}
                      {!isPastEvent && !event.all_day && (
                        <div className="flex-shrink-0 w-[10%] min-w-[80px]">
                          {(() => {
                            const timeUntil = getTimeUntilEvent(event.startTime);
                            const isUrgent = timeUntil.includes('m') || timeUntil.includes('hour');
                            const isSoon = timeUntil.includes('day') && !timeUntil.includes('days');
                            
                            return (
                              <div className={cn(
                                "rounded-lg p-2 border-l-4 text-center",
                                isUrgent 
                                  ? "bg-red-100 border-red-400 text-red-800" 
                                  : isSoon
                                  ? "bg-orange-100 border-orange-400 text-orange-800"
                                  : "bg-orange-50 border-orange-300 text-orange-700"
                              )}>
                                <div className="text-base font-bold">
                                  {timeUntil.replace('In ', '')}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      
                      {!isPastEvent && event.all_day && (
                        <div className="flex-shrink-0 w-[10%] min-w-[80px]">
                          <div className="bg-indigo-100 border-l-4 border-indigo-400 rounded-lg p-2 text-center">
                            <div className="text-base font-bold text-indigo-800">
                              All Day
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Event Title */}
                      <div className="flex-1">
                        <div className={cn(
                          "text-lg font-semibold",
                          isPastEvent 
                            ? "text-gray-500 line-through" 
                            : isOngoing && !event.all_day
                            ? "text-red-600 font-bold" 
                            : event.all_day 
                            ? "text-gray-500"
                            : "text-gray-900"
                        )}>
                          {event.title}
                        </div>
                      </div>
                      
                      {/* Date on Right Side */}
                      <div className="flex-shrink-0 text-sm text-gray-600">
                        {formatMinimalDate(convertedEvent.startTime)}
                      </div>
                      
                      <button
                        onClick={() => handleBookmark(event)}
                        className={cn(
                          "p-2 rounded-full transition-colors",
                          isBookmarked 
                            ? "text-blue-500 bg-blue-50 hover:bg-blue-100" 
                            : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                        )}
                        title={isBookmarked ? "Remove bookmark" : "Bookmark event"}
                      >
                        <Bookmark className={cn("w-5 h-5", isBookmarked && "fill-current")} />
                      </button>
                    </div>
                    </div>
                    
                    {/* Free Time Ribbon - Between/After Events */}
                    {freeTime.show && (freeTime.type === 'between' || freeTime.type === 'after-last') && (
                      <div className="mt-3">
                        <div className={cn(
                          "border-l-4 px-3 py-1 rounded-r-md",
                          freeTime.type === 'between' 
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-green-200 border-green-500"
                        )}>
                          <div className={cn(
                            "text-sm font-medium",
                            freeTime.type === 'between' ? "text-green-900" : "text-emerald-700"
                          )}>
                            {freeTime.duration}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky Header: Date Display and Search Bar */}
      <div className="sticky top-0 z-10 bg-white pb-4 space-y-4">
        {/* Selected Date Display */}
        <div className="bg-blue-50 border-l-4 border-blue-400 px-4 py-2 rounded-r-lg">
          <div className="text-sm font-medium text-blue-900">
            📅 {formatDateRangeDisplay(timeFilter, selectedDate)}
          </div>
        </div>

        {/* Search Bar */}
        {events.length > 0 && !loading && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search events, attendees, dates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary Section */}
      {searchFilteredEvents.length > 0 && !loading && (
        <div className="bg-background rounded-lg px-3 py-1.5 border border-border">
          <div className="flex items-center gap-4 text-[10px] text-productivity-text-secondary">
            {/* Total Events */}
            <div className="flex items-center gap-1.5">
              <span className="font-medium">Events:</span>
              <span className="font-bold text-productivity-text-primary">
                {searchFilteredEvents.length}
                {searchQuery && events.length !== searchFilteredEvents.length && (
                  <span className="text-gray-500 ml-0.5">/{events.length}</span>
                )}
              </span>
            </div>

            {/* Meeting Types */}
            {meetingTypes.length > 0 && (
              <div className="flex items-center gap-2">
                {meetingTypes.map((type, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className={cn(
                      "font-medium",
                      type.label === 'External' && "text-orange-500"
                    )}>
                      {type.label.charAt(0)}:
                    </span>
                    <span className={cn(
                      "font-bold",
                      type.label === 'External' ? "text-orange-500" : "text-productivity-text-primary"
                    )}>
                      {type.count}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Time Distribution */}
            {timeDistribution.length > 0 && (
              <div className="flex items-center gap-2">
                {timeDistribution.map((time, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span>{time.label === 'Morning:' ? '🌅' : '🌆'}</span>
                    <span className="font-bold text-productivity-text-primary">
                      {time.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Show/Hide Past Events Toggle and Meeting Type Filter */}
      {searchFilteredEvents.length > 0 && !loading && (
        <div className={cn(
          "mb-4",
          isMobile 
            ? "flex flex-col gap-3" 
            : "flex justify-between items-center"
        )}>
          {/* Meeting Type Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-productivity-text-secondary font-medium whitespace-nowrap">Filter meetings:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setMeetingTypeFilter('all')}
                className={cn(
                  "px-2 md:px-3 py-1 text-xs font-medium rounded-full transition-colors",
                  meetingTypeFilter === 'all'
                    ? "bg-gray-500 text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                )}
              >
                All
              </button>
              <button
                onClick={() => setMeetingTypeFilter('internal')}
                className={cn(
                  "px-2 md:px-3 py-1 text-xs font-medium rounded-full transition-colors",
                  meetingTypeFilter === 'internal'
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                )}
              >
                Internal
              </button>
              <button
                onClick={() => setMeetingTypeFilter('external')}
                className={cn(
                  "px-2 md:px-3 py-1 text-xs font-medium rounded-full transition-colors",
                  meetingTypeFilter === 'external'
                    ? "bg-orange-500 text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                )}
              >
                External
              </button>
            </div>
          </div>
          
          {/* Show Past Events and All Day Toggles */}
          <div className="flex items-center gap-4">
            <label
              className="flex items-center gap-2 text-xs text-productivity-text-secondary cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                setShowPastEvents(!showPastEvents);
              }}
            >
              <input
                type="checkbox"
                checked={showPastEvents}
                onChange={() => {}}
                className="w-3 h-3 text-primary bg-background border-border rounded focus:ring-0 focus:outline-none pointer-events-none"
              />
              Show past events
            </label>
            <label
              className="flex items-center gap-2 text-xs text-productivity-text-secondary cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                setShowAllDayEvents(!showAllDayEvents);
              }}
            >
              <input
                type="checkbox"
                checked={showAllDayEvents}
                onChange={() => {}}
                className="w-3 h-3 text-primary bg-background border-border rounded focus:ring-0 focus:outline-none pointer-events-none"
              />
              All Day
            </label>
          </div>
        </div>
      )}
      
      {/* Table */}
      <div className={cn(
        "rounded-lg overflow-visible",
        !isMobile && "bg-background border border-border"
      )}>
      {/* Table Header - Desktop Only */}
      {!isMobile && (
        <div className="bg-table-header px-3 py-2 border-b border-border">
          <div className="grid grid-cols-12 gap-1 text-xs font-medium text-productivity-text-secondary">
            <div className="col-span-1"></div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Time</div>
            <div className="col-span-3">Event</div>
            <div className="col-span-1">Dur</div>
            <div className="col-span-2">Attendees</div>
            <div className="col-span-1"></div>
          </div>
        </div>
      )}
      
      {/* Events List */}
      <div className={cn(
        !isMobile && "divide-y divide-border"
      )}>
        {loading ? (
          <div className="px-4 py-8 text-center text-productivity-text-tertiary">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              Loading events...
            </div>
          </div>
        ) : searchFilteredEvents.length === 0 ? (
          <div className="px-4 py-8 text-center text-productivity-text-tertiary">
            {searchQuery ? `No events found matching "${searchQuery}"` : "No events found for the selected time period."}
          </div>
        ) : (
          (() => {
            const filteredEvents = searchFilteredEvents.filter(event => {
              const eventEndTime = new Date(event.startTime.getTime() + event.duration * 60 * 1000);
              const isPastEvent = eventEndTime.getTime() < new Date().getTime();
              const pastEventFilter = showPastEvents || !isPastEvent;
              const allDayFilter = showAllDayEvents || !event.all_day;

              // Apply meeting type filter
              let meetingTypeFilterMatch = true;
              if (meetingTypeFilter === 'internal') {
                meetingTypeFilterMatch = !isExternalMeeting(event.attendees);
              } else if (meetingTypeFilter === 'external') {
                meetingTypeFilterMatch = isExternalMeeting(event.attendees);
              }

              return pastEventFilter && allDayFilter && meetingTypeFilterMatch;
            });
            
            // Filter out all-day events for free time calculation
            const timedEvents = filteredEvents.filter(e => !e.all_day);
            
            // Group events by day
            const eventsByDay = new Map<string, CalendarEvent[]>();
            timedEvents.forEach(event => {
              const convertedStart = convertTime(event.startTime);
              const dayKey = getDayKey(convertedStart);
              if (!eventsByDay.has(dayKey)) {
                eventsByDay.set(dayKey, []);
              }
              eventsByDay.get(dayKey)!.push(event);
            });
            
            // Sort events within each day
            eventsByDay.forEach(dayEvents => {
              dayEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
            });
            
            return filteredEvents.map((event, index) => {
              // Convert event time to selected timezone for display
              const convertedEvent = {
                ...event,
                startTime: convertTime(event.startTime)
              };
              
              const urgencyLevel = getUrgencyLevel(event.startTime);
              const isEven = index % 2 === 0;
              const eventEndTime = new Date(event.startTime.getTime() + event.duration * 60 * 1000);
              const now = new Date();
              const isPastEvent = eventEndTime.getTime() < now.getTime(); // Check end time to include ongoing events
              const isOngoing = event.startTime.getTime() <= now.getTime() && eventEndTime.getTime() > now.getTime();
              const isTooltipPinned = pinnedTooltip === event.id;
              
              // Find the next immediate event (first future event in the sorted list)
              const futureEvents = searchFilteredEvents.filter(e => e.startTime.getTime() > new Date().getTime());
              const nextEvent = futureEvents.length > 0 ? futureEvents[0] : null;
              const isNextEvent = nextEvent && event.id === nextEvent.id;
              
              // Check if this event is bookmarked
              const isBookmarked = bookmarkedEventTitles.includes(event.title);
              
              // Check if this is the last event of the day (next event is on a different day)
              // Use the filtered array for proper index comparison
              const currentDate = formatMinimalDate(convertedEvent.startTime);
              const nextEventDate = index < filteredEvents.length - 1 ? formatMinimalDate(convertTime(filteredEvents[index + 1].startTime)) : null;
              const isLastOfDay = nextEventDate && currentDate !== nextEventDate;
              
              // Calculate free time for timed events only (refreshes with refreshTrigger)
              let beforeFirstFreeTime: FreeTimeBlock = { duration: '', show: false, type: 'before-first' };
              let freeTime: FreeTimeBlock = { duration: '', show: false, type: 'between' };
              
              if (!event.all_day) {
                const dayKey = getDayKey(convertedEvent.startTime);
                const dayEvents = eventsByDay.get(dayKey) || [];
                const eventIndexInDay = dayEvents.findIndex(e => e.id === event.id);
                
                if (eventIndexInDay !== -1) {
                  const isFirstOfDay = eventIndexInDay === 0;
                  const isLastOfDay = eventIndexInDay === dayEvents.length - 1;
                  const nextEventInDay = !isLastOfDay ? dayEvents[eventIndexInDay + 1] : null;
                  
                  // Check for free time before first event
                  if (isFirstOfDay) {
                    beforeFirstFreeTime = calculateBeforeFirstFreeTime(event, convertTime, loggedFreeTimeRef.current);
                  }
                  
                  // Check for free time after event
                  freeTime = calculateFreeTime(event, nextEventInDay, isLastOfDay, convertTime, loggedFreeTimeRef.current);
                }
              }
              // eslint-disable-next-line react-hooks/exhaustive-deps
              void refreshTrigger; // Force re-render every minute to update remaining time
            
            return (
              <div key={event.id}>
                {/* Free Time Ribbon - Before First Event (Desktop) */}
                {beforeFirstFreeTime.show && !isMobile && (
                  <div className="px-3 py-1 bg-emerald-50 border-l-4 border-emerald-300">
                    <div className="text-xs font-medium text-emerald-700">
                      {beforeFirstFreeTime.duration}
                    </div>
                  </div>
                )}
                
                
                {isMobile ? (
                  <div>
                    {/* Free Time Ribbon - Before First Event (Mobile) */}
                    {beforeFirstFreeTime.show && (
                      <div className="mb-3">
                        <div className="bg-emerald-50 border-l-4 border-emerald-300 px-3 py-1 rounded-r-md">
                          <div className="text-xs font-medium text-emerald-700">
                            {beforeFirstFreeTime.duration}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Mobile Card Layout */}
                    <div
                    className={cn(
                      "p-3 mb-3 rounded-lg border transition-all duration-200",
                      isBookmarked 
                        ? "bg-red-50 border-red-200"
                        : isEven ? "bg-productivity-surface" : "bg-table-row-even",
                      isPastEvent && "opacity-60",
                      event.all_day && !isBookmarked && "bg-indigo-50 border-l-4 border-indigo-300",
                      isNextEvent && "ring-2 ring-red-200 border-red-300",
                      isOngoing && !event.all_day && "ongoing-event"
                    )}
                  >
                    {/* Mobile Header Row */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className={cn(
                            "w-3 h-3 rounded-full flex-shrink-0",
                            isPastEvent ? "bg-gray-400" : event.all_day ? "bg-indigo-400" : getUrgencyColor(urgencyLevel)
                          )}
                        />
                        <div className="text-xs text-productivity-text-secondary">
                          {formatMinimalDate(convertedEvent.startTime)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleBookmark(event)}
                        className={cn(
                          "p-1 transition-colors",
                          isBookmarked 
                            ? "text-blue-500 hover:text-blue-600" 
                            : "text-productivity-text-tertiary hover:text-blue-500"
                        )}
                      >
                        <Bookmark className={cn("w-4 h-4", isBookmarked && "fill-current")} />
                      </button>
                    </div>

                    {/* Mobile Event Title */}
                    <div className="mb-2">
                      <div className={cn(
                        "text-sm font-medium break-words leading-tight flex items-center gap-2",
                        isPastEvent && "line-through",
                        isNextEvent && "font-bold text-red-600",
                        isOngoing && !isNextEvent && !event.all_day && "font-bold text-red-600"
                      )}>
                        <span className={cn(
                          "text-productivity-text-primary",
                          isOngoing && !event.all_day && "text-red-600",
                          event.all_day && "text-gray-500"
                        )}>
                          {event.title}
                        </span>
                        {isExternalMeeting(event.attendees) && (
                          <span className="text-orange-500 text-xs font-medium px-1 py-0.5 bg-orange-100 rounded">
                            EXT
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mobile Time and Duration Row */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "font-mono font-medium",
                          isNextEvent && "text-red-500",
                          !isNextEvent && getIntervalColor(getTimeUntilEvent(event.startTime))
                        )}>
                          {event.all_day ? "All Day" : getTimeUntilEvent(event.startTime)}
                        </div>
                        {!event.all_day && (
                          <div className="text-productivity-text-tertiary">
                            {formatDateTime(convertedEvent.startTime).split(' (')[1]?.replace(')', '') || formatDateTime(convertedEvent.startTime)}
                          </div>
                        )}
                      </div>
                      <div className="text-productivity-text-secondary">
                        {formatDuration(event.duration)}
                      </div>
                    </div>

                    {/* Mobile Attendees Row */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex flex-wrap gap-1">
                        {event.attendees.filter(isHumanAttendee).slice(0, 8).map((attendee, idx) => {
                          const isOrganizer = attendee === event.organizerEmail;
                          const chipId = `${event.id}-${idx}`;
                          const isClicked = clickedChip === chipId;
                          
                          return (
                            <div key={idx} className="relative">
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium text-white cursor-pointer hover:scale-110 transition-transform",
                                  isOrganizer ? "bg-blue-500" : "bg-gray-400",
                                  isPastEvent && "opacity-60"
                                )}
                                onClick={() => setClickedChip(isClicked ? null : chipId)}
                              >
                                {getInitials(attendee)}
                              </div>
                              {isClicked && (
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs p-1 rounded shadow-lg whitespace-nowrap z-[9999]">
                                  {attendee}{isOrganizer && " (Org)"}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {event.attendees.filter(isHumanAttendee).length > 8 && (
                          <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[9px] font-medium text-gray-700">
                            +{event.attendees.filter(isHumanAttendee).length - 8}
                          </div>
                        )}
                      </div>
                      
                      {event.notes && (
                        <div className="relative group">
                          <button
                            onClick={() => handleTooltipClick(event.id)}
                            className="p-1 text-productivity-text-tertiary hover:text-productivity-text-primary transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          
                          {/* Mobile Notes Tooltip */}
                          <div
                            className={cn(
                              "absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded shadow-lg w-64 z-50 transition-opacity duration-200 max-h-32 overflow-y-auto",
                              isTooltipPinned ? "opacity-100 visible" : "opacity-0 invisible group-hover:opacity-100 group-hover:visible"
                            )}
                          >
                            <div 
                              dangerouslySetInnerHTML={{ __html: event.notes || 'No notes available' }}
                              className="prose prose-invert prose-xs max-w-none"
                            />
                            {isTooltipPinned && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPinnedTooltip(null);
                                }}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    </div>
                    
                    {/* Free Time Ribbon - Between/After Events (Mobile) */}
                    {freeTime.show && (freeTime.type === 'between' || freeTime.type === 'after-last') && (
                      <div className="mt-3">
                        <div className={cn(
                          "border-l-4 px-3 py-1 rounded-r-md",
                          freeTime.type === 'between' 
                            ? "bg-green-200 border-green-500"
                            : "bg-emerald-50 border-emerald-300"
                        )}>
                          <div className={cn(
                            "text-xs font-medium",
                            freeTime.type === 'between' ? "text-green-900" : "text-emerald-700"
                          )}>
                            {freeTime.duration}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Desktop Table Layout
                  <div
                    className={cn(
                      "px-3 py-2 hover:bg-table-row-hover transition-all duration-200",
                      isBookmarked 
                        ? "bg-red-50 hover:bg-red-100"
                        : isEven ? "bg-productivity-surface" : "bg-table-row-even",
                      isPastEvent && "opacity-60",
                      event.all_day && !isBookmarked && "bg-indigo-50 border-l-4 border-indigo-300",
                      isOngoing && !event.all_day && "ongoing-event"
                    )}
                  >
                  <div className="grid grid-cols-12 gap-1 items-center">
                  {/* Bookmark */}
                  <div className="col-span-1 flex items-center justify-center">
                    <button
                      onClick={() => handleBookmark(event)}
                      className={cn(
                        "p-1 transition-colors",
                        isBookmarked 
                          ? "text-blue-500 hover:text-blue-600" 
                          : "text-productivity-text-tertiary hover:text-blue-500"
                      )}
                      title={isBookmarked ? `Remove "${event.title}" from bookmarks` : `Bookmark "${event.title}"`}
                    >
                      <Bookmark className={cn("w-3 h-3", isBookmarked && "fill-current")} />
                    </button>
                  </div>
                  
                  {/* Date and Time */}
                  <div className="col-span-2">
                    <div className="space-y-1">
                      <span className={cn(
                        "text-productivity-text-secondary text-xs block",
                        isPastEvent && "line-through",
                        isNextEvent && "font-bold"
                      )}>
                        {formatMinimalDate(convertedEvent.startTime)}
                      </span>
                      {!event.all_day && (
                        <div className="text-[10px] text-productivity-text-tertiary">
                          {formatDateTime(convertedEvent.startTime).split(' (')[1]?.replace(')', '') || formatDateTime(convertedEvent.startTime)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Time (Urgency and Countdown) */}
                  <div className="col-span-2 flex items-center gap-2">
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        isPastEvent ? "bg-gray-400" : event.all_day ? "bg-indigo-400" : getUrgencyColor(urgencyLevel)
                      )}
                      title={isPastEvent ? "Past event" : event.all_day ? "All-day event" : `Urgency: ${urgencyLevel}`}
                    />
                    <div className={cn(
                      "text-productivity-text-secondary text-xs",
                      isPastEvent && "line-through",
                      isNextEvent && "font-bold",
                      event.all_day && "text-indigo-600"
                    )}>
                      {event.all_day ? (
                        <div className="font-medium">All Day</div>
                      ) : (
                        <div className={cn(
                          "font-mono",
                          isNextEvent && "text-red-500",
                          !isNextEvent && getIntervalColor(getTimeUntilEvent(event.startTime))
                        )}>
                          {getTimeUntilEvent(event.startTime)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Event Title */}
                  <div className="col-span-3 flex items-center gap-1">
                    <span className={cn(
                      "text-productivity-text-primary text-xs break-words leading-tight",
                      isPastEvent && "line-through",
                      isNextEvent && "font-bold",
                      isOngoing && !isNextEvent && !event.all_day && "font-bold text-red-600",
                      event.all_day && "text-gray-500"
                    )}>
                      {event.title}
                    </span>
                    {isExternalMeeting(event.attendees) && (
                      <span 
                        className="text-orange-500 text-[10px] font-medium"
                        title="External meeting"
                      >
                        EXT
                      </span>
                    )}
                  </div>
                  
                  {/* Duration */}
                  <div className="col-span-1">
                    <span className={cn(
                      "text-productivity-text-secondary font-mono text-[10px]",
                      isPastEvent && "line-through",
                      isNextEvent && "font-bold"
                    )}>
                      {formatDuration(event.duration)}
                    </span>
                  </div>
                  
                  {/* Attendees */}
                  <div className="col-span-2">
                    <div className="flex flex-wrap gap-1">
                      {event.attendees.filter(isHumanAttendee).slice(0, 5).map((attendee, idx) => {
                        const isOrganizer = attendee === event.organizerEmail;
                        const chipId = `${event.id}-${idx}`;
                        const isClicked = clickedChip === chipId;
                        
                        return (
                          <div key={idx} className="relative">
                            <div
                              className={cn(
                                "w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-medium text-white cursor-pointer hover:scale-110 transition-transform",
                                isOrganizer ? "bg-blue-500" : "bg-gray-400",
                                isPastEvent && "opacity-60"
                              )}
                              onClick={() => setClickedChip(isClicked ? null : chipId)}
                            >
                              {getInitials(attendee)}
                            </div>
                            {isClicked && (
                              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs p-2 rounded shadow-lg whitespace-nowrap z-[9999]">
                                {attendee}{isOrganizer && " (Organizer)"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {event.attendees.filter(isHumanAttendee).length > 5 && (
                        <div 
                          className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[8px] font-medium text-gray-700 cursor-pointer hover:scale-110 transition-transform"
                          title={`+${event.attendees.filter(isHumanAttendee).length - 5} more: ${event.attendees.filter(isHumanAttendee).slice(5).join(', ')}`}
                        >
                          +{event.attendees.filter(isHumanAttendee).length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Notes Tooltip */}
                  <div className="col-span-1 flex items-center justify-center">
                    {event.notes && (
                      <div className="relative group">
                        <button
                          onClick={() => handleTooltipClick(event.id)}
                          className="p-1 text-productivity-text-tertiary hover:text-productivity-text-primary transition-colors"
                          title="Show notes"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                        
                        {/* Tooltip */}
                        <div
                          className={cn(
                            "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-gray-800 text-white text-xs rounded shadow-lg w-72 z-50 transition-opacity duration-200 max-h-40 overflow-y-auto",
                            isTooltipPinned ? "opacity-100 visible" : "opacity-0 invisible group-hover:opacity-100 group-hover:visible"
                          )}
                        >
                          <div 
                            dangerouslySetInnerHTML={{ __html: event.notes || 'No notes available' }}
                            className="prose prose-invert prose-xs max-w-none"
                          />
                          {isTooltipPinned && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPinnedTooltip(null);
                              }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                              title="Close"
                            >
                              ×
                            </button>
                          )}
                          {/* Tooltip arrow */}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>
                  </div>
                )}
                
                {/* Free Time Ribbon - Between/After Events (Desktop) */}
                {freeTime.show && (freeTime.type === 'between' || freeTime.type === 'after-last') && !isMobile && (
                  <div className={cn(
                    "px-3 py-1 border-l-4",
                    freeTime.type === 'between' 
                      ? "bg-green-200 border-green-500"
                      : "bg-emerald-50 border-emerald-300"
                  )}>
                    <div className={cn(
                      "text-xs font-medium",
                      freeTime.type === 'between' ? "text-green-900" : "text-emerald-700"
                    )}>
                      {freeTime.duration}
                    </div>
                  </div>
                )}
                
                {isLastOfDay && !isMobile && (
                  <div className="h-px bg-black w-full"></div>
                )}
              </div>
            );
            });
          })()
        )}
      </div>
    </div>
    </div>
  );
};