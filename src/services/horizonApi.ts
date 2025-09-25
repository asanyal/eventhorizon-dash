import { HorizonItem, CreateHorizonRequest, EditHorizonRequest, HorizonType } from '../types/horizon';
import { API_CONFIG } from '../config/api';

export class HorizonApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  async createHorizon(horizon: CreateHorizonRequest): Promise<HorizonItem> {
    try {
      // Build URL with type and horizon_date as query parameters
      const url = new URL(`${this.baseUrl}/add-horizon`);
      
      // Convert type: null -> "none" for backend, keep other values as-is
      if (horizon.type !== undefined) {
        const typeParam = horizon.type === null ? 'none' : horizon.type;
        url.searchParams.append('type', typeParam);
      }
      
      if (horizon.horizon_date !== undefined) {
        const dateParam = horizon.horizon_date === null ? 'null' : horizon.horizon_date;
        url.searchParams.append('horizon_date', dateParam);
      }
      
      // Request body without type and horizon_date (since they're now query params)
      const requestBody = {
        title: horizon.title,
        details: horizon.details
      };
      
      console.log('🚀 Making add-horizon API call');
      console.log('📍 Full URL with query params:', url.toString());
      console.log('📋 Original horizon params:', horizon);
      console.log('🔍 Query parameters:', Object.fromEntries(url.searchParams.entries()));
      console.log('📦 Request body:', requestBody);
      console.log('🔗 Full request details:', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.error('❌ HTTP error! status:', response.status);
        const errorText = await response.text();
        console.error('❌ Error response body:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Successful response data:', responseData);
      
      return responseData;
    } catch (error) {
      console.error('💥 Error creating horizon:', error);
      console.error('💥 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        horizonParams: horizon
      });
      throw error;
    }
  }

  async getHorizons(): Promise<HorizonItem[]> {
    try {
      const response = await fetch(`${this.baseUrl}/get-horizon`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching horizons:', error);
      throw error;
    }
  }

  async editHorizon(editRequest: EditHorizonRequest): Promise<HorizonItem> {
    try {
      const requestBody = {
        ...editRequest,
        ...(editRequest.new_type !== undefined && { 
          new_type: editRequest.new_type === null ? 'none' : editRequest.new_type 
        }),
        ...(editRequest.new_horizon_date !== undefined && { 
          new_horizon_date: editRequest.new_horizon_date === null ? 'null' : editRequest.new_horizon_date 
        })
      };

      console.log('🔄 Making edit-horizon API call');
      console.log('📍 URL:', `${this.baseUrl}/edit-horizon`);
      console.log('📋 Original edit request:', editRequest);
      console.log('📦 Request body being sent:', requestBody);
      console.log('🔍 new_horizon_date value:', editRequest.new_horizon_date);
      console.log('🔍 new_horizon_date type:', typeof editRequest.new_horizon_date);

      const response = await fetch(`${this.baseUrl}/edit-horizon`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Edit response status:', response.status);
      
      if (!response.ok) {
        console.error('❌ Edit HTTP error! status:', response.status);
        const errorText = await response.text();
        console.error('❌ Edit error response body:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Edit successful response data:', responseData);
      
      return responseData;
    } catch (error) {
      console.error('💥 Error editing horizon:', error);
      throw error;
    }
  }

  async deleteHorizonByTitle(title: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/delete-horizon-by-title`);
    url.searchParams.append('title', title);

    try {
      const response = await fetch(url.toString(), {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting horizon:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const horizonApiService = new HorizonApiService();
