import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { CalendarEvent } from '../types/calendar';
import { getTimeUntilEvent, getIntervalColor } from '../utils/dateUtils';
import { TimezoneProvider } from '../contexts/TimezoneContext';
import { horizonApiService } from '../services/horizonApi';
import { CreateHorizonRequest, EditHorizonRequest, HorizonItem } from '../types/horizon';

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
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [horizons, setHorizons] = useState<HorizonItem[]>([]);
  const [currentEventHorizon, setCurrentEventHorizon] = useState<HorizonItem | null>(null);
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

  // Fetch horizons on mount
  useEffect(() => {
    const fetchHorizons = async () => {
      try {
        const allHorizons = await horizonApiService.getHorizons();
        setHorizons(allHorizons);
      } catch (error) {
        console.error('Error fetching horizons:', error);
      }
    };
    fetchHorizons();
  }, []);

  // Update currentEventHorizon whenever horizons change (for refreshing after save)
  useEffect(() => {
    if (filteredEvents.length > 0 && currentEventIndex < filteredEvents.length) {
      const currentEvent = filteredEvents[currentEventIndex];
      const matchingHorizon = horizons.find(h => h.title === currentEvent.title);
      setCurrentEventHorizon(matchingHorizon || null);
    }
  }, [horizons, currentEventIndex, filteredEvents]);

  // Load notes when navigating between events
  useEffect(() => {
    if (filteredEvents.length > 0 && currentEventIndex < filteredEvents.length) {
      const currentEvent = filteredEvents[currentEventIndex];
      const matchingHorizon = horizons.find(h => h.title === currentEvent.title);

      // Reset notes and edit mode when navigating between events
      if (matchingHorizon && matchingHorizon.details?.trim()) {
        setNotes(matchingHorizon.details);
        setIsEditMode(false);
      } else {
        setNotes('');
        setIsEditMode(false);
      }
    }
  }, [currentEventIndex]);

  // Reset to first event when filter changes
  useEffect(() => {
    setCurrentEventIndex(0);
  }, [selectedFilter]);

  // Handle previous event
  const handlePrevEvent = () => {
    if (currentEventIndex > 0) {
      setCurrentEventIndex(currentEventIndex - 1);
    }
  };

  // Handle next event
  const handleNextEvent = () => {
    if (currentEventIndex < filteredEvents.length - 1) {
      setCurrentEventIndex(currentEventIndex + 1);
    }
  };

  // Handle adding/updating note as Horizon
  const handleAddNote = async () => {
    if (!notes.trim() || filteredEvents.length === 0) return;

    const currentEvent = filteredEvents[currentEventIndex];
    const eventTime = currentEvent.startTime instanceof Date
      ? currentEvent.startTime
      : new Date(currentEvent.startTime);

    setIsAddingNote(true);
    try {
      if (currentEventHorizon) {
        // Update existing horizon
        const editRequest: EditHorizonRequest = {
          existing_title: currentEventHorizon.title,
          new_title: currentEvent.title,
          new_details: notes.trim(),
          new_type: 'Meeting',
          new_horizon_date: eventTime.toISOString().split('T')[0]
        };
        await horizonApiService.editHorizon(editRequest);
      } else {
        // Create new horizon
        const horizonRequest: CreateHorizonRequest = {
          title: currentEvent.title,
          details: notes.trim(),
          type: 'Meeting',
          horizon_date: eventTime.toISOString().split('T')[0] // Format as YYYY-MM-DD
        };
        await horizonApiService.createHorizon(horizonRequest);
      }

      // Refresh horizons
      const allHorizons = await horizonApiService.getHorizons();
      setHorizons(allHorizons);

      // Exit edit mode
      setIsEditMode(false);

      console.log('Horizon saved successfully');
    } catch (error) {
      console.error('Error saving horizon:', error);
    } finally {
      setIsAddingNote(false);
    }
  };

  // Handle edit mode toggle
  const handleEditNote = () => {
    setIsEditMode(true);
  };

  // Get current event to display
  const currentEvent = filteredEvents[currentEventIndex];

  // Keyboard navigation - Escape to go back, Arrow keys to navigate events
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in textarea
      if (e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevEvent();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextEvent();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate, currentEventIndex, filteredEvents.length, handlePrevEvent, handleNextEvent]);

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

      {/* Single Event Display */}
      <div className="container mx-auto px-4 md:px-8 pb-12">
        {isLoading ? (
          <div className="text-center text-gray-500 text-lg md:text-2xl mt-8 md:mt-12">
            Loading events...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center text-gray-500 text-lg md:text-2xl mt-8 md:mt-12">
            No events to prepare for
          </div>
        ) : currentEvent ? (
          <div className="max-w-6xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
            {/* Event Content Area - Fixed Height with Scroll */}
            <div className="flex-shrink-0 overflow-y-auto" style={{ minHeight: '300px', maxHeight: '50vh' }}>
              {/* Event Counter */}
              <div className="text-center mb-4 text-gray-500 text-sm md:text-base">
                Event {currentEventIndex + 1} of {filteredEvents.length}
              </div>

              {/* Single Event Display */}
              <div className="py-4 md:py-8 relative">
                {(() => {
                  const eventTime = currentEvent.startTime instanceof Date
                    ? currentEvent.startTime
                    : new Date(currentEvent.startTime);
                  const timeUntil = getTimeUntilEvent(eventTime);
                  const intervalColor = getIntervalColor(timeUntil);
                  const externalDomains = getExternalDomains(currentEvent.attendees);
                  const attendeeNames = getAttendeeNames(currentEvent.attendees);

                  return (
                    <>
                      {/* External Domains at top */}
                      {externalDomains.length > 0 && (
                        <div className="mb-3 md:mb-4 flex gap-2 flex-wrap justify-center">
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
                        <div className="flex-shrink-0 md:min-w-[180px]">
                          <div className={`text-xl md:text-2xl font-bold ${intervalColor}`}>
                            {timeUntil}
                          </div>
                          <div className="text-sm md:text-base text-gray-500 mt-1">
                            {eventTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {eventTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>

                        {/* Title - BIG and centered on desktop, left-aligned on mobile */}
                        <div className="flex-1 md:text-center">
                          <h2 className="text-2xl md:text-5xl font-bold leading-tight">
                            {currentEvent.title}
                          </h2>
                        </div>

                        {/* Spacer to balance the countdown on left (desktop only) */}
                        <div className="hidden md:block flex-shrink-0 min-w-[180px]"></div>
                      </div>

                      {/* Attendee names at bottom */}
                      {attendeeNames.length > 0 && (
                        <div className="mt-3 md:mt-4 text-gray-400 text-sm md:text-lg text-center md:text-left">
                          <span className="font-semibold">With:</span> {attendeeNames.join(', ')}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Controls Area - Fixed Position Below */}
            <div className="flex-shrink-0 mt-auto pt-8">
              {/* Navigation Arrows */}
              <div className="flex items-center justify-center gap-8 mb-6">
              <button
                onClick={handlePrevEvent}
                disabled={currentEventIndex === 0}
                className={`p-4 rounded-full transition-colors duration-200 w-16 h-16 md:w-20 md:h-20 flex items-center justify-center ${
                  currentEventIndex === 0
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
                title="Previous event"
              >
                <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
              </button>

              <button
                onClick={handleNextEvent}
                disabled={currentEventIndex === filteredEvents.length - 1}
                className={`p-4 rounded-full transition-colors duration-200 w-16 h-16 md:w-20 md:h-20 flex items-center justify-center ${
                  currentEventIndex === filteredEvents.length - 1
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
                title="Next event"
              >
                <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
              </button>
              </div>

              {/* Notes Section */}
              <div className="max-w-3xl mx-auto mt-6">
                <label htmlFor="notes" className="block text-sm md:text-base font-medium text-gray-400 mb-2">
                  Mental Notes
                </label>

                {/* Display mode when note exists and not editing */}
                {currentEventHorizon && !isEditMode && currentEventHorizon.details?.trim() ? (
                  <div className="bg-red-100 border-2 border-red-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 text-red-900 text-sm md:text-base whitespace-pre-wrap font-medium">
                        {currentEventHorizon.details}
                      </div>
                      <button
                        onClick={handleEditNote}
                        className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 transition-colors"
                        title="Edit note"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Edit mode or no note exists */
                  <>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Prepare for this event..."
                      className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg p-4 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={4}
                    />
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={handleAddNote}
                        disabled={!notes.trim() || isAddingNote}
                        className={`px-6 py-3 rounded-lg font-semibold text-sm md:text-base transition-all duration-200 ${
                          !notes.trim() || isAddingNote
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
                        }`}
                      >
                        {isAddingNote ? (currentEventHorizon ? 'Updating...' : 'Adding...') : (currentEventHorizon ? 'Update Note' : 'Add Note')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
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
