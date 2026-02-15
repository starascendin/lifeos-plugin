import { useEffect, useRef, useCallback } from "react";
import { useConvex, useQuery, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { useAutoSyncUpdater } from "../contexts/VoiceMemoAutoSyncContext";
import {
  syncVoiceMemos,
  getVoiceMemos,
  transcribeVoiceMemosBatch,
  syncTranscriptsToConvex,
} from "../services/voicememos";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

const PREFIX = "[VoiceMemo AutoSync]";
const INITIAL_DELAY_MS = 30_000; // 30 seconds after mount
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TRANSCRIBE_BATCH = 10;
const MAX_EXTRACT_BATCH = 5;

/**
 * Hook that auto-syncs Apple Voice Memos every 10 minutes.
 * Pipeline: sync from macOS → transcribe → push to Convex → extract AI insights.
 * Only runs in Tauri (no-op on web).
 *
 * Uses refs for all dependencies to keep the pipeline callback stable
 * and prevent timer resets on re-renders.
 */
export function useVoiceMemoAutoSync() {
  const convex = useConvex();
  const groqApiKey = useQuery(api.lifeos.voicememo.getGroqApiKey, {});
  const extractVoiceMemo = useAction(api.lifeos.voicememo_extraction.extractVoiceMemo);
  const updateStatus = useAutoSyncUpdater();

  const isRunningRef = useRef(false);

  // Stabilize all dependencies via refs so runPipeline never changes
  const extractRef = useRef(extractVoiceMemo);
  extractRef.current = extractVoiceMemo;
  const groqApiKeyRef = useRef(groqApiKey);
  groqApiKeyRef.current = groqApiKey;
  const convexRef = useRef(convex);
  convexRef.current = convex;
  const updateStatusRef = useRef(updateStatus);
  updateStatusRef.current = updateStatus;

  const runPipeline = useCallback(async () => {
    if (!isTauri) return;
    const apiKey = groqApiKeyRef.current;
    if (!apiKey) {
      console.log(PREFIX, "Skipping — GROQ API key not available");
      return;
    }
    if (isRunningRef.current) {
      console.log(PREFIX, "Skipping — previous run still in progress");
      return;
    }

    isRunningRef.current = true;
    updateStatusRef.current?.({ isRunning: true });
    console.log(PREFIX, "Starting auto-sync pipeline...");

    const parts: string[] = [];

    try {
      // Step 1: Sync voice memos from macOS
      console.log(PREFIX, "Step 1/5: Syncing voice memos from macOS...");
      const syncResult = await syncVoiceMemos();
      console.log(
        PREFIX,
        `Sync complete: ${syncResult.exported_count} new, ${syncResult.skipped_count} skipped`
      );
      if (syncResult.exported_count > 0) {
        parts.push(`${syncResult.exported_count} synced from Mac`);
      }

      // Step 2: Get untranscribed memos
      console.log(PREFIX, "Step 2/5: Finding untranscribed memos...");
      const allMemos = await getVoiceMemos();
      const untranscribed = allMemos
        .filter((m) => !m.transcription && m.local_path)
        .sort((a, b) => b.date - a.date)
        .slice(0, MAX_TRANSCRIBE_BATCH);

      if (untranscribed.length === 0) {
        console.log(PREFIX, "No untranscribed memos found");
      } else {
        // Step 3: Transcribe
        console.log(
          PREFIX,
          `Step 3/5: Transcribing ${untranscribed.length} memos via GROQ...`
        );
        const ids = untranscribed.map((m) => m.id);
        const results = await transcribeVoiceMemosBatch(ids, apiKey);
        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        console.log(
          PREFIX,
          `Transcription complete: ${succeeded} succeeded, ${failed} failed`
        );
        if (succeeded > 0) parts.push(`${succeeded} transcribed`);
        if (failed > 0) {
          const errors = results
            .filter((r) => !r.success)
            .map((r) => `memo ${r.memo_id}: ${r.error}`);
          console.warn(PREFIX, "Transcription errors:", errors);
        }
      }

      // Step 4: Sync transcripts to Convex
      console.log(PREFIX, "Step 4/5: Syncing transcripts to Convex...");
      const client = convexRef.current;
      const convexResult = await syncTranscriptsToConvex(client);
      console.log(
        PREFIX,
        `Convex sync complete: ${convexResult.synced} synced, ${convexResult.skipped} skipped`
      );
      if (convexResult.synced > 0) parts.push(`${convexResult.synced} pushed to cloud`);
      if (convexResult.error) {
        console.warn(PREFIX, "Convex sync error:", convexResult.error);
      }

      // Step 5: Extract AI insights for synced memos missing extraction
      console.log(PREFIX, "Step 5/5: Extracting AI insights...");
      const syncedMemos = await client.query(
        api.lifeos.voicememo.getSyncedMemosWithStatus,
        {}
      );
      const needsExtraction = syncedMemos
        .filter((m) => m.hasTranscript && !m.hasExtraction)
        .slice(0, MAX_EXTRACT_BATCH);

      if (needsExtraction.length === 0) {
        console.log(PREFIX, "No memos need AI extraction");
      } else {
        console.log(
          PREFIX,
          `Extracting AI insights for ${needsExtraction.length} memos...`
        );
        let extracted = 0;
        const extract = extractRef.current;
        for (const memo of needsExtraction) {
          try {
            await extract({ voiceMemoId: memo.convexId });
            extracted++;
          } catch (err) {
            console.warn(
              PREFIX,
              `Failed to extract ${memo.name}:`,
              err
            );
          }
        }
        console.log(
          PREFIX,
          `AI extraction complete: ${extracted}/${needsExtraction.length} succeeded`
        );
        if (extracted > 0) parts.push(`${extracted} AI extractions`);
      }

      const result = parts.length > 0 ? parts.join(", ") : "Everything up to date";
      console.log(PREFIX, "Pipeline complete:", result);
      updateStatusRef.current?.({
        lastRunAt: new Date(),
        lastRunResult: result,
        isRunning: false,
        nextRunAt: new Date(Date.now() + INTERVAL_MS),
      });
    } catch (error) {
      console.error(PREFIX, "Pipeline error:", error);
      updateStatusRef.current?.({
        lastRunAt: new Date(),
        lastRunResult: `Error: ${error instanceof Error ? error.message : String(error)}`,
        isRunning: false,
        nextRunAt: new Date(Date.now() + INTERVAL_MS),
      });
    } finally {
      isRunningRef.current = false;
    }
  }, []); // No deps — everything accessed via refs

  useEffect(() => {
    if (!isTauri) return;
    if (!groqApiKey) return;

    // Initial delay before first run
    const initialTimer = setTimeout(() => {
      runPipeline();
    }, INITIAL_DELAY_MS);

    // Recurring interval
    const intervalTimer = setInterval(() => {
      runPipeline();
    }, INTERVAL_MS);

    // Set next run time
    updateStatus?.({ nextRunAt: new Date(Date.now() + INITIAL_DELAY_MS) });

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [runPipeline, groqApiKey, updateStatus]);
}
