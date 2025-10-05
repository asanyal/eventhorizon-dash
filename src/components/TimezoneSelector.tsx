import { Clock, Sparkles } from 'lucide-react';
import { useSimpleView } from '../contexts/SimpleViewContext';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export const TimezoneSelector = () => {
  const { isSimpleView, toggleSimpleView } = useSimpleView();
  
  // Get system timezone
  const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

      {/* System Timezone Display */}
      <div className="flex items-center gap-2 px-3 h-8 rounded-md bg-productivity-surface border border-border">
        <Clock className="w-4 h-4 text-productivity-text-secondary" />
        <span className="text-xs text-productivity-text-primary font-medium">
          {systemTimezone}
        </span>
      </div>
    </div>
  );
};
