import { HolidayItem, GetHolidaysParams } from '../types/holiday';
import { API_CONFIG } from '../config/api';

export class HolidayApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  async getHolidays(params: GetHolidaysParams): Promise<HolidayItem[]> {
    const url = new URL(`${this.baseUrl}/get-holidays`);
    url.searchParams.append('date', params.date);

    try {
      console.log('🎉 Fetching holidays from:', url.toString());
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`🎊 Received ${data.length} holidays`);
      return data as HolidayItem[];
    } catch (error) {
      console.error('Error fetching holidays:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const holidayApiService = new HolidayApiService();
