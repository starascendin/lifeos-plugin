import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ThumbsUp,
  AlertTriangle,
  ListChecks,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import type { CycleRetrospective, CycleStatus } from "@/lib/contexts/PMContext";

interface CycleRetrospectiveFormProps {
  retrospective: CycleRetrospective | undefined;
  onSave: (retrospective: CycleRetrospective) => Promise<void>;
  cycleStatus: CycleStatus;
}

export function CycleRetrospectiveForm({
  retrospective,
  onSave,
  cycleStatus,
}: CycleRetrospectiveFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<CycleRetrospective>({
    whatWentWell: "",
    whatCouldImprove: "",
    actionItems: [],
  });
  const [newActionItem, setNewActionItem] = useState("");

  const isEditable = cycleStatus === "active" || cycleStatus === "completed";

  const handleStartEdit = () => {
    setEditData({
      whatWentWell: retrospective?.whatWentWell ?? "",
      whatCouldImprove: retrospective?.whatCouldImprove ?? "",
      actionItems: retrospective?.actionItems ?? [],
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNewActionItem("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editData);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddActionItem = () => {
    if (newActionItem.trim()) {
      setEditData({
        ...editData,
        actionItems: [...(editData.actionItems ?? []), newActionItem.trim()],
      });
      setNewActionItem("");
    }
  };

  const handleRemoveActionItem = (index: number) => {
    setEditData({
      ...editData,
      actionItems: editData.actionItems?.filter((_, i) => i !== index),
    });
  };

  if (cycleStatus === "upcoming") {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-base">Retrospective</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Retrospective will be available once the cycle starts
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isEditing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Retrospective</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* What Went Well */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-green-600">
              <ThumbsUp className="h-4 w-4" />
              What Went Well
            </label>
            <Textarea
              value={editData.whatWentWell ?? ""}
              onChange={(e) =>
                setEditData({ ...editData, whatWentWell: e.target.value })
              }
              placeholder="What worked well this cycle?"
              className="min-h-[80px] resize-none"
              disabled={isSaving}
            />
          </div>

          {/* What Could Improve */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              What Could Improve
            </label>
            <Textarea
              value={editData.whatCouldImprove ?? ""}
              onChange={(e) =>
                setEditData({ ...editData, whatCouldImprove: e.target.value })
              }
              placeholder="What could be better next time?"
              className="min-h-[80px] resize-none"
              disabled={isSaving}
            />
          </div>

          {/* Action Items */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-blue-600">
              <ListChecks className="h-4 w-4" />
              Action Items
            </label>
            <div className="space-y-2">
              {editData.actionItems?.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2"
                >
                  <span className="flex-1 text-sm">{item}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveActionItem(index)}
                    disabled={isSaving}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  value={newActionItem}
                  onChange={(e) => setNewActionItem(e.target.value)}
                  placeholder="Add action item..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddActionItem();
                    }
                  }}
                  disabled={isSaving}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddActionItem}
                  disabled={isSaving || !newActionItem.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasRetrospective =
    retrospective?.whatWentWell ||
    retrospective?.whatCouldImprove ||
    (retrospective?.actionItems && retrospective.actionItems.length > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Retrospective</CardTitle>
        {isEditable && (
          <Button size="sm" variant="ghost" onClick={handleStartEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {hasRetrospective ? (
          <>
            {/* What Went Well */}
            {retrospective?.whatWentWell && (
              <div className="space-y-1">
                <h5 className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <ThumbsUp className="h-4 w-4" />
                  What Went Well
                </h5>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {retrospective.whatWentWell}
                </p>
              </div>
            )}

            {/* What Could Improve */}
            {retrospective?.whatCouldImprove && (
              <div className="space-y-1">
                <h5 className="flex items-center gap-2 text-sm font-medium text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  What Could Improve
                </h5>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {retrospective.whatCouldImprove}
                </p>
              </div>
            )}

            {/* Action Items */}
            {retrospective?.actionItems &&
              retrospective.actionItems.length > 0 && (
                <div className="space-y-1">
                  <h5 className="flex items-center gap-2 text-sm font-medium text-blue-600">
                    <ListChecks className="h-4 w-4" />
                    Action Items
                  </h5>
                  <ul className="space-y-1">
                    {retrospective.actionItems.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {cycleStatus === "active"
              ? "Add your retrospective notes as you work through the cycle"
              : "No retrospective recorded for this cycle"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
