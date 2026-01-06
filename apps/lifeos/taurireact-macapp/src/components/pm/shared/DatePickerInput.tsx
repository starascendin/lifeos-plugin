import { useState } from "react";
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
  onChange: (timestamp?: number) => void;
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
    if (!timestamp) return placeholder;
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange(undefined);
    } else {
      // Set to start of day in local timezone
      const localDate = new Date(date);
      localDate.setHours(0, 0, 0, 0);
      onChange(localDate.getTime());
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  // Convert timestamp to Date for the calendar
  const selectedDate = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 justify-start gap-1.5 px-2 text-sm font-normal",
            !value && "text-muted-foreground italic",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          <span>{formatDateForDisplay(value)}</span>
          {value && (
            <X
              className="h-3 w-3 ml-1 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
