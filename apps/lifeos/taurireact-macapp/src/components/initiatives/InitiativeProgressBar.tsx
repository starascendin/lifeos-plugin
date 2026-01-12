import { cn } from "@/lib/utils";

interface InitiativeProgressBarProps {
  progress: number;
  color?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function InitiativeProgressBar({
  progress,
  color = "#6366f1",
  size = "md",
  showLabel = true,
  className,
}: InitiativeProgressBarProps) {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  const heightClass = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  }[size];

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex-1 rounded-full bg-secondary overflow-hidden",
            heightClass,
          )}
        >
          <div
            className={cn("h-full rounded-full transition-all duration-500")}
            style={{
              width: `${clampedProgress}%`,
              backgroundColor: color,
            }}
          />
        </div>
        {showLabel && (
          <span className="text-xs font-medium text-muted-foreground min-w-[3ch] text-right">
            {Math.round(clampedProgress)}%
          </span>
        )}
      </div>
    </div>
  );
}

interface InitiativeProgressRingProps {
  progress: number;
  color?: string;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
}

export function InitiativeProgressRing({
  progress,
  color = "#6366f1",
  size = 48,
  strokeWidth = 4,
  showLabel = true,
  className,
}: InitiativeProgressRingProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-secondary"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      {showLabel && (
        <span className="absolute text-xs font-semibold">
          {Math.round(clampedProgress)}%
        </span>
      )}
    </div>
  );
}
