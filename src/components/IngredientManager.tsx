import { useState, useEffect } from 'react';
import { Ingredient, CreateIngredientRequest } from '../types/mealprep';
import { mealPrepApiService } from '../services/mealprepApi';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cacheUtils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, RefreshCw, Plus, ShoppingCart } from 'lucide-react';
import { cn } from '../lib/utils';

export const IngredientManager = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Pastel colors for ingredient tags
  const pastelColors = [
    'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
    'bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300',
    'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
    'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300',
    'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  ];

  const getIngredientColor = (id: string) => {
    // Generate a consistent color based on the ingredient ID
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % pastelColors.length;
    return pastelColors[index];
  };

  useEffect(() => {
    // Clear cache on mount to ensure fresh data with normalized IDs
    cache.remove(CACHE_KEYS.INGREDIENTS);
    fetchIngredients();
  }, []);

  const fetchIngredients = async (forceRefresh = false) => {
    try {
      setRefreshing(true);

      if (!forceRefresh) {
        const cached = cache.get<Ingredient[]>(CACHE_KEYS.INGREDIENTS);
        if (cached) {
          setIngredients(cached);
          setRefreshing(false);
          return;
        }
      }

      const data = await mealPrepApiService.getIngredients();

      // Sort ingredients: Masala-related items first, then alphabetically
      const sorted = data.sort((a, b) => {
        const aIsMasala = a.name.toLowerCase().includes('masala');
        const bIsMasala = b.name.toLowerCase().includes('masala');

        if (aIsMasala && !bIsMasala) return -1;
        if (!aIsMasala && bIsMasala) return 1;
        return a.name.localeCompare(b.name);
      });

      cache.set(CACHE_KEYS.INGREDIENTS, sorted, { ttl: CACHE_TTL.MEAL_PREP });
      setIngredients(sorted);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const newIngredient: CreateIngredientRequest = {
        name: name.trim(),
        unit: unit.trim() || undefined,
      };

      const created = await mealPrepApiService.createIngredient(newIngredient);
      setIngredients([...ingredients, created]);
      cache.remove(CACHE_KEYS.INGREDIENTS);

      // Reset form
      setName('');
      setUnit('');
    } catch (error) {
      console.error('Error creating ingredient:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await mealPrepApiService.deleteIngredient(id);
      setIngredients(ingredients.filter((i) => i.id !== id));
      cache.remove(CACHE_KEYS.INGREDIENTS);
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      alert(`Failed to delete ingredient: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="bg-productivity-surface rounded-lg p-4 border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-productivity-text-secondary" />
          <h3 className="text-lg font-semibold text-productivity-text-primary">
            Ingredients
          </h3>
        </div>
        <button
          onClick={() => fetchIngredients(true)}
          disabled={refreshing}
          className="p-0.5 text-productivity-text-secondary hover:text-productivity-text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Add Ingredient Form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ingredient name *"
            disabled={loading}
            className="flex-1"
          />
          <Input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit"
            disabled={loading}
            className="w-24"
          />
          <Button
            type="submit"
            disabled={loading || !name.trim()}
            className="h-9 text-sm px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add
          </Button>
        </div>
      </form>

      {/* Ingredients List */}
      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
        {ingredients.length === 0 ? (
          <p className="text-sm text-productivity-text-tertiary text-center py-4 w-full">
            No ingredients yet. Add one to get started!
          </p>
        ) : (
          ingredients.map((ingredient) => (
            <div
              key={ingredient.id}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-transparent transition-colors group",
                getIngredientColor(ingredient.id)
              )}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-tight">
                  {ingredient.name}
                  {ingredient.unit && (
                    <span className="text-xs opacity-80 ml-1.5">({ingredient.unit})</span>
                  )}
                </span>
              </div>
              <button
                onClick={() => handleDelete(ingredient.id)}
                className="p-0.5 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {ingredients.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-productivity-text-tertiary">
            {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''} in your list
          </p>
        </div>
      )}
    </div>
  );
};
