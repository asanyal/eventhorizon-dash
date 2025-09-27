import { BookmarkEvent, CreateBookmarkRequest, GetBookmarksParams } from '../types/bookmark';
import { API_CONFIG } from '../config/api';

export class BookmarkApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  async createBookmark(bookmark: CreateBookmarkRequest): Promise<BookmarkEvent> {
    try {
      console.log('🔖 Making add-bookmark-event API call');
      console.log('📍 URL:', `${this.baseUrl}/add-bookmark-event`);
      console.log('📋 Bookmark data:', bookmark);

      const response = await fetch(`${this.baseUrl}/add-bookmark-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookmark),
      });

      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        console.error('❌ HTTP error! status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response body:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Bookmark created successfully:', responseData);
      
      return responseData;
    } catch (error) {
      console.error('💥 Error creating bookmark:', error);
      throw error;
    }
  }

  async getBookmarks(params: GetBookmarksParams = {}): Promise<BookmarkEvent[]> {
    try {
      const url = new URL(`${this.baseUrl}/get-bookmark-events`);
      
      if (params.date) {
        url.searchParams.append('date', params.date);
      }

      console.log('📖 Making get-bookmark-events API call');
      console.log('📍 URL:', url.toString());

      const response = await fetch(url.toString());
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Bookmarks fetched successfully:', responseData);
      
      return responseData;
    } catch (error) {
      console.error('💥 Error fetching bookmarks:', error);
      throw error;
    }
  }

  async deleteBookmarkByTitle(eventTitle: string): Promise<void> {
    try {
      const url = new URL(`${this.baseUrl}/delete-bookmark-event-by-title`);
      url.searchParams.append('event_title', eventTitle);

      console.log('🗑️ Making delete-bookmark-event-by-title API call');
      console.log('📍 URL:', url.toString());
      console.log('📋 Event title:', eventTitle);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        console.error('❌ HTTP error! status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response body:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('✅ Bookmark deleted successfully');
    } catch (error) {
      console.error('💥 Error deleting bookmark:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const bookmarkApiService = new BookmarkApiService();
