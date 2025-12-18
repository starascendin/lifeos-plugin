import { useState, useEffect } from "react";
import { usePM, CycleDuration, CycleStartDay } from "@/lib/contexts/PMContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Wand2 } from "lucide-react";

interface CycleSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CycleSettingsModal({
  open,
  onOpenChange,
}: CycleSettingsModalProps) {
  const { userSettings, updateUserSettings, generateCycles, isLoadingUserSettings } = usePM();

  const [duration, setDuration] = useState<CycleDuration>("2_weeks");
  const [startDay, setStartDay] = useState<CycleStartDay>("monday");
  const [defaultCyclesToCreate, setDefaultCyclesToCreate] = useState(4);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cyclesToGenerate, setCyclesToGenerate] = useState(4);

  // Sync form state with loaded settings
  useEffect(() => {
    if (userSettings?.cycleSettings) {
      setDuration(userSettings.cycleSettings.duration);
      setStartDay(userSettings.cycleSettings.startDay);
      setDefaultCyclesToCreate(userSettings.cycleSettings.defaultCyclesToCreate);
      setCyclesToGenerate(userSettings.cycleSettings.defaultCyclesToCreate);
    }
  }, [userSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserSettings({
        cycleSettings: {
          duration,
          startDay,
          defaultCyclesToCreate,
        },
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateCycles = async () => {
    setIsGenerating(true);
    try {
      // First save settings if they've changed
      await updateUserSettings({
        cycleSettings: {
          duration,
          startDay,
          defaultCyclesToCreate,
        },
      });
      // Then generate cycles
      await generateCycles({
        count: cyclesToGenerate,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to generate cycles:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const durationLabel = duration === "1_week" ? "1 week" : "2 weeks";
  const startDayLabel = startDay === "sunday" ? "Sunday" : "Monday";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Cycle Settings
          </DialogTitle>
          <DialogDescription>
            Configure your global cycle preferences. These settings apply to all new cycles.
          </DialogDescription>
        </DialogHeader>

        {isLoadingUserSettings ? (
          <div className="flex h-32 items-center justify-center">
            <div className="text-muted-foreground">Loading settings...</div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Cycle Duration</Label>
              <Select
                value={duration}
                onValueChange={(value: CycleDuration) => setDuration(value)}
              >
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1_week">1 Week</SelectItem>
                  <SelectItem value="2_weeks">2 Weeks</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How long each cycle should last
              </p>
            </div>

            {/* Start Day */}
            <div className="space-y-2">
              <Label htmlFor="startDay">Start Day</Label>
              <Select
                value={startDay}
                onValueChange={(value: CycleStartDay) => setStartDay(value)}
              >
                <SelectTrigger id="startDay">
                  <SelectValue placeholder="Select start day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Which day of the week cycles start on
              </p>
            </div>

            {/* Default Cycles to Create */}
            <div className="space-y-2">
              <Label htmlFor="defaultCycles">Default Cycles to Create</Label>
              <Input
                id="defaultCycles"
                type="number"
                min={1}
                max={12}
                value={defaultCyclesToCreate}
                onChange={(e) =>
                  setDefaultCyclesToCreate(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))
                }
              />
              <p className="text-xs text-muted-foreground">
                Number of cycles to create when generating (1-12)
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full"
              variant="outline"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>

            <div className="border-t border-border" />

            {/* Generate Cycles Section */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Generate Cycles</h4>
                <p className="text-sm text-muted-foreground">
                  Auto-create multiple cycles starting from the next {startDayLabel}.
                  Each cycle will be {durationLabel} long.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="cyclesToGenerate">Number of Cycles</Label>
                  <Input
                    id="cyclesToGenerate"
                    type="number"
                    min={1}
                    max={12}
                    value={cyclesToGenerate}
                    onChange={(e) =>
                      setCyclesToGenerate(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))
                    }
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerateCycles}
                disabled={isGenerating}
                className="w-full gap-2"
              >
                <Wand2 className="h-4 w-4" />
                {isGenerating ? "Generating..." : `Generate ${cyclesToGenerate} Cycles`}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
