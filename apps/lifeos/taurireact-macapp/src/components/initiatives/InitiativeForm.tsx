import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  useInitiatives,
  INITIATIVE_CATEGORIES,
  type InitiativeCategory,
} from "@/lib/contexts/InitiativesContext";
import type { Doc } from "@holaai/convex";
import {
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
  Loader2,
} from "lucide-react";

// Icon mapping for categories
const CategoryIcons = {
  Briefcase,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Sparkles,
} as const;

// Common emoji options for quick selection
const EMOJI_OPTIONS = [
  "🎯",
  "🚀",
  "💪",
  "📚",
  "💰",
  "❤️",
  "🧠",
  "🏃",
  "✨",
  "🌟",
  "🔥",
  "💡",
  "🎨",
  "🎵",
  "🌱",
  "🏆",
  "📈",
  "🤝",
  "🌍",
  "⚡",
];

interface InitiativeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiative?: Doc<"lifeos_yearlyInitiatives"> | null;
}

export function InitiativeForm({
  open,
  onOpenChange,
  initiative,
}: InitiativeFormProps) {
  const { selectedYear, createInitiative, updateInitiative } = useInitiatives();
  const isEditing = !!initiative;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<InitiativeCategory>("personal");
  const [targetMetric, setTargetMetric] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");
  const [useManualProgress, setUseManualProgress] = useState(false);
  const [manualProgress, setManualProgress] = useState(0);
  const [status, setStatus] = useState<
    "active" | "paused" | "completed" | "cancelled"
  >("active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes or initiative changes
  useEffect(() => {
    if (open) {
      if (initiative) {
        setTitle(initiative.title);
        setDescription(initiative.description || "");
        setCategory(initiative.category as InitiativeCategory);
        setTargetMetric(initiative.targetMetric || "");
        setIcon(initiative.icon || "");
        setColor(initiative.color || "");
        setUseManualProgress(initiative.manualProgress !== undefined);
        setManualProgress(
          initiative.manualProgress ?? initiative.autoProgress ?? 0,
        );
        setStatus(initiative.status);
      } else {
        // Reset to defaults for new initiative
        setTitle("");
        setDescription("");
        setCategory("personal");
        setTargetMetric("");
        setIcon("");
        setColor("");
        setUseManualProgress(false);
        setManualProgress(0);
        setStatus("active");
      }
    }
  }, [open, initiative]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      if (isEditing && initiative) {
        await updateInitiative({
          initiativeId: initiative._id,
          title: title.trim(),
          description: description.trim() || null,
          category,
          targetMetric: targetMetric.trim() || null,
          icon: icon || null,
          color: color || null,
          manualProgress: useManualProgress ? manualProgress : null,
          status,
        });
      } else {
        await createInitiative({
          year: selectedYear,
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          targetMetric: targetMetric.trim() || undefined,
          icon: icon || undefined,
          color: color || undefined,
          manualProgress: useManualProgress ? manualProgress : undefined,
          status,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save initiative:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryMeta = INITIATIVE_CATEGORIES[category];
  const IconComponent =
    CategoryIcons[categoryMeta.icon as keyof typeof CategoryIcons] || Sparkles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Initiative" : `New ${selectedYear} Initiative`}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update your yearly initiative details."
                : "Create a new yearly initiative to track your goals."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Master TypeScript"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What do you want to achieve?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Category & Status Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as InitiativeCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INITIATIVE_CATEGORIES).map(
                      ([key, meta]) => {
                        const Icon =
                          CategoryIcons[
                            meta.icon as keyof typeof CategoryIcons
                          ] || Sparkles;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon
                                className="h-4 w-4"
                                style={{ color: meta.color }}
                              />
                              {meta.label}
                            </div>
                          </SelectItem>
                        );
                      },
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as typeof status)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target Metric */}
            <div className="grid gap-2">
              <Label htmlFor="targetMetric">Target Metric</Label>
              <Input
                id="targetMetric"
                placeholder="e.g., Complete 3 projects, Run 500 miles"
                value={targetMetric}
                onChange={(e) => setTargetMetric(e.target.value)}
              />
            </div>

            {/* Icon Selection */}
            <div className="grid gap-2">
              <Label>Icon (optional)</Label>
              <div className="flex flex-wrap gap-1">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(icon === emoji ? "" : emoji)}
                    className={`h-8 w-8 text-lg rounded hover:bg-accent transition-colors ${
                      icon === emoji ? "bg-accent ring-2 ring-primary" : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Or type custom emoji/text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="mt-1"
                maxLength={4}
              />
            </div>

            {/* Color Override */}
            <div className="grid gap-2">
              <Label htmlFor="color">Custom Color (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={color || categoryMeta.color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 p-1 cursor-pointer"
                />
                <Input
                  value={color || ""}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder={`Default: ${categoryMeta.color}`}
                  className="flex-1"
                />
                {color && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setColor("")}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Manual Progress Override */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Manual Progress Override</Label>
                <Switch
                  checked={useManualProgress}
                  onCheckedChange={setUseManualProgress}
                />
              </div>
              {useManualProgress && (
                <div className="flex items-center gap-4">
                  <Slider
                    value={[manualProgress]}
                    onValueChange={([v]) => setManualProgress(v)}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12 text-right">
                    {manualProgress}%
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {useManualProgress
                  ? "Using manual progress. Auto-calculation from tasks is disabled."
                  : "Progress is auto-calculated from linked project task completion."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isEditing ? "Save Changes" : "Create Initiative"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
