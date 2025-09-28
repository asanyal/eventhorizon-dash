import { useState, useEffect } from 'react';
import { BookmarkEvent } from '../types/bookmark';
import { bookmarkApiService } from '../services/bookmarkApi';
import { cn } from '../lib/utils';
import { X, RefreshCw, BookmarkCheck } from 'lucide-react';
import { useTimezone } from '../contexts/TimezoneContext';
import { getIntervalColor } from '../utils/dateUtils';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cacheUtils';

interface KeyEventsSectionProps {
  refreshTrigger?: number;
  onBookmarkDeleted?: () => void;
}

export const KeyEventsSection = ({ refreshTrigger, onBookmarkDeleted }: KeyEventsSectionProps) => {
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
        // Keep existing "ago" logic unchanged
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
      }
      
      // Future events - apply new rules
      if (diffMinutes <= 60) {
        // Events 60 minutes or less - show minutes
        return `In ${diffMinutes}m`;
      } else if (diffMinutes < 24 * 60) { // Less than 24 hours
        const totalHours = diffMinutes / 60;
        const wholeHours = Math.floor(totalHours);
        const minutes = diffMinutes % 60;
        
        if (minutes <= 15) {
          // 0-15 minutes: round down to whole hour
          return `In ${wholeHours} hours`;
        } else if (minutes <= 45) {
          // 15-45 minutes: show as .5 hours
          return `In ${wholeHours}.5 hours`;
        } else {
          // 45-60 minutes: round up to next whole hour
          return `In ${wholeHours + 1} hours`;
        }
      } else { // More than 24 hours (≥ 1440 minutes)
        const totalHours = diffMinutes / 60;
        const totalDays = totalHours / 24;
        const wholeDays = Math.floor(totalDays);
        const remainingHours = totalHours % 24;
        
        if (remainingHours <= 6) {
          // 0-6 hours: round down to whole day
          return `In ${wholeDays} days`;
        } else if (remainingHours <= 18) {
          // 6-18 hours: show as .5 days
          return `In ${wholeDays}.5 days`;
        } else {
          // 18-24 hours: round up to next whole day
          return `In ${wholeDays + 1} days`;
        }
      }
    } catch (error) {
      // Fallback to original time if calculation fails
      return bookmark.time;
    }
  };

  const fetchBookmarks = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Try to get from cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedBookmarks = cache.get<BookmarkEvent[]>(CACHE_KEYS.BOOKMARKS);
        if (cachedBookmarks) {
          console.log(`📦 Using cached bookmarks (${cachedBookmarks.length} items)`);
          setBookmarks(cachedBookmarks);
          setLoading(false);
          return;
        }
      }
      
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
      
      // Cache the sorted bookmarks
      cache.set(CACHE_KEYS.BOOKMARKS, sortedBookmarks, { ttl: CACHE_TTL.BOOKMARKS });
      
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
      // Clear cache and force refresh
      cache.remove(CACHE_KEYS.BOOKMARKS);
      await fetchBookmarks(true);
    } finally {
      setRefreshing(false);
    }
  };

  const handleUnbookmark = async (eventTitle: string) => {
    try {
      await bookmarkApiService.deleteBookmarkByTitle(eventTitle);
      // Clear bookmark-related caches
      cache.remove(CACHE_KEYS.BOOKMARKS);
      cache.remove(CACHE_KEYS.BOOKMARK_TITLES);
      
      // Notify parent component that bookmark was deleted
      if (onBookmarkDeleted) {
        onBookmarkDeleted();
      }
      
      // Refresh the list after successful deletion
      await fetchBookmarks(true);
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
            Bookmarked Events
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
                "grid grid-cols-12 gap-3 items-center p-3 rounded border transition-colors",
                isToday 
                  ? "bg-purple-50 border-purple-200 hover:bg-purple-100"
                  : "bg-blue-50 border-blue-200 hover:bg-blue-100"
              )}
            >
              {/* Date */}
              <div className="col-span-2 text-xs text-productivity-text-tertiary font-medium">
                <div>{bookmark.date}</div>
                {eventTime && (
                  <div className="text-[10px] text-productivity-text-secondary">{eventTime}</div>
                )}
              </div>

              {/* Time */}
              <div className={cn(
                "col-span-2 text-xs font-mono font-medium",
                getIntervalColor(realtimeCountdown) || "text-red-500"
              )}>
                {realtimeCountdown}
              </div>

              {/* Event Title */}
              <div className="col-span-5 min-w-0">
                <div className="text-productivity-text-primary text-xs font-medium break-words leading-tight">
                  {bookmark.event_title}
                </div>
              </div>

              {/* Duration */}
              <div className="col-span-1 text-xs text-productivity-text-tertiary text-center">
                {bookmark.duration}min
              </div>

              {/* Attendees Count */}
              <div className="col-span-1 text-xs text-productivity-text-tertiary text-center">
                {bookmark.attendees && bookmark.attendees.length > 0 ? (
                  <span title={`${bookmark.attendees.length} attendee${bookmark.attendees.length !== 1 ? 's' : ''}`}>
                    {bookmark.attendees.length}
                  </span>
                ) : (
                  <span className="text-productivity-text-tertiary">-</span>
                )}
              </div>

              {/* Unbookmark Button */}
              <div className="col-span-1 flex justify-center">
                <button
                  onClick={() => handleUnbookmark(bookmark.event_title)}
                  className="p-1 text-productivity-text-tertiary hover:text-red-500 transition-colors"
                  title={`Remove "${bookmark.event_title}" from key events`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
};
