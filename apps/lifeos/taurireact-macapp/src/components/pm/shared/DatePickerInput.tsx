import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const formatDateForInput = (timestamp?: number): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toISOString().split("T")[0];
  };

  const formatDateForDisplay = (timestamp?: number): string => {
    if (!timestamp) return placeholder;
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value;
    if (!dateStr) {
      onChange(undefined);
      return;
    }
    const date = new Date(dateStr + "T00:00:00");
    onChange(date.getTime());
  };

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
        <Calendar className="h-4 w-4" />
        <span className={cn(!value && "italic")}>{formatDateForDisplay(value)}</span>
      </div>
      <input
        type="date"
        value={formatDateForInput(value)}
        onChange={handleChange}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}
