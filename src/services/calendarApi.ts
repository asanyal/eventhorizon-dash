import { ApiEvent, CalendarEvent } from '../types/calendar';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import { Temporal } from '@js-temporal/polyfill';

export interface GetEventsParams {
  start: string; // YYYY-MM-DD format
  end: string;   // YYYY-MM-DD format
}

export class CalendarApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  async getEvents(params: GetEventsParams): Promise<ApiEvent[]> {
    const url = new URL(`${this.baseUrl}${API_ENDPOINTS.getEvents}`);
    url.searchParams.append('start', params.start);
    url.searchParams.append('end', params.end);

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data as ApiEvent[];
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }
}

// Transform API event to internal CalendarEvent format
export const transformApiEvent = (apiEvent: ApiEvent, index: number): CalendarEvent => {
  const currentYear = new Date().getFullYear();
  
  // Handle all-day events
  if (apiEvent.all_day || apiEvent.start_time === "All Day") {
    // For all-day events, just parse the date and set time to start of day
    const [month, day] = apiEvent.date.split(' ');
    const monthNum = new Date(`${month} 1, ${currentYear}`).getMonth();
    const dayNum = parseInt(day);
    const parsedDate = new Date(currentYear, monthNum, dayNum, 0, 0, 0, 0);
    
    return {
      id: `api-event-${index}`,
      title: apiEvent.event,
      startTime: parsedDate,
      duration: apiEvent.duration_minutes,
      attendees: apiEvent.attendees,
      organizerEmail: apiEvent.organizer_email,
      all_day: true,
      notes: apiEvent.notes,
    };
  }
  
  // Parse date and time for regular events
  // API always returns PST times - create datetime object with forced PST timezone
  const [month, day] = apiEvent.date.split(' ');
  const monthNum = new Date(`${month} 1, ${currentYear}`).getMonth() + 1; // Temporal uses 1-based months
  const dayNum = parseInt(day);
  
  // Parse the time
  const [time, period] = apiEvent.start_time.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  
  let adjustedHours = hours;
  if (period === 'PM' && hours !== 12) {
    adjustedHours += 12;
  } else if (period === 'AM' && hours === 12) {
    adjustedHours = 0;
  }
  
  // Create ZonedDateTime with forced PST timezone using ISO string format
  const isoString = `${currentYear}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}T${String(adjustedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00[America/Los_Angeles]`;
  const pstZoned = Temporal.ZonedDateTime.from(isoString);
  
  // Convert to JavaScript Date object - browser will display in system timezone
  const eventDate = new Date(pstZoned.epochMilliseconds);
  
  return {
    id: `api-event-${index}`,
    title: apiEvent.event,
    startTime: eventDate,
    duration: apiEvent.duration_minutes,
    attendees: apiEvent.attendees,
    organizerEmail: apiEvent.organizer_email,
    all_day: false,
    notes: apiEvent.notes,
  };
};

// Create a singleton instance
export const calendarApiService = new CalendarApiService();
