import { CalendarEvent, TimeFilter } from '../types/calendar';
import { formatDateTime, getTimeUntilEvent, formatDuration, getUrgencyLevel, getUrgencyColor } from '../utils/dateUtils';
import { cn } from '../lib/utils';

interface CalendarEventsListProps {
  events: CalendarEvent[];
  timeFilter: TimeFilter;
}

export const CalendarEventsList = ({ events, timeFilter }: CalendarEventsListProps) => {
  return (
    <div className="bg-productivity-surface rounded-lg shadow-md overflow-hidden max-w-5xl">
      {/* Table Header */}
      <div className="bg-table-header px-4 py-3 border-b border-border">
        <div className="grid grid-cols-10 gap-3 text-sm font-medium text-productivity-text-secondary">
          <div className="col-span-1"></div> {/* Urgency indicator */}
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Interval</div>
          <div className="col-span-4">Event</div>
          <div className="col-span-1">Duration</div>
        </div>
      </div>
      
      {/* Events List */}
      <div className="divide-y divide-border">
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-productivity-text-tertiary">
            No events found for the selected time period.
          </div>
        ) : (
          events.map((event, index) => {
            const urgencyLevel = getUrgencyLevel(event.startTime);
            const isEven = index % 2 === 0;
            
            return (
              <div
                key={event.id}
                className={cn(
                  "px-4 py-3 hover:bg-table-row-hover transition-all duration-200",
                  isEven ? "bg-productivity-surface" : "bg-table-row-even"
                )}
              >
                <div className="grid grid-cols-10 gap-3 items-center">
                  {/* Urgency Indicator */}
                  <div className="col-span-1 flex justify-center">
                    <div 
                      className={cn(
                        "w-3 h-3 rounded-full",
                        getUrgencyColor(urgencyLevel)
                      )}
                      title={`Urgency: ${urgencyLevel}`}
                    />
                  </div>
                  
                  {/* Date */}
                  <div className="col-span-2">
                    <span className="text-productivity-text-primary font-medium text-sm">
                      {formatDateTime(event.startTime)}
                    </span>
                  </div>
                  
                  {/* Time Interval */}
                  <div className="col-span-2">
                    <span className="text-productivity-text-secondary font-mono text-sm">
                      {getTimeUntilEvent(event.startTime)}
                    </span>
                  </div>
                  
                  {/* Event Title */}
                  <div className="col-span-4">
                    <span className="text-productivity-text-primary text-sm">
                      {event.title}
                    </span>
                    {event.description && (
                      <div className="text-sm text-productivity-text-tertiary mt-1">
                        {event.description}
                      </div>
                    )}
                  </div>
                  
                  {/* Duration */}
                  <div className="col-span-1">
                    <span className="text-productivity-text-secondary font-mono text-sm">
                      {formatDuration(event.duration)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};