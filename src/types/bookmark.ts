export interface BookmarkEvent {
  id?: string;
  date: string;
  time: string;
  event_title: string;
  duration: number;
  attendees: string[];
  created_at?: string;
}

export interface CreateBookmarkRequest {
  date: string;
  time: string;
  event_title: string;
  duration: number;
  attendees: string[];
}

export interface GetBookmarksParams {
  date?: string;
}
