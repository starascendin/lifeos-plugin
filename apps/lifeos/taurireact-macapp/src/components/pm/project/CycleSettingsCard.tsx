import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Calendar, Play, Loader2 } from "lucide-react";
import type {
  CycleSettings,
  CycleDuration,
  CycleStartDay,
} from "@/lib/contexts/PMContext";

interface CycleSettingsCardProps {
  settings: CycleSettings | undefined;
  onChange: (settings: CycleSettings) => Promise<void>;
  onGenerateCycles: (count: number) => Promise<void>;
}

const DEFAULT_SETTINGS: CycleSettings = {
  duration: "2_weeks",
  startDay: "monday",
  defaultCyclesToCreate: 4,
};

export function CycleSettingsCard({
  settings,
  onChange,
  onGenerateCycles,
}: CycleSettingsCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentSettings = settings ?? DEFAULT_SETTINGS;

  const handleDurationChange = async (value: string) => {
    setIsUpdating(true);
    try {
      await onChange({
        ...currentSettings,
        duration: value as CycleDuration,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartDayChange = async (value: string) => {
    setIsUpdating(true);
    try {
      await onChange({
        ...currentSettings,
        startDay: value as CycleStartDay,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDefaultCountChange = async (value: string) => {
    const count = parseInt(value, 10);
    if (isNaN(count) || count < 1) return;

    setIsUpdating(true);
    try {
      await onChange({
        ...currentSettings,
        defaultCyclesToCreate: count,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGenerateCycles = async () => {
    setIsGenerating(true);
    try {
      await onGenerateCycles(currentSettings.defaultCyclesToCreate);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="h-4 w-4" />
          Cycle Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Duration */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Cycle Duration
          </Label>
          <Select
            value={currentSettings.duration}
            onValueChange={handleDurationChange}
            disabled={isUpdating}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1_week">1 Week</SelectItem>
              <SelectItem value="2_weeks">2 Weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Start Day */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Play className="h-4 w-4" />
            Start Day
          </Label>
          <Select
            value={currentSettings.startDay}
            onValueChange={handleStartDayChange}
            disabled={isUpdating}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sunday">Sunday</SelectItem>
              <SelectItem value="monday">Monday</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Default Cycles Count */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Default Cycles to Create
          </Label>
          <Input
            type="number"
            min={1}
            max={12}
            value={currentSettings.defaultCyclesToCreate}
            onChange={(e) => handleDefaultCountChange(e.target.value)}
            disabled={isUpdating}
            className="w-full"
          />
        </div>

        {/* Generate Cycles Button */}
        <div className="pt-2">
          <Button
            onClick={handleGenerateCycles}
            disabled={isGenerating || isUpdating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate {currentSettings.defaultCyclesToCreate} Cycles
              </>
            )}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Creates sequential cycles starting from the next{" "}
            {currentSettings.startDay === "sunday" ? "Sunday" : "Monday"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
