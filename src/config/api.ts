// API Configuration
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
} as const;

export const API_ENDPOINTS = {
  getEvents: '/get-events',
} as const;
