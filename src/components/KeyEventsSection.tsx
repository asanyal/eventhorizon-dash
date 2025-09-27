import { useState, useEffect } from 'react';
import { BookmarkEvent } from '../types/bookmark';
import { bookmarkApiService } from '../services/bookmarkApi';
import { cn } from '../lib/utils';
import { X, RefreshCw, BookmarkCheck } from 'lucide-react';
import { useTimezone } from '../contexts/TimezoneContext';

interface KeyEventsSectionProps {
  refreshTrigger?: number;
}

export const KeyEventsSection = ({ refreshTrigger }: KeyEventsSectionProps) => {
  const [bookmarks, setBookmarks] = useState<BookmarkEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { convertTime } = useTimezone();

  // Fetch bookmarks on component mount and when refreshTrigger changes
  useEffect(() => {
    fetchBookmarks();
  }, [refreshTrigger]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Calculate real-time countdown to event
  const getRealtimeCountdown = (bookmark: BookmarkEvent): string => {
    try {
      // Parse the actual event start time from ISO string
      let eventDate: Date;
      
      if (bookmark.time && bookmark.time.includes('T')) {
        // New format: ISO datetime string
        eventDate = new Date(bookmark.time);
      } else {
        // Legacy format: try to reconstruct from relative time (fallback)
        if (bookmark.date.includes(',')) {
          // Handle "Thu, Sep 25" format
          const parts = bookmark.date.split(', ')[1]; // Get "Sep 25" part
          const currentYear = new Date().getFullYear();
          eventDate = new Date(`${parts}, ${currentYear}`);
        } else {
          eventDate = new Date(bookmark.date);
        }
        
        // If we have the original time string, try to extract the offset
        if (bookmark.time && bookmark.time.includes('In')) {
          // Parse the original offset from bookmark.time
          let originalMinutes = 0;
          const hoursMatch = bookmark.time.match(/(\d+)h/);
          const minutesMatch = bookmark.time.match(/(\d+)m/);
          
          if (hoursMatch) {
            originalMinutes += parseInt(hoursMatch[1]) * 60;
          }
          if (minutesMatch) {
            originalMinutes += parseInt(minutesMatch[1]);
          }
          
          // If no h/m format, try other patterns
          if (originalMinutes === 0 && bookmark.time.includes('hour')) {
            const hours = parseInt(bookmark.time.match(/\d+/)?.[0] || "0");
            originalMinutes = hours * 60;
          }
          
          // Calculate the actual event time based on when it was bookmarked
          eventDate.setHours(0, 0, 0, 0); // Start of day
          eventDate = new Date(eventDate.getTime() + originalMinutes * 60 * 1000);
        }
      }
      
      // Calculate difference from now
      const now = currentTime.getTime();
      const eventTime = eventDate.getTime();
      const diffMs = eventTime - now;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      if (diffMinutes <= 0) {
        const pastMinutes = Math.abs(diffMinutes);
        if (pastMinutes < 60) {
          return `${pastMinutes}m ago`;
        } else if (pastMinutes < 24 * 60) {
          // Less than 24 hours ago - show hours and minutes
          const pastHours = Math.floor(pastMinutes / 60);
          const pastMins = pastMinutes % 60;
          return pastMins > 0 ? `${pastHours}h ${pastMins}m ago` : `${pastHours}h ago`;
        } else {
          // More than 24 hours ago - show days and hours
          const pastDays = Math.floor(pastMinutes / (24 * 60));
          const remainingHours = Math.floor((pastMinutes % (24 * 60)) / 60);
          return remainingHours > 0 ? `${pastDays}d ${remainingHours}h ago` : `${pastDays}d ago`;
        }
      } else if (diffMinutes < 60) {
        return `In ${diffMinutes}m`;
      } else if (diffMinutes < 24 * 60) {
        // Less than 24 hours - show hours and minutes
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        return minutes > 0 ? `In ${hours}h ${minutes}m` : `In ${hours}h`;
      } else {
        // More than 24 hours - show days and hours
        const days = Math.floor(diffMinutes / (24 * 60));
        const remainingHours = Math.floor((diffMinutes % (24 * 60)) / 60);
        return remainingHours > 0 ? `In ${days}d ${remainingHours}h` : `In ${days}d`;
      }
    } catch (error) {
      // Fallback to original time if calculation fails
      return bookmark.time;
    }
  };

  const fetchBookmarks = async () => {
    try {
      setLoading(true);
      const allBookmarks = await bookmarkApiService.getBookmarks();
      
      // Sort bookmarks by actual event datetime (earliest first)
      const sortedBookmarks = allBookmarks.sort((a, b) => {
        const getEventDateTime = (bookmark: BookmarkEvent): Date => {
          if (bookmark.time && bookmark.time.includes('T')) {
            // New format: ISO datetime string
            return new Date(bookmark.time);
          } else {
            // Legacy format: try to reconstruct from date and relative time
            let eventDate: Date;
            if (bookmark.date.includes(',')) {
              // Handle "Thu, Sep 25" format
              const parts = bookmark.date.split(', ')[1]; // Get "Sep 25" part
              const currentYear = new Date().getFullYear();
              eventDate = new Date(`${parts}, ${currentYear}`);
            } else {
              eventDate = new Date(bookmark.date);
            }
            
            // If we have the original time string, try to extract the offset
            if (bookmark.time && bookmark.time.includes('In')) {
              let originalMinutes = 0;
              const hoursMatch = bookmark.time.match(/(\d+)h/);
              const minutesMatch = bookmark.time.match(/(\d+)m/);
              
              if (hoursMatch) {
                originalMinutes += parseInt(hoursMatch[1]) * 60;
              }
              if (minutesMatch) {
                originalMinutes += parseInt(minutesMatch[1]);
              }
              
              if (originalMinutes === 0 && bookmark.time.includes('hour')) {
                const hours = parseInt(bookmark.time.match(/\d+/)?.[0] || "0");
                originalMinutes = hours * 60;
              }
              
              eventDate.setHours(0, 0, 0, 0);
              eventDate = new Date(eventDate.getTime() + originalMinutes * 60 * 1000);
            }
            
            return eventDate;
          }
        };
        
        const eventDateA = getEventDateTime(a);
        const eventDateB = getEventDateTime(b);
        
        return eventDateA.getTime() - eventDateB.getTime();
      });
      
      setBookmarks(sortedBookmarks);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchBookmarks();
    } finally {
      setRefreshing(false);
    }
  };

  const handleUnbookmark = async (eventTitle: string) => {
    try {
      await bookmarkApiService.deleteBookmarkByTitle(eventTitle);
      // Refresh the list after successful deletion
      await fetchBookmarks();
    } catch (error) {
      console.error('Error deleting bookmark:', error);
    }
  };

  return (
    <div className="bg-productivity-surface rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-productivity-text-primary flex items-center gap-2">
            <BookmarkCheck className="w-5 h-5 text-blue-500" />
            Key Events
          </h3>
          {/* Event count badge */}
          {!loading && (
            <div className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
              {bookmarks.filter((bookmark) => {
                const realtimeCountdown = getRealtimeCountdown(bookmark);
                return !realtimeCountdown.includes("ago");
              }).length}
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 text-productivity-text-secondary hover:text-productivity-text-primary transition-colors"
          title="Refresh Key Events"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Bookmarks List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-productivity-text-tertiary">Loading key events...</span>
          </div>
        ) : bookmarks.length === 0 ? (
          <p className="text-sm text-productivity-text-tertiary">
            No key events bookmarked yet. Click the bookmark icon next to any calendar event to add it here.
          </p>
        ) : (
          bookmarks.filter((bookmark) => {
            const realtimeCountdown = getRealtimeCountdown(bookmark);
            // Only show future events (not past events)
            return !realtimeCountdown.includes("ago");
          }).map((bookmark, index) => {
            const realtimeCountdown = getRealtimeCountdown(bookmark);
            const isToday = realtimeCountdown === "Today" || realtimeCountdown.includes("In") && !realtimeCountdown.includes("day");
            
            // Extract event time from ISO string
            const getEventTime = (bookmark: BookmarkEvent): string => {
              if (bookmark.time && bookmark.time.includes('T')) {
                // New format: ISO datetime string
                const eventDate = new Date(bookmark.time);
                const convertedTime = convertTime(eventDate);
                return convertedTime.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit', 
                  hour12: true 
                });
              }
              return ''; // No time available for legacy format
            };
            
            const eventTime = getEventTime(bookmark);
            
            return (
            <div
              key={bookmark.id || index}
              className={cn(
                "flex items-center gap-2 p-3 rounded border transition-colors",
                isToday 
                  ? "bg-purple-50 border-purple-200 hover:bg-purple-100"
                  : "bg-blue-50 border-blue-200 hover:bg-blue-100"
              )}
            >
              {/* Date */}
              <div className="flex-shrink-0 text-xs text-productivity-text-tertiary font-medium">
                <div>{bookmark.date}</div>
                {eventTime && (
                  <div className="text-[10px] text-productivity-text-secondary">{eventTime}</div>
                )}
              </div>

              {/* Time */}
              <div className="flex-shrink-0 text-xs text-red-500 font-mono font-medium">
                {realtimeCountdown}
              </div>

              {/* Event Title */}
              <div className="flex-1 min-w-0">
                <div className="text-productivity-text-primary text-xs font-medium break-words leading-tight">
                  {bookmark.event_title}
                </div>
              </div>

              {/* Duration */}
              <div className="flex-shrink-0 text-xs text-productivity-text-tertiary">
                {bookmark.duration}min
              </div>

              {/* Attendees Count */}
              {bookmark.attendees && bookmark.attendees.length > 0 && (
                <div className="flex-shrink-0 text-xs text-productivity-text-tertiary">
                  {bookmark.attendees.length} attendee{bookmark.attendees.length !== 1 ? 's' : ''}
                </div>
              )}

              {/* Unbookmark Button */}
              <button
                onClick={() => handleUnbookmark(bookmark.event_title)}
                className="p-1 text-productivity-text-tertiary hover:text-red-500 transition-colors"
                title={`Remove "${bookmark.event_title}" from key events`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
};
