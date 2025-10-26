import { IngredientManager } from './IngredientManager';
import { MealManager } from './MealManager';
import { WeeklyMealPlanner } from './WeeklyMealPlanner';

/**
 * MealPrepSection - Main component for the Meals section
 * Combines ingredient management, meal creation, and weekly planning
 */
export const MealPrepSection = () => {
  return (
    <div className="space-y-6">
      {/* Weekly Planner - Full Width */}
      <div className="w-full">
        <WeeklyMealPlanner />
      </div>

      {/* Ingredient and Meal Management - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IngredientManager />
        <MealManager />
      </div>
    </div>
  );
};
