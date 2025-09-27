import { Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useTimezone, timezoneOptions } from '../contexts/TimezoneContext';

export const TimezoneSelector = () => {
  const { selectedTimezone, setTimezone } = useTimezone();

  return (
    <div className="flex items-center justify-end gap-2">
      <Clock className="w-4 h-4 text-productivity-text-secondary" />
      <Select value={selectedTimezone} onValueChange={setTimezone}>
        <SelectTrigger className="w-[140px] h-8 text-xs bg-productivity-surface border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-productivity-surface border-border">
          {timezoneOptions.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="hover:bg-table-row-hover text-xs"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
