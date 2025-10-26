import { useState, useEffect } from 'react';
import { Meal, CreateMealRequest, Ingredient } from '../types/mealprep';
import { mealPrepApiService } from '../services/mealprepApi';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cacheUtils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, RefreshCw, Plus, ChefHat, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Checkbox } from './ui/checkbox';

export const MealManager = () => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mealName, setMealName] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);

  useEffect(() => {
    // Clear cache on mount to ensure fresh data with normalized IDs
    cache.remove(CACHE_KEYS.MEALS);
    fetchMeals();
    fetchIngredients();
  }, []);

  const fetchMeals = async (forceRefresh = false) => {
    try {
      setRefreshing(true);

      if (!forceRefresh) {
        const cached = cache.get<Meal[]>(CACHE_KEYS.MEALS);
        if (cached) {
          console.log('📦 Using cached meals');
          setMeals(cached);
          setRefreshing(false);
          return;
        }
      }

      const data = await mealPrepApiService.getMeals();
      cache.set(CACHE_KEYS.MEALS, data, { ttl: CACHE_TTL.MEAL_PREP });
      setMeals(data);
    } catch (error) {
      console.error('Error fetching meals:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchIngredients = async () => {
    try {
      const cached = cache.get<Ingredient[]>(CACHE_KEYS.INGREDIENTS);
      if (cached) {
        setIngredients(cached);
        return;
      }

      const data = await mealPrepApiService.getIngredients();
      cache.set(CACHE_KEYS.INGREDIENTS, data, { ttl: CACHE_TTL.MEAL_PREP });
      setIngredients(data);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
    }
  };

  const handleOpenDialog = () => {
    setMealName('');
    setSelectedIngredients([]);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!mealName.trim()) return;

    setLoading(true);
    try {
      const newMeal: CreateMealRequest = {
        name: mealName.trim(),
        ingredients: selectedIngredients,
      };

      const created = await mealPrepApiService.createMeal(newMeal);
      setMeals([...meals, created]);
      cache.remove(CACHE_KEYS.MEALS);

      // Notify other components that meals have been updated
      window.dispatchEvent(new CustomEvent('meals-updated'));

      setIsDialogOpen(false);
      setMealName('');
      setSelectedIngredients([]);
    } catch (error) {
      console.error('Error creating meal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await mealPrepApiService.deleteMeal(id);
      setMeals(meals.filter((m) => m.id !== id));
      cache.remove(CACHE_KEYS.MEALS);

      // Notify other components that meals have been updated
      window.dispatchEvent(new CustomEvent('meals-updated'));
    } catch (error) {
      console.error('Error deleting meal:', error);
      alert(`Failed to delete meal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const toggleIngredient = (ingredientName: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(ingredientName)
        ? prev.filter((i) => i !== ingredientName)
        : [...prev, ingredientName]
    );
  };

  const getIngredientNames = (ingredientIds: string[]) => {
    // Ingredients might be stored as names directly or as IDs
    // For simplicity, we'll assume they're names
    return ingredientIds.join(', ');
  };

  return (
    <>
      <div className="bg-productivity-surface rounded-lg p-4 border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-productivity-text-secondary" />
            <h3 className="text-lg font-semibold text-productivity-text-primary">
              Meals
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleOpenDialog}
              className="h-9 text-sm px-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white border-0 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Meal
            </Button>
            <button
              onClick={() => fetchMeals(true)}
              disabled={refreshing}
              className="p-0.5 text-productivity-text-secondary hover:text-productivity-text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Meals List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {meals.length === 0 ? (
            <p className="text-sm text-productivity-text-tertiary text-center py-4">
              No meals yet. Create your first meal!
            </p>
          ) : (
            meals.map((meal) => (
              <div
                key={meal.id}
                className="p-3 rounded-lg border border-border hover:bg-background transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-productivity-text-primary mb-1">
                      {meal.name}
                    </p>
                    {meal.ingredients && meal.ingredients.length > 0 && (
                      <p className="text-xs text-productivity-text-tertiary">
                        {getIngredientNames(meal.ingredients)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => meal.id && handleDelete(meal.id)}
                    className="p-0.5 text-productivity-text-tertiary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {meals.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-productivity-text-tertiary">
              {meals.length} meal{meals.length !== 1 ? 's' : ''} created
            </p>
          </div>
        )}
      </div>

      {/* Add Meal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Meal</DialogTitle>
            <DialogDescription>
              Create a new meal by giving it a name and selecting ingredients.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-productivity-text-primary">
                Meal Name *
              </label>
              <Input
                type="text"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="e.g., Chicken Stir Fry"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-productivity-text-primary">
                Select Ingredients
              </label>
              <div className="max-h-48 overflow-y-auto space-y-2 border border-border rounded-lg p-3">
                {ingredients.length === 0 ? (
                  <p className="text-xs text-productivity-text-tertiary">
                    No ingredients available. Add some ingredients first!
                  </p>
                ) : (
                  ingredients.map((ingredient) => (
                    <div key={ingredient.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={ingredient.id}
                        checked={selectedIngredients.includes(ingredient.name)}
                        onCheckedChange={() => toggleIngredient(ingredient.name)}
                      />
                      <label
                        htmlFor={ingredient.id}
                        className="text-sm text-productivity-text-primary cursor-pointer flex-1"
                      >
                        {ingredient.name}
                        {(ingredient.quantity || ingredient.unit) && (
                          <span className="text-xs text-productivity-text-tertiary ml-2">
                            ({ingredient.quantity} {ingredient.unit})
                          </span>
                        )}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {selectedIngredients.length > 0 && (
                <p className="text-xs text-productivity-text-tertiary">
                  {selectedIngredients.length} ingredient{selectedIngredients.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={loading}
              className="h-8 text-sm"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !mealName.trim()} className="h-8 text-sm">
              {loading ? 'Creating...' : 'Create Meal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
