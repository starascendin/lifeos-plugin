import { useAvatar, STAT_CATEGORIES, type LifeCategory } from "@/lib/contexts/AvatarContext";
import { StatPanel } from "./StatPanel";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trophy } from "lucide-react";

interface StatsOverlayProps {
  onStatClick?: (stat: LifeCategory) => void;
}

export function StatsOverlay({ onStatClick }: StatsOverlayProps) {
  const { stats, previousStats, isLoading } = useAvatar();

  if (isLoading || !stats) {
    return null;
  }

  const leftStats: LifeCategory[] = ["health", "work"];
  const rightStats: LifeCategory[] = ["social", "learning", "finance"];

  return (
    <>
      {/* Level Badge - Top Center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="px-4 py-2 text-lg font-bold bg-card/90 backdrop-blur-sm">
            <Trophy className="h-5 w-5 mr-2 text-yellow-500" />
            Level {stats.overallLevel}
          </Badge>
          <Badge variant="outline" className="px-3 py-2 bg-card/90 backdrop-blur-sm">
            <Sparkles className="h-4 w-4 mr-1 text-purple-500" />
            {stats.totalXP.toLocaleString()} XP
          </Badge>
        </div>
      </div>

      {/* Left Stats */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 space-y-3 w-56">
        {leftStats.map((stat) => (
          <StatPanel
            key={stat}
            stat={stat}
            value={stats[stat]}
            previousValue={previousStats?.[stat]}
            onClick={() => onStatClick?.(stat)}
          />
        ))}
      </div>

      {/* Right Stats */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 space-y-3 w-56">
        {rightStats.map((stat) => (
          <StatPanel
            key={stat}
            stat={stat}
            value={stats[stat]}
            previousValue={previousStats?.[stat]}
            onClick={() => onStatClick?.(stat)}
          />
        ))}
      </div>

      {/* Overall Progress - Bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-full px-4 py-2">
          <span className="text-sm text-muted-foreground">Overall:</span>
          <div className="flex gap-1">
            {STAT_CATEGORIES.map((stat) => {
              const value = stats[stat];
              const opacity = value / 100;
              return (
                <div
                  key={stat}
                  className="w-2 h-6 rounded-full"
                  style={{
                    backgroundColor: `hsl(${value > 60 ? 120 : value > 30 ? 45 : 0}, 70%, 50%)`,
                    opacity: 0.3 + opacity * 0.7,
                  }}
                />
              );
            })}
          </div>
          <span className="text-sm font-semibold">
            {Math.round(
              (stats.health + stats.work + stats.social + stats.learning + stats.finance) / 5
            )}
            %
          </span>
        </div>
      </div>
    </>
  );
}
