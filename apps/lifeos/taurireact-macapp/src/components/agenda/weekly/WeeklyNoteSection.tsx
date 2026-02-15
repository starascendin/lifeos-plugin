import { useState, useCallback, useRef, useEffect } from "react";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Notebook, Check, Loader2 } from "lucide-react";

export function WeeklyNoteSection() {
  const { weeklySummary, saveWeeklyUserNote, weekStartDate } = useAgenda();

  const [noteValue, setNoteValue] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const savedIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Sync server value into local state when it changes (and not dirty)
  useEffect(() => {
    if (!noteDirty) {
      const serverValue = weeklySummary?.userNote ?? "";
      if (
        lastSavedRef.current !== null &&
        serverValue !== lastSavedRef.current
      ) {
        return; // Wait for server to catch up
      }
      lastSavedRef.current = null;
      setNoteValue(serverValue);
    }
  }, [weeklySummary?.userNote, noteDirty]);

  // Reset state when week changes
  useEffect(() => {
    setNoteDirty(false);
    lastSavedRef.current = null;
    setSaveStatus("idle");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedIndicatorTimer.current)
      clearTimeout(savedIndicatorTimer.current);
  }, [weekStartDate]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedIndicatorTimer.current)
        clearTimeout(savedIndicatorTimer.current);
    };
  }, []);

  const saveNote = useCallback(
    (value: string) => {
      lastSavedRef.current = value;
      setSaveStatus("saving");
      saveWeeklyUserNote({ weekStartDate, userNote: value });
      setNoteDirty(false);
      if (savedIndicatorTimer.current)
        clearTimeout(savedIndicatorTimer.current);
      savedIndicatorTimer.current = setTimeout(() => {
        setSaveStatus("saved");
        savedIndicatorTimer.current = setTimeout(() => {
          setSaveStatus("idle");
        }, 1500);
      }, 300);
    },
    [saveWeeklyUserNote, weekStartDate],
  );

  const handleNoteChange = useCallback(
    (value: string) => {
      setNoteValue(value);
      setNoteDirty(true);
      setSaveStatus("idle");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveNote(value), 1500);
    },
    [saveNote],
  );

  const handleNoteBlur = useCallback(() => {
    if (noteDirty) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveNote(noteValue);
    }
  }, [noteDirty, noteValue, saveNote]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Notebook className="h-4 w-4 text-amber-500 shrink-0" />
          <h3 className="text-sm font-medium">Weekly Note</h3>
        </div>
        {saveStatus === "saving" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
      </div>
      <Textarea
        placeholder="Write a note for this week..."
        value={noteValue}
        onChange={(e) => handleNoteChange(e.target.value)}
        onBlur={handleNoteBlur}
        className="min-h-[80px] text-sm resize-none"
        rows={3}
      />
    </Card>
  );
}
