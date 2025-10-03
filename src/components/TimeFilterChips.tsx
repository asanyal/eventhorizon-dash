import { TimeFilter } from '../types/calendar';
import { cn } from '../lib/utils';

interface TimeFilterChipsProps {
  value: TimeFilter;
  onChange: (value: TimeFilter) => void;
  isDateSelected?: boolean;
}

const timeFilterOptions: { value: TimeFilter; label: string; abbreviation: string }[] = [
  { value: 'today', label: 'Today', abbreviation: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow', abbreviation: '1d' },
  { value: 'day-after', label: 'Day After', abbreviation: '2d' },
  { value: '2-days-after', label: '2 Days After', abbreviation: '3d' },
  { value: 'this-week', label: 'This Week', abbreviation: 'TW' },
  { value: 'next-week', label: 'Next Week', abbreviation: 'NW' },
  { value: 'this-month', label: 'This Month', abbreviation: 'TM' },
  { value: 'next-month', label: 'Next Month', abbreviation: 'NM' },
];

export const TimeFilterChips = ({ value, onChange, isDateSelected = false }: TimeFilterChipsProps) => {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {timeFilterOptions.map((option) => {
        const isSelected = !isDateSelected && value === option.value;
        
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 min-w-[32px] h-7 flex items-center justify-center",
              isSelected
                ? "bg-blue-500 text-white shadow-sm"
                : isDateSelected
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
            )}
            title={`${option.label}${isDateSelected ? ' (Date selected)' : ''}`}
            disabled={isDateSelected}
          >
            {option.abbreviation}
          </button>
        );
      })}
    </div>
  );
};

