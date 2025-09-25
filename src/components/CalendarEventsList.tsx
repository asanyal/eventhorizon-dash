import { CalendarEvent, TimeFilter } from '../types/calendar';
import { formatDateTime, getTimeUntilEvent, formatDuration, getUrgencyLevel, getUrgencyColor } from '../utils/dateUtils';
import { cn } from '../lib/utils';
import { useState } from 'react';

interface CalendarEventsListProps {
  events: CalendarEvent[];
  timeFilter: TimeFilter;
  loading?: boolean;
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
  const total = events.length;
  
  return [
    { label: 'Internal', percentage: total > 0 ? (internal / total * 100).toFixed(1) : '0' },
    { label: 'External', percentage: total > 0 ? (external / total * 100).toFixed(1) : '0' }
  ].filter((type, idx) => (idx === 0 ? internal : external) > 0);
};

const getTimeDistribution = (events: CalendarEvent[]) => {
  const morning = events.filter(e => e.startTime.getHours() < 12).length;
  const afternoon = events.filter(e => e.startTime.getHours() >= 12).length;
  const total = events.length;
  
  return [
    { label: 'Morning', percentage: total > 0 ? (morning / total * 100).toFixed(1) : '0' },
    { label: 'Afternoon', percentage: total > 0 ? (afternoon / total * 100).toFixed(1) : '0' }
  ].filter((time, idx) => (idx === 0 ? morning : afternoon) > 0);
};

const getFreeBlocks = (events: CalendarEvent[]) => {
  if (events.length === 0) return [];
  
  const sortedEvents = [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
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
    
    // Only consider gaps that end before or at 5pm
    const endOf5pm = new Date(currentEnd);
    endOf5pm.setHours(17, 0, 0, 0); // 5:00 PM
    
    if (currentEnd.getTime() >= endOf5pm.getTime()) {
      continue; // Skip gaps that start after 5pm
    }
    
    // Calculate gap, but cap it at 5pm if it extends beyond
    let gapEndTime = nextStart;
    if (nextStart.getTime() > endOf5pm.getTime()) {
      gapEndTime = endOf5pm;
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
  
  // Check gap from last meeting to 5pm
  if (sortedEvents.length > 0) {
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    const lastEventEnd = new Date(lastEvent.startTime.getTime() + lastEvent.duration * 60 * 1000);
    const endOf5pm = new Date(lastEventEnd);
    endOf5pm.setHours(17, 0, 0, 0); // 5:00 PM
    
    // Only consider if last meeting ends before 5pm
    if (lastEventEnd.getTime() < endOf5pm.getTime()) {
      const gapMinutes = Math.floor((endOf5pm.getTime() - lastEventEnd.getTime()) / (1000 * 60));
      
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

export const CalendarEventsList = ({ events, timeFilter, loading = false }: CalendarEventsListProps) => {
  const [clickedChip, setClickedChip] = useState<string | null>(null);
  
  // Calculate summary data
  const meetingTypes = getMeetingTypes(events);
  const timeDistribution = getTimeDistribution(events);
  const freeBlocks = getFreeBlocks(events);
  
  return (
    <div className="space-y-4 max-w-2xl">
      {/* Summary Section */}
      {events.length > 0 && !loading && (
        <div className="bg-productivity-surface rounded-lg p-4 border border-border">
          <div className="grid grid-cols-4 gap-6 text-xs">
            {/* Total Events */}
            <div>
              <div className="text-productivity-text-secondary font-medium mb-2">Total Events</div>
              <div className="text-2xl font-bold text-productivity-text-primary">{events.length}</div>
            </div>
            
            {/* Meeting Types */}
            <div>
              <div className="text-productivity-text-secondary font-medium mb-2">Meeting Types</div>
              <div className="space-y-1">
                {meetingTypes.map((type, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-productivity-text-tertiary rounded-full"></span>
                    <span className={cn(
                      "text-productivity-text-primary",
                      type.label === 'External' && "text-orange-500"
                    )}>
                      {type.label} {type.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Time Distribution */}
            <div>
              <div className="text-productivity-text-secondary font-medium mb-2">Time Distribution</div>
              <div className="space-y-1">
                {timeDistribution.map((time, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-sm">
                      {time.label === 'Morning' ? '🌅' : '🌆'}
                    </span>
                    <span className="text-productivity-text-primary">
                      {time.label} {time.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Free Blocks */}
            <div>
              <div className="text-productivity-text-secondary font-medium mb-2">Free Blocks</div>
              <div className="space-y-1">
                {freeBlocks.length === 0 ? (
                  <span className="text-productivity-text-tertiary">None found</span>
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
      
      {/* Table */}
      <div className="bg-productivity-surface rounded-lg shadow-md overflow-visible">
      {/* Table Header */}
      <div className="bg-table-header px-3 py-2 border-b border-border">
        <div className="grid grid-cols-10 gap-1 text-xs font-medium text-productivity-text-secondary">
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Time</div>
          <div className="col-span-3">Event</div>
          <div className="col-span-1">Dur</div>
          <div className="col-span-2">Attendees</div>
        </div>
      </div>
      
      {/* Events List */}
      <div className="divide-y divide-border">
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
          events.map((event, index) => {
            const urgencyLevel = getUrgencyLevel(event.startTime);
            const isEven = index % 2 === 0;
            const isPastEvent = event.startTime.getTime() < new Date().getTime();
            
            // Find the next immediate event (first future event in the sorted list)
            const futureEvents = events.filter(e => e.startTime.getTime() > new Date().getTime());
            const nextEvent = futureEvents.length > 0 ? futureEvents[0] : null;
            const isNextEvent = nextEvent && event.id === nextEvent.id;
            
            // Check if this is the last event of the day (next event is on a different day)
            const currentDate = formatMinimalDate(event.startTime);
            const nextEventDate = index < events.length - 1 ? formatMinimalDate(events[index + 1].startTime) : null;
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
                <div
                  className={cn(
                    "px-3 py-2 hover:bg-table-row-hover transition-all duration-200",
                    isEven ? "bg-productivity-surface" : "bg-table-row-even",
                    isPastEvent && "opacity-60"
                  )}
                >
                <div className="grid grid-cols-10 gap-1 items-center">
                  {/* Date */}
                  <div className="col-span-2">
                    <span className={cn(
                      "text-productivity-text-secondary text-xs",
                      isPastEvent && "line-through",
                      isNextEvent && "font-bold"
                    )}>
                      {formatMinimalDate(event.startTime)}
                    </span>
                  </div>
                  
                  {/* Time */}
                  <div className="col-span-2 flex items-center gap-2">
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        isPastEvent ? "bg-gray-400" : getUrgencyColor(urgencyLevel)
                      )}
                      title={isPastEvent ? "Past event" : `Urgency: ${urgencyLevel}`}
                    />
                    <div className={cn(
                      "text-productivity-text-secondary text-xs",
                      isPastEvent && "line-through",
                      isNextEvent && "font-bold"
                    )}>
                      <div className={cn(
                        "font-mono",
                        isNextEvent && "text-red-500"
                      )}>
                        {getTimeUntilEvent(event.startTime)}
                      </div>
                      <div className="text-[10px] text-productivity-text-tertiary">
                        {formatDateTime(event.startTime).split(' (')[1]?.replace(')', '') || formatDateTime(event.startTime)}
                      </div>
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
                </div>
                </div>
                {isLastOfDay && (
                  <div className="h-px bg-black w-full"></div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
    </div>
  );
};