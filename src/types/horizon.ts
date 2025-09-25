export type HorizonType = 'Event' | 'Meeting' | 'none' | null;

export interface HorizonItem {
  id?: string;
  title: string;
  details: string;
  type?: HorizonType;
  created_at?: string;
  horizon_date?: string | null;
}

export interface CreateHorizonRequest {
  title: string;
  details: string;
  type?: HorizonType;
  horizon_date?: string | null;
}

export interface EditHorizonRequest {
  existing_title: string;
  new_title: string;
  new_details: string;
  new_type?: HorizonType;
  new_horizon_date?: string | null;
}
