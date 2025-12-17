import { useState } from "react";
import { usePM } from "@/lib/contexts/PMContext";
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

interface CreateCycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCycleDialog({
  open,
  onOpenChange,
}: CreateCycleDialogProps) {
  const { createCycle } = usePM();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    return twoWeeksFromNow.toISOString().split("T")[0];
  });
  const [goals, setGoals] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const goalsArray = goals
        .split("\n")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      await createCycle({
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        startDate: new Date(startDate).getTime(),
        endDate: new Date(endDate).getTime(),
        goals: goalsArray.length > 0 ? goalsArray : undefined,
      });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create cycle:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    const today = new Date();
    setStartDate(today.toISOString().split("T")[0]);
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    setEndDate(twoWeeksFromNow.toISOString().split("T")[0]);
    setGoals("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Cycle</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 1, Q4 Cycle, etc."
            />
            <p className="text-xs text-muted-foreground">
              If empty, will be auto-numbered (Cycle 1, Cycle 2, etc.)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should this cycle accomplish?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goals">Goals (one per line, optional)</Label>
            <Textarea
              id="goals"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="Ship feature X&#10;Fix critical bugs&#10;Improve performance"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!startDate || !endDate || isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Cycle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
