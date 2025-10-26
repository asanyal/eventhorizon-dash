/**
 * Meal Prep Types
 */

export interface Ingredient {
  id: string;
  name: string;
  quantity?: string | null;
  unit?: string | null;
  created_at?: string;
}

export interface CreateIngredientRequest {
  name: string;
  quantity?: string;
  unit?: string;
}

export interface Meal {
  id: string;
  name: string;
  ingredients: string[]; // Array of ingredient IDs or names
  created_at?: string;
}

export interface CreateMealRequest {
  name: string;
  ingredients: string[];
}

export type MealType = 'lunch' | 'dinner';

export interface WeeklyMealPlan {
  id: string;
  week_start_date: string; // YYYY-MM-DD format (Monday)
  sunday_lunch?: string; // Meal ID or name
  tuesday_lunch?: string; // Meal ID or name
  monday_dinner?: string; // Meal ID or name
  wednesday_dinner?: string; // Meal ID or name
  created_at?: string;
  updated_at?: string;
}

export interface CreateWeeklyMealPlanRequest {
  week_start_date: string;
  sunday_lunch?: string;
  tuesday_lunch?: string;
  monday_dinner?: string;
  wednesday_dinner?: string;
}

export interface UpdateWeeklyMealPlanRequest {
  week_start_date: string;
  day_field: 'sunday_lunch' | 'tuesday_lunch' | 'monday_dinner' | 'wednesday_dinner';
  meal_id?: string;
}

// Helper type for the drag-and-drop meal slots
export interface MealSlot {
  day: string;
  type: MealType;
  field: 'sunday_lunch' | 'tuesday_lunch' | 'monday_dinner' | 'wednesday_dinner';
  meal_id?: string;
  subtext?: string;
  isVegetarian?: boolean;
}
