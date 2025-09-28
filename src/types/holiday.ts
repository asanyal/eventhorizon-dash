export interface HolidayItem {
  name: string;
  date: string; // Format: "Sep 1"
  time_until: string; // Format: "Past" or "In 15d 6h"
}

export interface GetHolidaysParams {
  date: string; // YYYY-MM-DD format
}

// Enhanced holiday with additional computed properties
export interface EnhancedHoliday extends HolidayItem {
  id: string;
  fullDate: Date;
  formattedDate: string; // e.g., "Tue, Oct 13"
  formattedTimeUntil: string; // e.g., "In 15.5 days" (using calendar logic)
  isUpcoming: boolean;
  isPast: boolean;
  daysUntil: number;
  isLongWeekend: boolean;
  weekendType?: 'friday-monday' | 'thursday-friday' | 'monday-tuesday';
  category: 'major' | 'cultural' | 'observance' | 'federal';
  hasCalendarConflicts: boolean;
  hasBookmarkedConflicts: boolean;
}
