import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Heart, Briefcase, Users, GraduationCap, Wallet, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LifeCategory, StatInfo } from "@/lib/contexts/AvatarContext";
import { STAT_INFO } from "@/lib/contexts/AvatarContext";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Heart,
  Briefcase,
  Users,
  GraduationCap,
  Wallet,
};

interface StatPanelProps {
  stat: LifeCategory;
  value: number;
  previousValue?: number;
  onClick?: () => void;
  compact?: boolean;
}

function getTrend(current: number, previous: number | undefined): "up" | "down" | "stable" {
  if (previous === undefined) return "stable";
  const diff = current - previous;
  if (diff > 2) return "up";
  if (diff < -2) return "down";
  return "stable";
}

function getValueColor(value: number): string {
  if (value >= 70) return "text-green-500";
  if (value >= 40) return "text-yellow-500";
  return "text-red-500";
}

export function StatPanel({ stat, value, previousValue, onClick, compact = false }: StatPanelProps) {
  const info = STAT_INFO[stat];
  const Icon = ICONS[info.icon];
  const trend = getTrend(value, previousValue);

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg bg-card/80 backdrop-blur-sm px-3 py-2 cursor-pointer hover:bg-card transition-colors",
          onClick && "cursor-pointer"
        )}
        onClick={onClick}
      >
        <div style={{ color: info.color }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <Progress value={value} className="h-2" />
        </div>
        <span className={cn("text-sm font-medium tabular-nums", getValueColor(value))}>
          {value}
        </span>
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "bg-card/80 backdrop-blur-sm border-none shadow-lg transition-all hover:scale-[1.02]",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${info.color}20` }}
            >
              <div style={{ color: info.color }}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm">{info.label}</h3>
              <p className="text-xs text-muted-foreground">{info.description}</p>
            </div>
          </div>

          {/* Trend indicator */}
          <div className="flex items-center gap-1">
            {trend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
            {trend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
            {trend === "stable" && <Minus className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={cn("text-2xl font-bold tabular-nums", getValueColor(value))}>
              {value}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
          <Progress
            value={value}
            className="h-2"
            style={
              {
                "--progress-foreground": info.color,
              } as React.CSSProperties
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
