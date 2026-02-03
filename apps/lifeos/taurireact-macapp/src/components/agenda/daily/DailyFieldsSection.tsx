import { useState } from "react";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  ClipboardList,
  Plus,
  Check,
  X,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Doc, Id } from "@holaai/convex";

interface NumberFieldItemProps {
  definition: Doc<"lifeos_dailyFieldDefinitions">;
  value: Doc<"lifeos_dailyFieldValues"> | null;
  onSave: (value: number | undefined) => Promise<void>;
  onArchive: () => Promise<void>;
}

function NumberFieldItem({
  definition,
  value,
  onSave,
  onArchive,
}: NumberFieldItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState<string>(
    value?.numberValue?.toString() ?? ""
  );

  const handleSave = async () => {
    const numValue = inputValue ? parseFloat(inputValue) : undefined;
    await onSave(numValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setInputValue(value?.numberValue?.toString() ?? "");
    }
  };

  const displayValue = value?.numberValue ?? "-";

  return (
    <div className="flex items-center justify-between py-1.5 px-1 rounded-md hover:bg-muted/50 transition-colors group">
      <div className="flex flex-col">
        <span className="text-sm">{definition.name}</span>
        {definition.description && (
          <span className="text-[10px] text-muted-foreground">
            {definition.description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {isEditing ? (
          <>
            <Input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              min={definition.minValue}
              max={definition.maxValue}
              className="w-16 h-7 text-sm"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setIsEditing(false);
                setInputValue(value?.numberValue?.toString() ?? "");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-7 min-w-12 text-xs"
            >
              {displayValue}
              {definition.maxValue && `/${definition.maxValue}`}
            </Button>
            {!definition.isDefault && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                onClick={onArchive}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface TextFieldItemProps {
  definition: Doc<"lifeos_dailyFieldDefinitions">;
  value: Doc<"lifeos_dailyFieldValues"> | null;
  onSave: (value: string | undefined) => Promise<void>;
  onArchive: () => Promise<void>;
}

function TextFieldItem({
  definition,
  value,
  onSave,
  onArchive,
}: TextFieldItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState<string>(value?.textValue ?? "");

  const handleSave = async () => {
    await onSave(inputValue || undefined);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col py-1.5 px-1 rounded-md hover:bg-muted/50 transition-colors gap-1.5 group">
      <div className="flex items-center justify-between">
        <span className="text-sm">{definition.name}</span>
        <div className="flex items-center gap-1.5">
          {!isEditing && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
          {!definition.isDefault && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              onClick={onArchive}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {isEditing ? (
        <div className="flex flex-col gap-1.5">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={definition.placeholder ?? "Enter value..."}
            className="h-8 text-sm"
            autoFocus
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>Save</Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setIsEditing(false);
                setInputValue(value?.textValue ?? "");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {value?.textValue || <span className="italic">No value</span>}
        </p>
      )}
    </div>
  );
}

interface AddFieldDialogProps {
  onAdd: (name: string, fieldType: "text" | "number") => Promise<void>;
}

function AddFieldDialog({ onAdd }: AddFieldDialogProps) {
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<"text" | "number">("number");
  const [open, setOpen] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onAdd(name.trim(), fieldType);
    setName("");
    setFieldType("number");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Daily Field</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="field-name">Field Name</Label>
            <Input
              id="field-name"
              placeholder="e.g., Mood, Energy Level"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Field Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={fieldType === "number" ? "default" : "outline"}
                onClick={() => setFieldType("number")}
                className="flex-1"
              >
                Number
              </Button>
              <Button
                type="button"
                variant={fieldType === "text" ? "default" : "outline"}
                onClick={() => setFieldType("text")}
                className="flex-1"
              >
                Text
              </Button>
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={!name.trim()}>
            Add Field
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DailyFieldsSection() {
  const {
    dailyFields,
    isLoadingDailyFields,
    setFieldValue,
    createFieldDefinition,
    archiveFieldDefinition,
    dateString,
  } = useAgenda();

  const handleSaveNumberValue = async (
    fieldDefinitionId: Id<"lifeos_dailyFieldDefinitions">,
    value: number | undefined
  ) => {
    await setFieldValue({ fieldDefinitionId, date: dateString, numberValue: value });
  };

  const handleSaveTextValue = async (
    fieldDefinitionId: Id<"lifeos_dailyFieldDefinitions">,
    value: string | undefined
  ) => {
    await setFieldValue({ fieldDefinitionId, date: dateString, textValue: value });
  };

  const handleAddField = async (name: string, fieldType: "text" | "number") => {
    await createFieldDefinition({ name, fieldType });
  };

  const handleArchiveField = async (fieldId: Id<"lifeos_dailyFieldDefinitions">) => {
    await archiveFieldDefinition({ fieldId });
  };

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Daily Fields</h3>
        </div>
        <AddFieldDialog onAdd={handleAddField} />
      </div>

      {/* Content */}
      {isLoadingDailyFields ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : dailyFields && dailyFields.length > 0 ? (
        <div className="space-y-0.5">
          {dailyFields.map(({ definition, value }) =>
            definition.fieldType === "number" ? (
              <NumberFieldItem
                key={definition._id}
                definition={definition}
                value={value}
                onSave={(v) => handleSaveNumberValue(definition._id, v)}
                onArchive={() => handleArchiveField(definition._id)}
              />
            ) : (
              <TextFieldItem
                key={definition._id}
                definition={definition}
                value={value}
                onSave={(v) => handleSaveTextValue(definition._id, v)}
                onArchive={() => handleArchiveField(definition._id)}
              />
            )
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <ClipboardList className="h-5 w-5 mx-auto mb-1 opacity-40" />
          <p className="text-xs">No daily fields defined</p>
        </div>
      )}
    </div>
  );
}
