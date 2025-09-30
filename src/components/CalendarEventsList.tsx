import { CalendarEvent, TimeFilter } from '../types/calendar';
import { formatDateTime, getTimeUntilEvent, formatDuration, getUrgencyLevel, getUrgencyColor, getIntervalColor } from '../utils/dateUtils';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { Bookmark, FileText } from 'lucide-react';
import { bookmarkApiService } from '../services/bookmarkApi';
import { CreateBookmarkRequest } from '../types/bookmark';
import { useTimezone } from '../contexts/TimezoneContext';
import { useSimpleView } from '../contexts/SimpleViewContext';
import { useIsMobile } from '../hooks/use-mobile';

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

const getFreeBlocks = (events: CalendarEvent[], timeFilter: TimeFilter, selectedDate?: string) => {
  if (events.length === 0) return [];
  
  // Only calculate free blocks for single-day views
  const singleDayFilters = ['today', 'tomorrow', 'day-after', '2-days-after'];
  const isSingleDay = singleDayFilters.includes(timeFilter) || selectedDate;
  
  if (!isSingleDay) return [];
  
  // Filter out all-day events as they don't block specific time slots
  const timedEvents = events.filter(event => !event.all_day);
  
  if (timedEvents.length === 0) return [];
  
  const sortedEvents = [...timedEvents].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const freeBlocksMap = new Map();
  
  // Check gap from 6:30 AM to first meeting
  if (sortedEvents.length > 0) {
    const firstEvent = sortedEvents[0];
    const startOf630am = new Date(firstEvent.startTime);
    startOf630am.setHours(6, 30, 0, 0); // 6:30 AM
    
    // Only consider if first meeting starts after 6:30 AM
    if (firstEvent.startTime.getTime() > startOf630am.getTime()) {
      const gapMinutes = Math.floor((firstEvent.startTime.getTime() - startOf630am.getTime()) / (1000 * 60));
      
      if (gapMinutes >= 30) { // Only show gaps of 30+ minutes
        const time = startOf630am.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const key = time; // Group by time across days
        
        if (freeBlocksMap.has(key)) {
          freeBlocksMap.set(key, freeBlocksMap.get(key) + gapMinutes);
        } else {
          freeBlocksMap.set(key, gapMinutes);
        }
      }
    }
  }
  
  // Check gaps between consecutive meetings
  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const currentEnd = new Date(sortedEvents[i].startTime.getTime() + sortedEvents[i].duration * 60 * 1000);
    const nextStart = sortedEvents[i + 1].startTime;
    
    // Only consider gaps that end before or at 7pm
    const endOf7pm = new Date(currentEnd);
    endOf7pm.setHours(19, 0, 0, 0); // 7:00 PM
    
    if (currentEnd.getTime() >= endOf7pm.getTime()) {
      continue; // Skip gaps that start after 7pm
    }
    
    // Calculate gap, but cap it at 7pm if it extends beyond
    let gapEndTime = nextStart;
    if (nextStart.getTime() > endOf7pm.getTime()) {
      gapEndTime = endOf7pm;
    }
    
    const gapMinutes = Math.floor((gapEndTime.getTime() - currentEnd.getTime()) / (1000 * 60));
    
    if (gapMinutes >= 30) { // Only show gaps of 30+ minutes
      const time = currentEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const key = time; // Group by time across days
      
      if (freeBlocksMap.has(key)) {
        freeBlocksMap.set(key, freeBlocksMap.get(key) + gapMinutes);
      } else {
        freeBlocksMap.set(key, gapMinutes);
      }
    }
  }
  
  // Check gap from last meeting to 7pm
  if (sortedEvents.length > 0) {
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    const lastEventEnd = new Date(lastEvent.startTime.getTime() + lastEvent.duration * 60 * 1000);
    const endOf7pm = new Date(lastEventEnd);
    endOf7pm.setHours(19, 0, 0, 0); // 7:00 PM
    
    // Only consider if last meeting ends before 7pm
    if (lastEventEnd.getTime() < endOf7pm.getTime()) {
      const gapMinutes = Math.floor((endOf7pm.getTime() - lastEventEnd.getTime()) / (1000 * 60));
      
      if (gapMinutes >= 30) { // Only show gaps of 30+ minutes
        const time = lastEventEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const key = time; // Group by time across days
        
        if (freeBlocksMap.has(key)) {
          freeBlocksMap.set(key, freeBlocksMap.get(key) + gapMinutes);
        } else {
          freeBlocksMap.set(key, gapMinutes);
        }
      }
    }
  }
  
  // Convert map to array and format
  return Array.from(freeBlocksMap.entries())
    .map(([time, totalMinutes]) => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const duration = hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}` : `${minutes}min`;
      return { duration, time };
    })
    .slice(0, 4); // Limit to 4 blocks
};

export const CalendarEventsList = ({ events, timeFilter, loading = false, onBookmarkCreated, selectedDate, bookmarkedEventTitles = [] }: CalendarEventsListProps) => {
  const [clickedChip, setClickedChip] = useState<string | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [pinnedTooltip, setPinnedTooltip] = useState<string | null>(null);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const { convertTime } = useTimezone();
  const { isSimpleView } = useSimpleView();
  const isMobile = useIsMobile();

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
  
  // Calculate summary data with timezone conversion
  const eventsWithConvertedTimes = events.map(event => ({
    ...event,
    startTime: convertTime(event.startTime)
  }));
  
  const meetingTypes = getMeetingTypes(events);
  const timeDistribution = getTimeDistribution(eventsWithConvertedTimes);
  const freeBlocks = getFreeBlocks(eventsWithConvertedTimes, timeFilter, selectedDate);
  
  // Simple View - Show only essential information
  if (isSimpleView) {
    return (
      <div className="space-y-4">
        {/* Simple View - Free Times Only */}
        {events.length > 0 && !loading && freeBlocks.length > 0 && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-3">Free Time</h3>
            <div className="space-y-2">
              {freeBlocks.map((block, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-100">
                  <div className="text-base font-medium text-green-800">
                    {block.duration} free
                  </div>
                  <div className="text-sm text-green-600">
                    at {block.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simple View - Events List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-lg text-gray-500">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-lg text-gray-500">
              No events found
            </div>
          ) : (
            (() => {
              const filteredEvents = events.filter(event => {
                const isPastEvent = event.startTime.getTime() < new Date().getTime();
                return showPastEvents || !isPastEvent;
              });
              
              return filteredEvents.map((event, index) => {
                const convertedEvent = {
                  ...event,
                  startTime: convertTime(event.startTime)
                };
                
                const isPastEvent = event.startTime.getTime() < new Date().getTime();
                const isBookmarked = bookmarkedEventTitles.includes(event.title);
                
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "bg-white rounded-lg p-4 border-2 transition-all duration-200",
                      isPastEvent 
                        ? "border-gray-200 bg-gray-50" 
                        : "border-blue-200 hover:border-blue-300 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className={cn(
                          "text-lg font-semibold mb-1",
                          isPastEvent ? "text-gray-500 line-through" : "text-gray-900"
                        )}>
                          {event.title}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {formatMinimalDate(convertedEvent.startTime)}
                        </div>
                        <div className={cn(
                          "text-base font-medium",
                          isPastEvent ? "text-gray-400" : "text-blue-600"
                        )}>
                          {event.all_day ? "All Day" : getTimeUntilEvent(event.startTime)}
                        </div>
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
      {/* Summary Section */}
      {events.length > 0 && !loading && (
        <div className="bg-background rounded-lg p-3 md:p-4 border border-border">
          <div className={cn(
            "gap-4 md:gap-6 text-xs",
            isMobile 
              ? "grid grid-cols-2 sm:grid-cols-4" 
              : "grid"
          )} style={!isMobile ? { gridTemplateColumns: '1fr 0.8fr 1fr 1.2fr' } : undefined}>
            {/* Total Events */}
            <div>
              <div className="text-productivity-text-secondary font-medium mb-2">Events</div>
              <div className="text-2xl font-bold text-productivity-text-primary">{events.length}</div>
            </div>
            
            {/* Meeting Types */}
            <div>
              <div className="text-productivity-text-secondary font-medium mb-2">Meetings</div>
              <div className="space-y-1">
                {meetingTypes.map((type, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-productivity-text-tertiary rounded-full"></span>
                    <span className={cn(
                      "text-productivity-text-primary",
                      type.label === 'External' && "text-orange-500"
                    )}>
                      {type.label} {type.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Time Distribution */}
            <div>
              <div className="text-productivity-text-secondary font-medium mb-2">Time of Day</div>
              <div className="space-y-1">
                {timeDistribution.map((time, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-sm">
                      {time.label === 'Morning:' ? '🌅' : '🌆'}
                    </span>
                    <span className="text-productivity-text-primary">
                      {time.label} {time.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Free Blocks */}
            <div>
              <div className="text-productivity-text-secondary font-medium mb-2">Free</div>
              <div className="space-y-1">
                {freeBlocks.length === 0 ? (
                  <span className="text-productivity-text-tertiary">-</span>
                ) : (
                  freeBlocks.map((block, idx) => {
                    // Check if duration is >= 1 hour
                    const durationParts = block.duration.split('h');
                    const hasHour = durationParts.length > 1;
                    const hours = hasHour ? parseInt(durationParts[0]) : 0;
                    const isLongBlock = hours >= 1;
                    
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="w-1 h-1 bg-productivity-text-tertiary rounded-full"></span>
                        <span className={cn(
                          "text-productivity-text-primary",
                          isLongBlock && "text-green-600 font-medium"
                        )}>
                          {block.duration} at {block.time}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Show/Hide Past Events Toggle and Meeting Type Filter */}
      {events.length > 0 && !loading && (
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
          
          {/* Show Past Events Toggle */}
          <label className="flex items-center gap-2 text-xs text-productivity-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showPastEvents}
              onChange={(e) => setShowPastEvents(e.target.checked)}
              className="w-3 h-3 text-primary bg-background border-border rounded focus:ring-primary focus:ring-1"
            />
            Show past events
          </label>
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
        ) : events.length === 0 ? (
          <div className="px-4 py-8 text-center text-productivity-text-tertiary">
            No events found for the selected time period.
          </div>
        ) : (
          (() => {
            const filteredEvents = events.filter(event => {
              const isPastEvent = event.startTime.getTime() < new Date().getTime();
              const pastEventFilter = showPastEvents || !isPastEvent;
              
              // Apply meeting type filter
              let meetingTypeFilterMatch = true;
              if (meetingTypeFilter === 'internal') {
                meetingTypeFilterMatch = !isExternalMeeting(event.attendees);
              } else if (meetingTypeFilter === 'external') {
                meetingTypeFilterMatch = isExternalMeeting(event.attendees);
              }
              
              return pastEventFilter && meetingTypeFilterMatch;
            });
            
            return filteredEvents.map((event, index) => {
              // Convert event time to selected timezone for display
              const convertedEvent = {
                ...event,
                startTime: convertTime(event.startTime)
              };
              
              const urgencyLevel = getUrgencyLevel(event.startTime);
              const isEven = index % 2 === 0;
              const isPastEvent = event.startTime.getTime() < new Date().getTime(); // Use original time for past check
              const isTooltipPinned = pinnedTooltip === event.id;
              
              // Find the next immediate event (first future event in the sorted list)
              const futureEvents = events.filter(e => e.startTime.getTime() > new Date().getTime());
              const nextEvent = futureEvents.length > 0 ? futureEvents[0] : null;
              const isNextEvent = nextEvent && event.id === nextEvent.id;
              
              // Check if this event is bookmarked
              const isBookmarked = bookmarkedEventTitles.includes(event.title);
              
              // Check if this is the last event of the day (next event is on a different day)
              // Use the filtered array for proper index comparison
              const currentDate = formatMinimalDate(convertedEvent.startTime);
              const nextEventDate = index < filteredEvents.length - 1 ? formatMinimalDate(convertTime(filteredEvents[index + 1].startTime)) : null;
              const isLastOfDay = nextEventDate && currentDate !== nextEventDate;
            
            // Debug logging
            if (index === 0) {
              console.log('Events dates:', events.map(e => formatMinimalDate(e.startTime)));
            }
            if (isLastOfDay) {
              console.log(`Day separator after: ${currentDate} -> ${nextEventDate}`);
            }
            
            return (
              <div key={event.id}>
                {isMobile ? (
                  // Mobile Card Layout
                  <div
                    className={cn(
                      "p-3 mb-3 rounded-lg border transition-all duration-200",
                      isEven ? "bg-productivity-surface" : "bg-table-row-even",
                      isPastEvent && "opacity-60",
                      event.all_day && "bg-indigo-50 border-l-4 border-indigo-300",
                      isNextEvent && "ring-2 ring-red-200 border-red-300"
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
                        isNextEvent && "font-bold text-red-600"
                      )}>
                        <span className="text-productivity-text-primary">
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
                ) : (
                  // Desktop Table Layout
                  <div
                    className={cn(
                      "px-3 py-2 hover:bg-table-row-hover transition-all duration-200",
                      isEven ? "bg-productivity-surface" : "bg-table-row-even",
                      isPastEvent && "opacity-60",
                      event.all_day && "bg-indigo-50 border-l-4 border-indigo-300"
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
                      isNextEvent && "font-bold"
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