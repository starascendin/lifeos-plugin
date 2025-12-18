import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useHabits,
  DAY_OF_WEEK_OPTIONS,
  type DayOfWeek,
  type HabitFrequency,
} from "@/lib/contexts/HabitsContext";

interface CreateHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HABIT_ICONS = [
  "✅", "🌅", "💪", "📚", "🎨", "🧘", "☀️", "🏃", "🎯", "⭐",
  "💧", "🔥", "💡", "🎵", "✨", "🌱", "💊", "🛏️", "📝", "🧠",
];

export function CreateHabitDialog({
  open,
  onOpenChange,
}: CreateHabitDialogProps) {
  const { createHabit, categories } = useHabits();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("✅");
  const [categoryId, setCategoryId] = useState<string>("");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [targetDays, setTargetDays] = useState<DayOfWeek[]>([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    setIsLoading(true);
    try {
      await createHabit({
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        categoryId: categoryId && categoryId !== "none" ? categoryId : undefined,
        frequency,
        targetDays: frequency === "weekly" ? targetDays : undefined,
      });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create habit:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setIcon("✅");
    setCategoryId("");
    setFrequency("daily");
    setTargetDays(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  };

  const toggleTargetDay = (day: DayOfWeek) => {
    setTargetDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Habit</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="habit-name">Habit Name</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Exercise"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="habit-description">Description (optional)</Label>
            <Textarea
              id="habit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="30 minutes of physical activity"
              rows={2}
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {HABIT_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-9 h-9 flex items-center justify-center rounded-md text-lg transition-colors ${
                    icon === emoji
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category (optional)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat._id} value={cat._id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as HabitFrequency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Specific days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target days (for weekly) */}
          {frequency === "weekly" && (
            <div className="space-y-2">
              <Label>Which days?</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_OF_WEEK_OPTIONS.map((day) => (
                  <label
                    key={day.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={targetDays.includes(day.value)}
                      onCheckedChange={() => toggleTargetDay(day.value)}
                    />
                    <span className="text-sm">{day.label.slice(0, 3)}</span>
                  </label>
                ))}
              </div>
              {targetDays.length === 0 && (
                <p className="text-xs text-destructive">
                  Select at least one day
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !name.trim() ||
                isLoading ||
                (frequency === "weekly" && targetDays.length === 0)
              }
            >
              {isLoading ? "Creating..." : "Create Habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
