import { useState, useEffect, useCallback } from "react";
import {
  type AppleNote,
  type AppleFolder,
  type NotesExportProgress,
  initialExportProgress,
  runNotesExport,
  getExportedNotes,
  getExportedFolders,
  getNotePlainTextPreview,
  formatNoteDate,
} from "../../lib/services/notes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
  FolderOpen,
} from "lucide-react";

type ExportScope = "7" | "30" | "full";

export function NotesTab() {
  const [notes, setNotes] = useState<AppleNote[]>([]);
  const [folders, setFolders] = useState<AppleFolder[]>([]);
  const [progress, setProgress] = useState<NotesExportProgress>(initialExportProgress);
  const [exportScope, setExportScope] = useState<ExportScope>("7");
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing notes on mount
  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedNotes, loadedFolders] = await Promise.all([
        getExportedNotes(),
        getExportedFolders(),
      ]);
      setNotes(loadedNotes);
      setFolders(loadedFolders);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Handle export
  const handleExport = async () => {
    const days = exportScope === "full" ? null : parseInt(exportScope);
    await runNotesExport(days, setProgress);
    // Reload notes after export
    await loadNotes();
  };

  // Filter notes by selected folder
  const filteredNotes = selectedFolderId
    ? notes.filter((note) => note.folder_id === selectedFolderId)
    : notes;

  // Get folder name by id
  const getFolderName = (folderId: number | null): string => {
    if (!folderId) return "Uncategorized";
    const folder = folders.find((f) => f.id === folderId);
    return folder?.name || "Unknown";
  };

  // Group notes by folder for display
  const notesByFolder = filteredNotes.reduce(
    (acc, note) => {
      const folderName = getFolderName(note.folder_id);
      if (!acc[folderName]) {
        acc[folderName] = [];
      }
      acc[folderName].push(note);
      return acc;
    },
    {} as Record<string, AppleNote[]>
  );

  const isExporting = progress.status === "counting" || progress.status === "exporting";

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (progress.totalCount === 0) return 0;
    return Math.round((progress.currentNote / progress.totalCount) * 100);
  };

  return (
    <div className="space-y-4 overflow-y-auto h-full">
      {/* Export Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Export:</span>
              <Select
                value={exportScope}
                onValueChange={(value) => setExportScope(value as ExportScope)}
                disabled={isExporting}
              >
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="full">All notes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting}
              size="sm"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Notes
                </>
              )}
            </Button>
          </div>

          {/* Progress indicator */}
          {progress.status !== "idle" && (
            <div className="mt-3 pt-3 border-t">
              {/* Progress bar */}
              {progress.status === "exporting" && progress.totalCount > 0 && (
                <div className="mb-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress.currentNote} / {progress.totalCount}</span>
                    <span>{getProgressPercentage()}%</span>
                  </div>
                  <Progress value={getProgressPercentage()} className="h-2" />
                </div>
              )}
              <p className="text-sm truncate">
                {progress.currentStep}
              </p>
              {progress.status === "exporting" && progress.currentTitle && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Current: {progress.currentTitle}
                </p>
              )}
              {progress.status === "complete" && (
                <div className="flex items-center gap-2 text-green-600 mt-1">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs">
                    {progress.exportedCount} exported, {progress.skippedCount} unchanged
                  </span>
                </div>
              )}
              {progress.status === "error" && (
                <div className="flex items-center gap-2 text-destructive mt-1">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">Error: {progress.error}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Folder filter */}
      {folders.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Badge
            variant={selectedFolderId === null ? "default" : "outline"}
            className="cursor-pointer flex-shrink-0"
            onClick={() => setSelectedFolderId(null)}
          >
            All ({notes.length})
          </Badge>
          {folders.map((folder) => {
            const count = notes.filter((n) => n.folder_id === folder.id).length;
            if (count === 0) return null;
            return (
              <Badge
                key={folder.id}
                variant={selectedFolderId === folder.id ? "default" : "outline"}
                className="cursor-pointer flex-shrink-0"
                onClick={() => setSelectedFolderId(folder.id)}
              >
                {folder.name} ({count})
              </Badge>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading notes...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No notes state */}
      {!isLoading && notes.length === 0 && (
        <Alert>
          <FolderOpen className="h-4 w-4" />
          <AlertDescription>
            No notes exported yet. Click "Export Notes" to get started.
          </AlertDescription>
        </Alert>
      )}

      {/* Notes list grouped by folder */}
      {!isLoading && filteredNotes.length > 0 && (
        <div className="space-y-4">
          {Object.entries(notesByFolder).map(([folderName, folderNotes]) => (
            <div key={folderName} className="space-y-2">
              {!selectedFolderId && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  {folderName} ({folderNotes.length})
                </h3>
              )}
              <div className="space-y-2">
                {folderNotes.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({ note }: { note: AppleNote }) {
  const preview = getNotePlainTextPreview(note.body, 120);

  return (
    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
      <CardContent className="p-3">
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-medium text-sm truncate flex-1">
            {note.title || "Untitled"}
          </h4>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatNoteDate(note.updated)}
          </span>
        </div>
        {preview && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {preview}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
