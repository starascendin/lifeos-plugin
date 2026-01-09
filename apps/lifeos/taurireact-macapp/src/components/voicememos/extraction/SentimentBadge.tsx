import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Sentiment = "positive" | "neutral" | "negative";

interface SentimentBadgeProps {
  sentiment: Sentiment;
  className?: string;
}

const sentimentConfig: Record<
  Sentiment,
  { label: string; className: string }
> = {
  positive: {
    label: "Positive",
    className: "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400",
  },
  neutral: {
    label: "Neutral",
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
  },
  negative: {
    label: "Negative",
    className: "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function SentimentBadge({ sentiment, className }: SentimentBadgeProps) {
  const config = sentimentConfig[sentiment];

  return (
    <Badge
      variant="secondary"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
