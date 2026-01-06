import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerInputProps {
  value?: number; // timestamp
  onChange: (timestamp: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = "Set date",
  disabled = false,
  className,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);

  const formatDateForDisplay = (timestamp?: number): string => {
    // Explicitly check for undefined, null, or 0
    if (timestamp === undefined || timestamp === null || timestamp === 0) {
      return placeholder;
    }
    const date = new Date(timestamp);
    const currentYear = new Date().getFullYear();
    if (date.getFullYear() === currentYear) {
      return format(date, "MMM d");
    }
    return format(date, "MMM d, yyyy");
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange(null);
    } else {
      // Set to start of day in local timezone
      const localDate = new Date(date);
      localDate.setHours(0, 0, 0, 0);
      onChange(localDate.getTime());
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
  };

  // Convert timestamp to Date for the calendar (handle 0 as no value)
  const hasValue = value !== undefined && value !== null && value !== 0;
  const selectedDate = hasValue ? new Date(value) : undefined;
  // Default to current month if no date selected
  const defaultMonth = selectedDate || new Date();

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-8 justify-start gap-1.5 px-2 text-sm font-normal",
              !hasValue && "text-muted-foreground italic"
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            <span>{formatDateForDisplay(value)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            defaultMonth={defaultMonth}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
          onClick={handleClear}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
