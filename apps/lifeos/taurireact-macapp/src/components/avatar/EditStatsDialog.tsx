import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Briefcase, Users, GraduationCap, Wallet, Save, RotateCcw } from "lucide-react";
import { useAvatar, STAT_INFO, STAT_CATEGORIES, type LifeCategory } from "@/lib/contexts/AvatarContext";
import { toast } from "sonner";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Heart,
  Briefcase,
  Users,
  GraduationCap,
  Wallet,
};

interface EditStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStat?: LifeCategory;
}

export function EditStatsDialog({ open, onOpenChange, initialStat }: EditStatsDialogProps) {
  const { stats, updateAllStats, isLoading } = useAvatar();

  // Local state for editing
  const [editedStats, setEditedStats] = useState<Record<LifeCategory, number>>({
    health: 50,
    work: 50,
    social: 50,
    learning: 50,
    finance: 50,
  });
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state with actual stats when dialog opens
  useEffect(() => {
    if (open && stats) {
      setEditedStats({
        health: stats.health,
        work: stats.work,
        social: stats.social,
        learning: stats.learning,
        finance: stats.finance,
      });
      setNote("");
    }
  }, [open, stats]);

  const handleStatChange = (stat: LifeCategory, value: number[]) => {
    setEditedStats((prev) => ({
      ...prev,
      [stat]: value[0],
    }));
  };

  const handleReset = () => {
    if (stats) {
      setEditedStats({
        health: stats.health,
        work: stats.work,
        social: stats.social,
        learning: stats.learning,
        finance: stats.finance,
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateAllStats(editedStats, note || undefined);
      toast.success("Stats updated successfully!");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update stats");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = stats
    ? STAT_CATEGORIES.some((stat) => editedStats[stat] !== stats[stat])
    : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Life Stats</DialogTitle>
          <DialogDescription>
            Adjust your life category stats to reflect your current state.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {STAT_CATEGORIES.map((stat) => {
            const info = STAT_INFO[stat];
            const Icon = ICONS[info.icon];
            const value = editedStats[stat];
            const originalValue = stats?.[stat] ?? 50;
            const diff = value - originalValue;

            return (
              <div key={stat} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="p-1.5 rounded"
                      style={{ backgroundColor: `${info.color}20` }}
                    >
                      <div style={{ color: info.color }}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <Label className="font-medium">{info.label}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold tabular-nums">{value}</span>
                    {diff !== 0 && (
                      <span
                        className={`text-sm ${diff > 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff}
                      </span>
                    )}
                  </div>
                </div>
                <Slider
                  value={[value]}
                  onValueChange={(v: number[]) => handleStatChange(stat, v)}
                  max={100}
                  min={0}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">{info.description}</p>
              </div>
            );
          })}

          {/* Optional note */}
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="What changed? Why are you updating these stats?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
