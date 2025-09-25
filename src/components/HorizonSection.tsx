import { useState, useEffect } from 'react';
import { HorizonItem, CreateHorizonRequest, EditHorizonRequest, HorizonType } from '../types/horizon';
import { horizonApiService } from '../services/horizonApi';
import { cn } from '../lib/utils';
import { X, RefreshCw, Plus, Pencil, HelpCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

// Helper function to format date as "Sep 23"
const formatDate = (dateString: string): string => {
  // Handle date-only strings (YYYY-MM-DD) as local dates to avoid timezone issues
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  
  // Handle full datetime strings normally
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Helper function to calculate days until event
const getDaysUntilEvent = (dateString: string): string => {
  let eventDate: Date;
  
  // Handle date-only strings (YYYY-MM-DD) as local dates
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    eventDate = new Date(year, month - 1, day); // month is 0-indexed
  } else {
    eventDate = new Date(dateString);
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
  eventDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
  
  const diffTime = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "In 1 day";
  } else if (diffDays > 1) {
    return `In ${diffDays} days`;
  } else if (diffDays === -1) {
    return "1 day ago";
  } else {
    return `${Math.abs(diffDays)} days ago`;
  }
};

export const HorizonSection = () => {
  const [horizons, setHorizons] = useState<HorizonItem[]>([]);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [selectedType, setSelectedType] = useState<HorizonType>(null);
  const [horizonDate, setHorizonDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHorizon, setEditingHorizon] = useState<HorizonItem | null>(null);
  const [originalTitle, setOriginalTitle] = useState('');
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [selectedFilters, setSelectedFilters] = useState<Set<'Event' | 'Meeting' | 'Others'>>(new Set());

  // Fetch horizons on component mount
  useEffect(() => {
    fetchHorizons();
  }, []);

  const fetchHorizons = async () => {
    try {
      const allHorizons = await horizonApiService.getHorizons();
      
      // Sort horizons by date - earliest first
      // Use valid horizon_date if present, otherwise fall back to created_at
      const sortedHorizons = allHorizons.sort((a, b) => {
        const validDateA = a.horizon_date && a.horizon_date !== 'null' ? a.horizon_date : a.created_at;
        const validDateB = b.horizon_date && b.horizon_date !== 'null' ? b.horizon_date : b.created_at;
        
        const dateA = new Date(validDateA || '');
        const dateB = new Date(validDateB || '');
        
        // Handle invalid dates by putting them at the end
        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        
        return dateA.getTime() - dateB.getTime();
      });
      
      setHorizons(sortedHorizons);
    } catch (error) {
      console.error('Error fetching horizons:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchHorizons();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      if (editingHorizon) {
        // Edit existing horizon
        const editRequest: EditHorizonRequest = {
          existing_title: originalTitle,
          new_title: title.trim(),
          new_details: details.trim(),
          new_type: selectedType,
          new_horizon_date: horizonDate === '' ? null : horizonDate
        };
        await horizonApiService.editHorizon(editRequest);
      } else {
        // Create new horizon
        const newHorizon: CreateHorizonRequest = {
          title: title.trim(),
          details: details.trim(),
          type: selectedType,
          horizon_date: horizonDate === '' ? null : horizonDate
        };
        await horizonApiService.createHorizon(newHorizon);
      }
      
      handleCloseModal();
      await fetchHorizons(); // Refresh the list
    } catch (error) {
      console.error('Error saving horizon:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setTitle('');
    setDetails('');
    setSelectedType(null);
    setHorizonDate('');
    setEditingHorizon(null);
    setOriginalTitle('');
    setIsModalOpen(false);
  };

  const handleEditHorizon = (horizon: HorizonItem) => {
    setEditingHorizon(horizon);
    setOriginalTitle(horizon.title);
    setTitle(horizon.title);
    setDetails(horizon.details);
    setSelectedType(horizon.type || null);
    setHorizonDate(horizon.horizon_date || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (horizonTitle: string) => {
    try {
      await horizonApiService.deleteHorizonByTitle(horizonTitle);
      // Refresh the list after successful deletion
      await fetchHorizons();
    } catch (error) {
      console.error('Error deleting horizon:', error);
    }
  };

  const toggleDetails = (horizonId: string) => {
    setExpandedDetails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(horizonId)) {
        newSet.delete(horizonId);
      } else {
        newSet.add(horizonId);
      }
      return newSet;
    });
  };

  const toggleFilter = (filterType: 'Event' | 'Meeting' | 'Others') => {
    setSelectedFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filterType)) {
        newSet.delete(filterType);
      } else {
        newSet.add(filterType);
      }
      return newSet;
    });
  };

  return (
    <div className="bg-productivity-surface rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-productivity-text-primary">
          Horizons
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 text-productivity-text-secondary hover:text-productivity-text-primary transition-colors"
            title="Refresh Horizons"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-1">
                <Plus className="w-4 h-4" />
                Add Horizon
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingHorizon ? 'Edit Horizon' : 'Add New Horizon'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="horizon-title" className="block text-sm font-medium text-productivity-text-primary mb-1">
                    Title
                  </label>
                  <Input
                    id="horizon-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter horizon title..."
                    className="w-full"
                    disabled={loading}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="horizon-details" className="block text-sm font-medium text-productivity-text-primary mb-1">
                    Details
                  </label>
                  <Textarea
                    id="horizon-details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Enter horizon details..."
                    className="w-full min-h-[100px]"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="horizon-date" className="block text-sm font-medium text-productivity-text-primary mb-1">
                    Date (optional)
                  </label>
                  <Input
                    id="horizon-date"
                    type="date"
                    value={horizonDate}
                    onChange={(e) => setHorizonDate(e.target.value)}
                    className="w-full"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-productivity-text-primary mb-2">
                    Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedType(selectedType === 'Event' ? null : 'Event')}
                      className={cn(
                        "px-3 py-1 text-sm font-medium rounded-full transition-colors",
                        selectedType === 'Event'
                          ? "bg-orange-500 text-white"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      )}
                      disabled={loading}
                    >
                      Event
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedType(selectedType === 'Meeting' ? null : 'Meeting')}
                      className={cn(
                        "px-3 py-1 text-sm font-medium rounded-full transition-colors",
                        selectedType === 'Meeting'
                          ? "bg-purple-300 text-white"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      )}
                      disabled={loading}
                    >
                      Meeting
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseModal}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !title.trim()}
                  >
                    {loading 
                      ? (editingHorizon ? 'Updating...' : 'Adding...') 
                      : (editingHorizon ? 'Update Horizon' : 'Add Horizon')
                    }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Chips */}
      {horizons.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-productivity-text-secondary font-medium">Filter by type:</span>
            <div className="flex gap-2">
              <button
                onClick={() => toggleFilter('Event')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                  selectedFilters.has('Event')
                    ? "bg-orange-500 text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                )}
              >
                Events
              </button>
              <button
                onClick={() => toggleFilter('Meeting')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                  selectedFilters.has('Meeting')
                    ? "bg-purple-300 text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                )}
              >
                Meetings
              </button>
              <button
                onClick={() => toggleFilter('Others')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                  selectedFilters.has('Others')
                    ? "bg-gray-500 text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                )}
              >
                Others
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Horizons List */}
      <div className="space-y-2">
        {horizons.length === 0 ? (
          <p className="text-sm text-productivity-text-tertiary">
            No horizons yet.
          </p>
        ) : (
          <div>
            {(() => {
              // Filter horizons based on selected filters
              const filteredHorizons = selectedFilters.size === 0 ? horizons : horizons.filter(horizon => {
                if (selectedFilters.has('Event') && horizon.type === 'Event') return true;
                if (selectedFilters.has('Meeting') && horizon.type === 'Meeting') return true;
                if (selectedFilters.has('Others') && horizon.type !== 'Event' && horizon.type !== 'Meeting') return true;
                return false;
              });
              
              return filteredHorizons.length === 0 ? (
                <p className="text-sm text-productivity-text-tertiary">
                  No horizons match the selected filters.
                </p>
              ) : filteredHorizons.map((horizon, index) => {
              const horizonId = horizon.id || `horizon-${index}`;
              const isExpanded = expandedDetails.has(horizonId);
              
              return (
                <div key={horizonId} className="space-y-1">
                  <div
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border border-border hover:bg-table-row-hover transition-colors",
                      horizon.type === 'Event' 
                        ? "bg-orange-50 hover:bg-orange-100"
                        : horizon.type === 'Meeting'
                        ? "bg-purple-50 hover:bg-purple-100"
                        : "bg-background"
                    )}
                  >
                    {/* Date */}
                    {(() => {
                      const validHorizonDate = horizon.horizon_date && horizon.horizon_date !== 'null' ? horizon.horizon_date : null;
                      const dateToShow = validHorizonDate || horizon.created_at;
                      return dateToShow && (
                        <div className="flex-shrink-0 text-xs text-productivity-text-tertiary">
                          {formatDate(dateToShow)}
                        </div>
                      );
                    })()}

                    {/* Title with clickable help icon */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <button
                        onClick={() => toggleDetails(horizonId)}
                        className="flex-shrink-0 p-1 text-productivity-text-tertiary hover:text-productivity-text-primary transition-colors"
                        title="Toggle details"
                      >
                        <HelpCircle className="w-3 h-3" />
                      </button>
                      <div className="text-productivity-text-primary text-xs break-words leading-tight">
                        {horizon.title}
                      </div>
                    </div>

                    {/* Days Until Date (for any horizon with a horizon_date) */}
                    {horizon.horizon_date && horizon.horizon_date !== 'null' && (
                      <div className="flex-shrink-0 text-xs text-red-500 font-medium">
                        {getDaysUntilEvent(horizon.horizon_date)}
                      </div>
                    )}

                    {/* Edit Button */}
                    <button
                      onClick={() => handleEditHorizon(horizon)}
                      className="p-1 text-productivity-text-tertiary hover:text-blue-500 transition-colors"
                      title={`Edit "${horizon.title}"`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(horizon.title)}
                      className="p-1 text-productivity-text-tertiary hover:text-red-500 transition-colors"
                      title={`Delete "${horizon.title}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="px-4 py-2 bg-gray-50 border border-border rounded text-xs text-productivity-text-secondary">
                      <p className="whitespace-pre-wrap">{horizon.details || 'No details available'}</p>
                    </div>
                  )}
                </div>
              );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
