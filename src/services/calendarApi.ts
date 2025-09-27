import { ApiEvent, CalendarEvent } from '../types/calendar';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';

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
  const dateStr = `${apiEvent.date} ${currentYear}`;
  const dateTime = new Date(`${dateStr} ${apiEvent.start_time}`);
  
  // If the date parsing fails, try a different approach
  if (isNaN(dateTime.getTime())) {
    // Try parsing with more specific format
    const [month, day] = apiEvent.date.split(' ');
    const monthNum = new Date(`${month} 1, ${currentYear}`).getMonth();
    const dayNum = parseInt(day);
    
    const parsedDate = new Date(currentYear, monthNum, dayNum);
    const [time, period] = apiEvent.start_time.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    let adjustedHours = hours;
    if (period === 'PM' && hours !== 12) {
      adjustedHours += 12;
    } else if (period === 'AM' && hours === 12) {
      adjustedHours = 0;
    }
    
    parsedDate.setHours(adjustedHours, minutes, 0, 0);
    
    return {
      id: `api-event-${index}`,
      title: apiEvent.event,
      startTime: parsedDate,
      duration: apiEvent.duration_minutes,
      attendees: apiEvent.attendees,
      organizerEmail: apiEvent.organizer_email,
      all_day: false,
      notes: apiEvent.notes,
    };
  }

  return {
    id: `api-event-${index}`,
    title: apiEvent.event,
    startTime: dateTime,
    duration: apiEvent.duration_minutes,
    attendees: apiEvent.attendees,
    organizerEmail: apiEvent.organizer_email,
    all_day: false,
    notes: apiEvent.notes,
  };
};

// Create a singleton instance
export const calendarApiService = new CalendarApiService();
