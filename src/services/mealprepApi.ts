import {
  Ingredient,
  CreateIngredientRequest,
  Meal,
  CreateMealRequest,
  WeeklyMealPlan,
  CreateWeeklyMealPlanRequest,
  UpdateWeeklyMealPlanRequest,
} from '../types/mealprep';
import { API_CONFIG } from '../config/api';

/**
 * Meal Prep API Service
 * Handles all API calls for ingredients, meals, and weekly meal planning
 */
export class MealPrepApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Normalize MongoDB's _id to id for frontend consistency
   */
  private normalizeId<T extends Record<string, any>>(item: T): T {
    if (item._id) {
      const { _id, ...rest } = item;
      return { ...rest, id: _id } as T;
    }
    return item;
  }

  /**
   * Normalize an array of items
   */
  private normalizeIds<T extends Record<string, any>>(items: T[]): T[] {
    return items.map(item => this.normalizeId(item));
  }

  // ===== INGREDIENTS =====

  /**
   * Get all ingredients
   */
  async getIngredients(): Promise<Ingredient[]> {
    const response = await fetch(`${this.baseUrl}/get-ingredients`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return this.normalizeIds(data);
  }

  /**
   * Create a new ingredient
   */
  async createIngredient(ingredient: CreateIngredientRequest): Promise<Ingredient> {
    const response = await fetch(`${this.baseUrl}/add-ingredient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ingredient),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return this.normalizeId(data);
  }

  /**
   * Delete an ingredient by ID
   */
  async deleteIngredient(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/delete-ingredient/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
  }

  // ===== MEALS =====

  /**
   * Get all meals
   */
  async getMeals(): Promise<Meal[]> {
    const response = await fetch(`${this.baseUrl}/get-meals`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return this.normalizeIds(data);
  }

  /**
   * Create a new meal
   */
  async createMeal(meal: CreateMealRequest): Promise<Meal> {
    const response = await fetch(`${this.baseUrl}/add-meal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meal),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return this.normalizeId(data);
  }

  /**
   * Delete a meal by ID
   */
  async deleteMeal(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/delete-meal/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  // ===== WEEKLY MEAL PLANS =====

  /**
   * Get weekly meal plan for a specific week
   * @param weekStartDate - Monday of the week in YYYY-MM-DD format
   */
  async getWeeklyMealPlan(weekStartDate: string): Promise<WeeklyMealPlan | null> {
    const url = new URL(`${this.baseUrl}/get-weekly-meal-plan`);
    url.searchParams.append('week_start_date', weekStartDate);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.status === 404) {
      return null; // No plan exists for this week
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return this.normalizeId(data);
  }

  /**
   * Create or update a weekly meal plan
   */
  async createOrUpdateWeeklyMealPlan(plan: CreateWeeklyMealPlanRequest): Promise<WeeklyMealPlan> {
    const response = await fetch(`${this.baseUrl}/upsert-weekly-meal-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return this.normalizeId(data);
  }

  /**
   * Update a specific meal slot in the weekly plan
   */
  async updateMealSlot(update: UpdateWeeklyMealPlanRequest): Promise<WeeklyMealPlan> {
    const response = await fetch(`${this.baseUrl}/update-meal-slot`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return this.normalizeId(data);
  }

  /**
   * Delete a weekly meal plan
   */
  async deleteWeeklyMealPlan(weekStartDate: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/delete-weekly-meal-plan`);
    url.searchParams.append('week_start_date', weekStartDate);

    const response = await fetch(url.toString(), {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }
}

export const mealPrepApiService = new MealPrepApiService();
