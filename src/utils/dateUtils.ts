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
    const absDiffMinutes = Math.abs(diffMinutes);
    if (absDiffMinutes < 60) {
      return `${absDiffMinutes}m ago`;
    } else {
      const hours = Math.floor(absDiffMinutes / 60);
      const minutes = absDiffMinutes % 60;
      return `${hours}h ${minutes}m ago`;
    }
  }
  
  if (diffMinutes < 60) {
    return `In ${diffMinutes}m`;
  } else {
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `In ${hours}h ${minutes}m`;
  }
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