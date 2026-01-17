import { useState, useEffect } from "react";
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
import type { Doc } from "@holaai/convex";

interface EditPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Doc<"lifeos_frmPeople">;
  onSaved?: () => void;
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

export function EditPersonDialog({
  open,
  onOpenChange,
  person,
  onSaved,
}: EditPersonDialogProps) {
  const { updatePerson } = useFRM();

  const [name, setName] = useState(person.name);
  const [nickname, setNickname] = useState(person.nickname || "");
  const [relationshipType, setRelationshipType] = useState<RelationshipType | "">(
    person.relationshipType || ""
  );
  const [email, setEmail] = useState(person.email || "");
  const [phone, setPhone] = useState(person.phone || "");
  const [avatarEmoji, setAvatarEmoji] = useState(person.avatarEmoji || "");
  const [notes, setNotes] = useState(person.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when person changes
  useEffect(() => {
    setName(person.name);
    setNickname(person.nickname || "");
    setRelationshipType(person.relationshipType || "");
    setEmail(person.email || "");
    setPhone(person.phone || "");
    setAvatarEmoji(person.avatarEmoji || "");
    setNotes(person.notes || "");
  }, [person]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await updatePerson({
        personId: person._id,
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        relationshipType: relationshipType || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        avatarEmoji: avatarEmoji || undefined,
        notes: notes.trim() || undefined,
      });

      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update person:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Person</DialogTitle>
            <DialogDescription>
              Update details about {person.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="edit-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            {/* Nickname */}
            <div className="grid gap-2">
              <Label htmlFor="edit-nickname">Nickname</Label>
              <Input
                id="edit-nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Johnny"
              />
            </div>

            {/* Relationship Type */}
            <div className="grid gap-2">
              <Label htmlFor="edit-relationshipType">Relationship</Label>
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

            {/* Contact Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                />
              </div>
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
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How you know them, where you met..."
                rows={4}
              />
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
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
