import { useState } from "react";
import { useFRM, RelationshipType } from "@/lib/contexts/FRMContext";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Id } from "@holaai/convex";

interface AddPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPersonCreated?: (personId: Id<"lifeos_frmPeople">) => void;
}

const EMOJI_OPTIONS = [
  "😊", "😎", "🤓", "🧑‍💼", "👨‍💻", "👩‍🎓", "🧑‍🔬", "👨‍🍳",
  "🎨", "🎸", "⚽", "🏃", "🧘", "💼", "🎭", "🌟",
];

const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: "family", label: "Family" },
  { value: "friend", label: "Friend" },
  { value: "colleague", label: "Colleague" },
  { value: "acquaintance", label: "Acquaintance" },
  { value: "mentor", label: "Mentor" },
  { value: "other", label: "Other" },
];

export function AddPersonDialog({
  open,
  onOpenChange,
  onPersonCreated,
}: AddPersonDialogProps) {
  const { createPerson } = useFRM();

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [relationshipType, setRelationshipType] = useState<
    RelationshipType | ""
  >("");
  const [avatarEmoji, setAvatarEmoji] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const personId = await createPerson({
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        relationshipType: relationshipType || undefined,
        avatarEmoji: avatarEmoji || undefined,
        notes: notes.trim() || undefined,
      });

      // Reset form
      setName("");
      setNickname("");
      setRelationshipType("");
      setAvatarEmoji("");
      setNotes("");

      onPersonCreated?.(personId);
    } catch (error) {
      console.error("Failed to create person:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName("");
      setNickname("");
      setRelationshipType("");
      setAvatarEmoji("");
      setNotes("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Person</DialogTitle>
            <DialogDescription>
              Add someone to track your relationship. Start with just a name -
              you can add more details later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                autoFocus
              />
            </div>

            {/* Nickname */}
            <div className="grid gap-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Johnny"
              />
            </div>

            {/* Relationship Type */}
            <div className="grid gap-2">
              <Label htmlFor="relationshipType">Relationship</Label>
              <Select
                value={relationshipType}
                onValueChange={(value) =>
                  setRelationshipType(value as RelationshipType)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship type" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Avatar Emoji */}
            <div className="grid gap-2">
              <Label>Avatar</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition-colors ${
                      avatarEmoji === emoji
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent"
                    }`}
                    onClick={() =>
                      setAvatarEmoji(avatarEmoji === emoji ? "" : emoji)
                    }
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How you know them, where you met..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
