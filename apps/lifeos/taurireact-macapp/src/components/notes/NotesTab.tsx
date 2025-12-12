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

  return (
    <div className="space-y-4 overflow-y-auto h-full">
      {/* Export Controls */}
      <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--text-secondary)]">Export:</label>
            <select
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value as ExportScope)}
              disabled={isExporting}
              className="px-2 py-1 text-sm rounded bg-[var(--bg-primary)] border border-[var(--border)] disabled:opacity-50"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="full">All notes</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <div className="spinner-sm" />
                Exporting...
              </span>
            ) : (
              "Export Notes"
            )}
          </button>
        </div>

        {/* Progress indicator */}
        {progress.status !== "idle" && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            {/* Progress bar */}
            {progress.status === "exporting" && progress.totalCount > 0 && (
              <div className="mb-2">
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span>{progress.currentNote} / {progress.totalCount}</span>
                  <span>{Math.round((progress.currentNote / progress.totalCount) * 100)}%</span>
                </div>
                <div className="w-full bg-[var(--border)] rounded-full h-2">
                  <div
                    className="bg-[var(--accent)] h-2 rounded-full transition-all duration-200"
                    style={{ width: `${(progress.currentNote / progress.totalCount) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <p className="text-sm truncate">
              {progress.currentStep}
            </p>
            {progress.status === "exporting" && progress.currentTitle && (
              <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">
                Current: {progress.currentTitle}
              </p>
            )}
            {progress.status === "complete" && (
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {progress.exportedCount} exported, {progress.skippedCount} unchanged
              </p>
            )}
            {progress.status === "error" && (
              <p className="text-xs text-red-500 mt-1">
                Error: {progress.error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Folder filter */}
      {folders.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`px-3 py-1 text-xs rounded-full flex-shrink-0 transition-colors ${
              selectedFolderId === null
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
            }`}
          >
            All ({notes.length})
          </button>
          {folders.map((folder) => {
            const count = notes.filter((n) => n.folder_id === folder.id).length;
            if (count === 0) return null;
            return (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`px-3 py-1 text-xs rounded-full flex-shrink-0 transition-colors ${
                  selectedFolderId === folder.id
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                }`}
              >
                {folder.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
          <div className="flex items-center gap-2">
            <div className="spinner" />
            <span className="text-sm">Loading notes...</span>
          </div>
        </div>
      )}

      {/* No notes state */}
      {!isLoading && notes.length === 0 && (
        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            No notes exported yet.
            <br />
            Click "Export Notes" to get started.
          </p>
        </div>
      )}

      {/* Notes list grouped by folder */}
      {!isLoading && filteredNotes.length > 0 && (
        <div className="space-y-4">
          {Object.entries(notesByFolder).map(([folderName, folderNotes]) => (
            <div key={folderName} className="space-y-2">
              {!selectedFolderId && (
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide px-1">
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
    <div className="p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--border)] transition-colors cursor-pointer">
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-medium text-sm truncate flex-1">
          {note.title || "Untitled"}
        </h4>
        <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
          {formatNoteDate(note.updated)}
        </span>
      </div>
      {preview && (
        <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
          {preview}
        </p>
      )}
    </div>
  );
}
