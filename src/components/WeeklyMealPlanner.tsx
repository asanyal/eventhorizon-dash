import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Meal, WeeklyMealPlan, MealSlot } from '../types/mealprep';
import { mealPrepApiService } from '../services/mealprepApi';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cacheUtils';
import { Button } from './ui/button';
import { Calendar, GripVertical, X, ChevronLeft, ChevronRight, RefreshCw, Leaf, Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export const WeeklyMealPlanner = () => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  );
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isMealDialogOpen, setIsMealDialogOpen] = useState(false);
  const [isIngredientsListOpen, setIsIngredientsListOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Clear cache on mount to ensure fresh data with normalized IDs
    cache.remove(CACHE_KEYS.MEALS);
    fetchMeals();

    // Listen for meal updates from other components
    const handleMealsUpdated = () => {
      fetchMeals();
    };

    window.addEventListener('meals-updated', handleMealsUpdated);
    return () => window.removeEventListener('meals-updated', handleMealsUpdated);
  }, []);

  useEffect(() => {
    fetchWeeklyPlan();
  }, [currentWeekStart]);

  const fetchMeals = async () => {
    try {
      const cached = cache.get<Meal[]>(CACHE_KEYS.MEALS);
      if (cached) {
        console.log('🍽️ Using cached meals:', cached);
        setMeals(cached);
        return;
      }

      const data = await mealPrepApiService.getMeals();
      console.log('🍽️ Fetched meals from API:', data);
      cache.set(CACHE_KEYS.MEALS, data, { ttl: CACHE_TTL.MEAL_PREP });
      setMeals(data);
    } catch (error) {
      console.error('Error fetching meals:', error);
    }
  };

  const fetchWeeklyPlan = async (forceRefresh = false) => {
    try {
      setRefreshing(true);
      const weekStartDate = format(currentWeekStart, 'yyyy-MM-dd');

      if (!forceRefresh) {
        const cached = cache.get<WeeklyMealPlan>(CACHE_KEYS.WEEKLY_MEAL_PLAN(weekStartDate));
        if (cached) {
          console.log('📦 Using cached weekly meal plan');
          setWeeklyPlan(cached);
          setRefreshing(false);
          return;
        }
      }

      const plan = await mealPrepApiService.getWeeklyMealPlan(weekStartDate);
      if (plan) {
        cache.set(CACHE_KEYS.WEEKLY_MEAL_PLAN(weekStartDate), plan, { ttl: CACHE_TTL.MEAL_PREP });
        setWeeklyPlan(plan);
      } else {
        setWeeklyPlan(null);
      }
    } catch (error) {
      console.error('Error fetching weekly plan:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getMealById = (mealId: string | undefined): Meal | undefined => {
    if (!mealId) return undefined;
    return meals.find((m) => m.id === mealId || m.name === mealId);
  };

  const handleMealClick = (meal: Meal) => {
    setSelectedMeal(meal);
    setIsMealDialogOpen(true);
  };

  const getAllIngredients = (): string[] => {
    const allIngredients = new Set<string>();

    mealSlots.forEach((slot) => {
      const meal = getMealById(slot.meal_id);
      if (meal?.ingredients) {
        meal.ingredients.forEach((ingredient) => {
          allIngredients.add(ingredient);
        });
      }
    });

    return Array.from(allIngredients).sort();
  };

  const handleCopyIngredients = async () => {
    const ingredients = getAllIngredients().join(', ');
    try {
      await navigator.clipboard.writeText(ingredients);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy ingredients:', error);
    }
  };

  const toggleIngredient = (ingredient: string) => {
    setCheckedIngredients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ingredient)) {
        newSet.delete(ingredient);
      } else {
        newSet.add(ingredient);
      }
      return newSet;
    });
  };

  const clearCheckedIngredients = () => {
    setCheckedIngredients(new Set());
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination } = result;

    console.log('🎯 Drag ended:', { source, destination, draggableId: result.draggableId });

    // Dropped outside a valid droppable area
    if (!destination) {
      console.log('❌ No destination - dropped outside');
      return;
    }

    // Dropped in the same place
    if (source.droppableId === destination.droppableId) {
      console.log('❌ Same place - no change');
      return;
    }

    // Get the meal being dragged
    const mealId = result.draggableId;
    console.log('📦 Meal ID being dragged:', mealId);

    // Determine which slot to update
    const slotField = destination.droppableId as
      | 'sunday_lunch'
      | 'tuesday_lunch'
      | 'monday_dinner'
      | 'wednesday_dinner';

    console.log('🎯 Target slot:', slotField);

    try {
      setLoading(true);
      const weekStartDate = format(currentWeekStart, 'yyyy-MM-dd');
      console.log('📅 Week start date:', weekStartDate);

      console.log('🚀 Calling API with:', {
        week_start_date: weekStartDate,
        day_field: slotField,
        meal_id: mealId,
      });

      // Update the meal slot
      const updatedPlan = await mealPrepApiService.updateMealSlot({
        week_start_date: weekStartDate,
        day_field: slotField,
        meal_id: mealId,
      });

      console.log('✅ API response:', updatedPlan);
      setWeeklyPlan(updatedPlan);
      cache.remove(CACHE_KEYS.WEEKLY_MEAL_PLAN(weekStartDate));
      console.log('🗑️ Cache cleared for:', weekStartDate);
    } catch (error) {
      console.error('💥 Error updating meal slot:', error);
      // Show error to user
      alert('Failed to update meal plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMeal = async (
    slotField: 'sunday_lunch' | 'tuesday_lunch' | 'monday_dinner' | 'wednesday_dinner'
  ) => {
    try {
      setLoading(true);
      const weekStartDate = format(currentWeekStart, 'yyyy-MM-dd');

      // Update with empty meal_id to remove
      const updatedPlan = await mealPrepApiService.updateMealSlot({
        week_start_date: weekStartDate,
        day_field: slotField,
        meal_id: undefined,
      });

      setWeeklyPlan(updatedPlan);
      cache.remove(CACHE_KEYS.WEEKLY_MEAL_PLAN(weekStartDate));
    } catch (error) {
      console.error('Error removing meal:', error);
    } finally {
      setLoading(false);
    }
  };

  const mealSlots: MealSlot[] = [
    { day: 'Sunday Cooking', type: 'lunch', field: 'sunday_lunch', meal_id: weeklyPlan?.sunday_lunch, subtext: 'Lunch for Mon, Tue' },
    { day: 'Tuesday Cooking', type: 'lunch', field: 'tuesday_lunch', meal_id: weeklyPlan?.tuesday_lunch, subtext: 'Lunch for Wed, Thu' },
    { day: 'Monday Cooking', type: 'dinner', field: 'monday_dinner', meal_id: weeklyPlan?.monday_dinner, isVegetarian: true },
    {
      day: 'Wednesday Cooking',
      type: 'dinner',
      field: 'wednesday_dinner',
      meal_id: weeklyPlan?.wednesday_dinner,
      isVegetarian: true,
    },
  ];

  return (
    <div className="bg-productivity-surface rounded-lg p-4 border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-productivity-text-secondary" />
          <h3 className="text-lg font-semibold text-productivity-text-primary">
            Weekly Meal Plan
          </h3>
        </div>
        <button
          onClick={() => fetchWeeklyPlan(true)}
          disabled={refreshing}
          className="p-0.5 text-productivity-text-secondary hover:text-productivity-text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center gap-2 mb-4 px-2 py-1 bg-background rounded-lg border border-border w-fit">
        <button
          onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
          className="p-0.5 text-productivity-text-secondary hover:text-productivity-text-primary transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-medium text-productivity-text-primary">
          Week of {format(currentWeekStart, 'MMM d, yyyy')}
        </span>
        <button
          onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
          className="p-0.5 text-productivity-text-secondary hover:text-productivity-text-primary transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4">
          {/* Meals List (Draggable Source) */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-productivity-text-secondary">
              Available Meals
            </h4>
            <Droppable droppableId="meals-list" isDropDisabled>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="min-h-[100px] max-h-[200px] overflow-y-auto p-3 bg-background rounded-lg border border-border"
                >
                  {meals.length === 0 ? (
                    <p className="text-xs text-productivity-text-tertiary text-center py-2">
                      No meals available. Create some meals first!
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {meals.map((meal, index) => (
                        <Draggable
                          key={meal.id || meal.name}
                          draggableId={meal.id || meal.name}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                'flex items-center gap-1.5 px-2 py-1.5 rounded-full border border-border bg-productivity-surface transition-all text-xs',
                                snapshot.isDragging && 'shadow-lg scale-105 z-50 opacity-90'
                              )}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing flex-shrink-0">
                                <GripVertical className="w-3 h-3 text-productivity-text-tertiary" />
                              </div>
                              <span className="text-productivity-text-primary truncate">
                                {meal.name}
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </div>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Meal Slots Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-productivity-text-secondary">
                This Week's Plan
              </h4>
              <Button
                onClick={() => setIsIngredientsListOpen(true)}
                variant="outline"
                className="h-7 text-xs px-2"
                disabled={getAllIngredients().length === 0}
              >
                Show Ingredients
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mealSlots.map((slot) => {
                const assignedMeal = getMealById(slot.meal_id);
                return (
                  <Droppable key={slot.field} droppableId={slot.field}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={cn(
                          'p-3 rounded-lg border-2 border-dashed transition-all min-h-[80px]',
                          snapshot.isDraggingOver
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                            : 'border-border bg-background'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <div>
                              <p className="text-xs font-semibold text-productivity-text-primary flex items-center gap-1.5">
                                {slot.day}
                                {slot.isVegetarian && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" title="Vegetarian/Pescetarian only">
                                    <Leaf className="w-3 h-3" />
                                    <span className="text-[10px] font-medium">V/P</span>
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-productivity-text-tertiary">
                                {slot.subtext || slot.type.charAt(0).toUpperCase() + slot.type.slice(1)}
                              </p>
                            </div>
                          </div>
                          {assignedMeal && (
                            <button
                              onClick={() => handleRemoveMeal(slot.field)}
                              className="p-0.5 text-productivity-text-tertiary hover:text-red-500 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {assignedMeal ? (
                          <div
                            onClick={() => handleMealClick(assignedMeal)}
                            className="p-2 bg-productivity-surface rounded border border-border cursor-pointer hover:bg-background hover:border-productivity-text-tertiary transition-colors"
                          >
                            <p className="text-sm font-medium text-productivity-text-primary">
                              {assignedMeal.name}
                            </p>
                            {assignedMeal.ingredients && assignedMeal.ingredients.length > 0 && (
                              <p className="text-xs text-productivity-text-tertiary mt-1">
                                {assignedMeal.ingredients.slice(0, 2).join(', ')}
                                {assignedMeal.ingredients.length > 2 && '...'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-productivity-text-tertiary italic">
                            Drag a meal here
                          </p>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </div>
        </div>
      </DragDropContext>

      {/* Summary */}
      {weeklyPlan && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-productivity-text-tertiary">
            {Object.values(weeklyPlan).filter((v) => v && typeof v === 'string' && v !== weeklyPlan.week_start_date).length}{' '}
            meal{Object.values(weeklyPlan).filter((v) => v && typeof v === 'string' && v !== weeklyPlan.week_start_date).length !== 1 ? 's' : ''} planned for this week
          </p>
        </div>
      )}

      {/* Meal Details Dialog */}
      <Dialog open={isMealDialogOpen} onOpenChange={setIsMealDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedMeal?.name}</DialogTitle>
            <DialogDescription>
              Full meal details and ingredients
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <h4 className="text-sm font-semibold text-productivity-text-primary mb-3">
              Ingredients
            </h4>
            {selectedMeal?.ingredients && selectedMeal.ingredients.length > 0 ? (
              <ul className="space-y-2">
                {selectedMeal.ingredients.map((ingredient, index) => (
                  <li
                    key={index}
                    className="text-sm text-productivity-text-primary flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-productivity-text-tertiary"></span>
                    {ingredient}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-productivity-text-tertiary">
                No ingredients listed for this meal.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* All Ingredients List Dialog */}
      <Dialog open={isIngredientsListOpen} onOpenChange={setIsIngredientsListOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>All Ingredients for This Week</span>
              <div className="flex items-center gap-2">
                {getAllIngredients().length > 0 && checkedIngredients.size > 0 && (
                  <Button
                    onClick={clearCheckedIngredients}
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                  >
                    Clear
                  </Button>
                )}
                {getAllIngredients().length > 0 && (
                  <Button
                    onClick={handleCopyIngredients}
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy
                      </>
                    )}
                  </Button>
                )}
              </div>
            </DialogTitle>
            <DialogDescription>
              Complete shopping list for all planned meals
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-[400px] overflow-y-auto">
            {getAllIngredients().length > 0 ? (
              <div className="space-y-2">
                {getAllIngredients().map((ingredient, index) => (
                  <label
                    key={index}
                    className="flex items-center gap-3 p-2 rounded hover:bg-background cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checkedIngredients.has(ingredient)}
                      onChange={() => toggleIngredient(ingredient)}
                      className="w-4 h-4 text-blue-500 bg-white border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className={cn(
                      "text-sm text-productivity-text-primary",
                      checkedIngredients.has(ingredient) && "line-through text-productivity-text-tertiary"
                    )}>
                      {ingredient}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-productivity-text-tertiary">
                No meals planned yet. Add some meals to see ingredients.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
