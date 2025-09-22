import { useState, useMemo } from 'react';
import { CalendarEventsList } from '../components/CalendarEventsList';
import { TimeFilterDropdown } from '../components/TimeFilterDropdown';
import { sampleEvents } from '../data/sampleEvents';
import { TimeFilter } from '../types/calendar';
import { Calendar } from 'lucide-react';

const Index = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');

  // Filter events based on selected time period
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    return sampleEvents.filter(event => {
      const eventDate = new Date(event.startTime.getFullYear(), event.startTime.getMonth(), event.startTime.getDate());
      
      switch (timeFilter) {
        case 'today':
          return eventDate.getTime() === today.getTime();
        case 'tomorrow':
          return eventDate.getTime() === tomorrow.getTime();
        case 'day-after':
          return eventDate.getTime() === tomorrow.getTime() + 24 * 60 * 60 * 1000;
        case '2-days-after':
          return eventDate.getTime() === tomorrow.getTime() + 2 * 24 * 60 * 60 * 1000;
        case 'this-week':
          const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
          const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          return eventDate >= weekStart && eventDate < weekEnd;
        case 'next-week':
          const nextWeekStart = new Date(today.getTime() + (7 - today.getDay()) * 24 * 60 * 60 * 1000);
          const nextWeekEnd = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          return eventDate >= nextWeekStart && eventDate < nextWeekEnd;
        case 'this-month':
          return eventDate.getMonth() === today.getMonth() && eventDate.getFullYear() === today.getFullYear();
        case 'next-month':
          const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          return eventDate.getMonth() === nextMonth.getMonth() && eventDate.getFullYear() === nextMonth.getFullYear();
        default:
          return true;
      }
    }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [timeFilter]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-productivity-text-primary">
              Calendar Events
            </h1>
          </div>
          <p className="text-productivity-text-secondary">
            Stay on top of your schedule with real-time urgency indicators
          </p>
        </div>

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
          </div>
        </div>

        {/* Events List */}
        <CalendarEventsList 
          events={filteredEvents} 
          timeFilter={timeFilter}
        />

        {/* Legend */}
        <div className="mt-6 p-4 bg-productivity-surface-subtle rounded-lg">
          <h3 className="text-sm font-medium text-productivity-text-secondary mb-3">
            Urgency Indicators
          </h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-urgency-critical"></div>
              <span className="text-productivity-text-tertiary">Next 45 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-urgency-warning"></div>
              <span className="text-productivity-text-tertiary">45 min - 2 hours</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-urgency-normal"></div>
              <span className="text-productivity-text-tertiary">2 - 24 hours</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-urgency-future"></div>
              <span className="text-productivity-text-tertiary">More than 24 hours</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
