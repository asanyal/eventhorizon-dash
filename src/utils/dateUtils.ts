import { CalendarEvent, UrgencyLevel } from '../types/calendar';

export const formatDateTime = (date: Date): string => {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
  
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const time = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (isToday) {
    return `Today (${time})`;
  } else if (isTomorrow) {
    return `Tomorrow (${time})`;
  } else {
    return `${month} ${day} (${time})`;
  }
};

export const getTimeUntilEvent = (eventDate: Date): string => {
  const now = new Date();
  const diffMs = eventDate.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 0) {
    // Keep existing "ago" logic unchanged
    const absDiffMinutes = Math.abs(diffMinutes);
    if (absDiffMinutes < 60) {
      return `${absDiffMinutes}m ago`;
    } else if (absDiffMinutes < 1440) { // Less than 24 hours
      const hours = Math.floor(absDiffMinutes / 60);
      const minutes = absDiffMinutes % 60;
      return `${hours}h ${minutes}m ago`;
    } else { // More than 24 hours ago
      const days = Math.floor(absDiffMinutes / 1440);
      const remainingMinutes = absDiffMinutes % 1440;
      const hours = Math.floor(remainingMinutes / 60);
      return `${days}d ${hours}h ago`;
    }
  }
  
  // Future events - apply new rules
  if (diffMinutes <= 60) {
    // Events 60 minutes or less - show minutes
    return `In ${diffMinutes}m`;
  } else if (diffMinutes < 1440) { // Less than 24 hours
    const totalHours = diffMinutes / 60;
    const wholeHours = Math.floor(totalHours);
    const minutes = diffMinutes % 60;
    
    if (minutes <= 15) {
      // 0-15 minutes: round down to whole hour
      return `In ${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'}`;
    } else if (minutes <= 45) {
      // 15-45 minutes: show as .5 hours
      return `In ${wholeHours}.5 hours`;
    } else {
      // 45-60 minutes: round up to next whole hour
      const nextHour = wholeHours + 1;
      return `In ${nextHour} ${nextHour === 1 ? 'hour' : 'hours'}`;
    }
  } else { // More than 24 hours (≥ 1440 minutes)
    const totalHours = diffMinutes / 60;
    const totalDays = totalHours / 24;
    const wholeDays = Math.floor(totalDays);
    const remainingHours = totalHours % 24;
    
    if (remainingHours <= 6) {
      // 0-6 hours: round down to whole day
      return `In ${wholeDays} ${wholeDays === 1 ? 'day' : 'days'}`;
    } else if (remainingHours <= 18) {
      // 6-18 hours: show as .5 days
      return `In ${wholeDays}.5 days`;
    } else {
      // 18-24 hours: round up to next whole day
      const nextDay = wholeDays + 1;
      return `In ${nextDay} ${nextDay === 1 ? 'day' : 'days'}`;
    }
  }
};

// Helper function to get the color class for interval text based on new rules
export const getIntervalColor = (intervalText: string): string => {
  if (intervalText.includes('ago') || intervalText.includes('All Day')) {
    return ''; // No special color for past events or all-day events
  }
  
  if (intervalText.includes('m')) {
    // Minutes - no specific color mentioned, keeping default
    return '';
  }
  
  if (intervalText.includes('hours')) {
    const hoursMatch = intervalText.match(/(\d+(?:\.\d+)?)\s+hours/);
    if (hoursMatch) {
      const hours = parseFloat(hoursMatch[1]);
      if (hours < 12) {
        return 'text-red-500'; // Less than 12 hours - red
      } else {
        return 'text-orange-500'; // 12+ hours - orange
      }
    }
  }
  
  if (intervalText.includes('days')) {
    const daysMatch = intervalText.match(/(\d+(?:\.\d+)?)\s+days/);
    if (daysMatch) {
      const days = parseFloat(daysMatch[1]);
      if (days === 1.5) {
        return 'text-orange-500'; // 1.5 days - orange
      } else if (days >= 2 && days <= 3) {
        return 'text-purple-500'; // 2-3 days - purple
      } else if (days >= 3.5) {
        return 'text-gray-500'; // 3.5+ days - gray
      }
    }
  }
  
  return ''; // Default color
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}m`;
  }
};

export const getUrgencyLevel = (eventDate: Date): UrgencyLevel => {
  const now = new Date();
  const diffMs = eventDate.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes <= 45) {
    return 'critical';
  } else if (diffMinutes <= 120) {
    return 'warning';
  } else if (diffMinutes <= 1440) { // 24 hours
    return 'normal';
  } else {
    return 'future';
  }
};

export const getUrgencyColor = (urgencyLevel: UrgencyLevel): string => {
  switch (urgencyLevel) {
    case 'critical':
      return 'bg-urgency-critical';
    case 'warning':
      return 'bg-urgency-warning';
    case 'normal':
      return 'bg-urgency-normal';
    case 'future':
      return 'bg-urgency-future';
  }
};