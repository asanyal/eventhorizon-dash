import { TimeFilter } from '../types/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface TimeFilterDropdownProps {
  value: TimeFilter;
  onChange: (value: TimeFilter) => void;
  isDateSelected?: boolean;
}

const timeFilterOptions: { value: TimeFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'day-after', label: 'Day After' },
  { value: '2-days-after', label: '2 Days After' },
  { value: 'this-week', label: 'This Week' },
  { value: 'next-week', label: 'Next Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'next-month', label: 'Next Month' },
];

export const TimeFilterDropdown = ({ value, onChange, isDateSelected = false }: TimeFilterDropdownProps) => {
  return (
    <div className="min-w-[140px]">
      <Select value={isDateSelected ? '' : value} onValueChange={onChange}>
        <SelectTrigger className="bg-productivity-surface border-border">
          <SelectValue placeholder={isDateSelected ? "Date selected" : "Select time period"} />
        </SelectTrigger>
        <SelectContent className="bg-productivity-surface border-border">
          {timeFilterOptions.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="hover:bg-table-row-hover"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};