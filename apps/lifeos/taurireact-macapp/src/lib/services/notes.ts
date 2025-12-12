import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Types matching the Rust structs
export interface AppleNote {
  id: string;
  title: string;
  body: string;
  created: string;
  updated: string;
  folder_id: number | null;
  folder_long_id: string;
  markdown_path: string | null;
}

export interface AppleFolder {
  id: number;
  long_id: string;
  name: string;
  parent_id: number | null;
}

export interface NotesExportResult {
  total_count: number;
  exported_count: number;
  skipped_count: number;
  error: string | null;
}

export interface NotesExportProgress {
  status: "idle" | "counting" | "exporting" | "error" | "complete";
  currentStep: string;
  totalCount: number;
  exportedCount: number;
  skippedCount: number;
  currentNote: number;
  currentTitle: string;
  error?: string;
}

// Event payload from Rust
interface NotesExportProgressEvent {
  current: number;
  total: number;
  exported: number;
  skipped: number;
  current_title: string;
  status: string;
}

export const initialExportProgress: NotesExportProgress = {
  status: "idle",
  currentStep: "",
  totalCount: 0,
  exportedCount: 0,
  skippedCount: 0,
  currentNote: 0,
  currentTitle: "",
};

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Count total notes in Apple Notes
export async function countAppleNotes(): Promise<number> {
  if (!isTauri) return 0;
  return await invoke<number>("count_apple_notes");
}

// Export Apple Notes to local storage
export async function exportAppleNotes(
  days?: number
): Promise<NotesExportResult> {
  if (!isTauri) {
    return {
      total_count: 0,
      exported_count: 0,
      skipped_count: 0,
      error: "Not running in Tauri",
    };
  }
  return await invoke<NotesExportResult>("export_apple_notes", { days });
}

// Get all exported notes from local database
export async function getExportedNotes(): Promise<AppleNote[]> {
  if (!isTauri) return [];
  return await invoke<AppleNote[]>("get_exported_notes");
}

// Get all exported folders from local database
export async function getExportedFolders(): Promise<AppleFolder[]> {
  if (!isTauri) return [];
  return await invoke<AppleFolder[]>("get_exported_folders");
}

// Main export function with progress callback
export async function runNotesExport(
  days: number | null,
  onProgress: (progress: NotesExportProgress) => void
): Promise<void> {
  let progress = { ...initialExportProgress };
  let unlisten: UnlistenFn | null = null;

  const updateProgress = (updates: Partial<NotesExportProgress>) => {
    progress = { ...progress, ...updates };
    onProgress(progress);
  };

  try {
    updateProgress({
      status: "counting",
      currentStep: "Counting notes in Apple Notes...",
    });

    // Get total count
    const totalCount = await countAppleNotes();
    updateProgress({
      totalCount,
      currentStep: `Found ${totalCount} notes. Starting export...`,
    });

    // Set up event listener for progress updates
    if (isTauri) {
      unlisten = await listen<NotesExportProgressEvent>(
        "notes-export-progress",
        (event) => {
          const data = event.payload;
          const statusMap: Record<string, NotesExportProgress["status"]> = {
            extracting: "exporting",
            exporting: "exporting",
            complete: "complete",
          };

          updateProgress({
            status: statusMap[data.status] || "exporting",
            currentNote: data.current,
            totalCount: data.total,
            exportedCount: data.exported,
            skippedCount: data.skipped,
            currentTitle: data.current_title,
            currentStep:
              data.status === "complete"
                ? `Exported ${data.exported} notes, skipped ${data.skipped} unchanged`
                : `Processing ${data.current}/${data.total}: ${data.current_title || "..."}`,
          });
        }
      );
    }

    updateProgress({
      status: "exporting",
      currentStep: days
        ? `Exporting notes from the last ${days} days...`
        : "Exporting all notes...",
    });

    // Run export
    const result = await exportAppleNotes(days ?? undefined);

    if (result.error) {
      updateProgress({
        status: "error",
        error: result.error,
        currentStep: "Export failed",
      });
      return;
    }

    updateProgress({
      status: "complete",
      exportedCount: result.exported_count,
      skippedCount: result.skipped_count,
      totalCount: result.total_count,
      currentStep: `Exported ${result.exported_count} notes, skipped ${result.skipped_count} unchanged`,
    });
  } catch (error) {
    console.error("Notes export error:", error);
    updateProgress({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      currentStep: "Export failed",
    });
  } finally {
    // Clean up event listener
    if (unlisten) {
      unlisten();
    }
  }
}

// Convert HTML body to plain text preview
export function getNotePlainTextPreview(
  body: string,
  maxLength: number = 100
): string {
  // Simple HTML stripping
  const text = body
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Format date for display
export function formatNoteDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}
