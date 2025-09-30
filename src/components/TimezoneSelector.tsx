import { Clock, Sparkles } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useTimezone, timezoneOptions } from '../contexts/TimezoneContext';
import { useSimpleView } from '../contexts/SimpleViewContext';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export const TimezoneSelector = () => {
  const { selectedTimezone, setTimezone } = useTimezone();
  const { isSimpleView, toggleSimpleView } = useSimpleView();

  return (
    <div className="flex items-center justify-end gap-3">
      {/* Simple View Toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggleSimpleView}
        className={cn(
          "h-8 px-3 text-xs font-medium transition-all duration-200",
          isSimpleView 
            ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600" 
            : "bg-productivity-surface border-border text-productivity-text-secondary hover:bg-table-row-hover hover:text-productivity-text-primary"
        )}
        title={isSimpleView ? "Detailed View" : "Simple View"}
      >
        <Sparkles className="w-3 h-3 mr-1" />
      </Button>

      {/* Timezone Selector */}
      <div className="flex items-center gap-2">
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
    </div>
  );
};
