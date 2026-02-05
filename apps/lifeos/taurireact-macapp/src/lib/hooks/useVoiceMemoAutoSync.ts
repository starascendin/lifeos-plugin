import { useEffect, useRef, useCallback } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@holaai/convex";
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

/**
 * Hook that auto-syncs Apple Voice Memos every 10 minutes.
 * Pipeline: sync from macOS → transcribe untranscribed → push to Convex.
 * Only runs in Tauri (no-op on web).
 */
export function useVoiceMemoAutoSync() {
  const convex = useConvex();
  const groqApiKey = useQuery(api.lifeos.voicememo.getGroqApiKey, {});
  const isRunningRef = useRef(false);

  const runPipeline = useCallback(async () => {
    if (!isTauri) return;
    if (!groqApiKey) {
      console.log(PREFIX, "Skipping — GROQ API key not available");
      return;
    }
    if (isRunningRef.current) {
      console.log(PREFIX, "Skipping — previous run still in progress");
      return;
    }

    isRunningRef.current = true;
    console.log(PREFIX, "Starting auto-sync pipeline...");

    try {
      // Step 1: Sync voice memos from macOS
      console.log(PREFIX, "Step 1/4: Syncing voice memos from macOS...");
      const syncResult = await syncVoiceMemos();
      console.log(
        PREFIX,
        `Sync complete: ${syncResult.exported_count} new, ${syncResult.skipped_count} skipped`
      );

      // Step 2: Get untranscribed memos
      console.log(PREFIX, "Step 2/4: Finding untranscribed memos...");
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
          `Step 3/4: Transcribing ${untranscribed.length} memos via GROQ...`
        );
        const ids = untranscribed.map((m) => m.id);
        const results = await transcribeVoiceMemosBatch(ids, groqApiKey);
        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        console.log(
          PREFIX,
          `Transcription complete: ${succeeded} succeeded, ${failed} failed`
        );
        if (failed > 0) {
          const errors = results
            .filter((r) => !r.success)
            .map((r) => `memo ${r.memo_id}: ${r.error}`);
          console.warn(PREFIX, "Transcription errors:", errors);
        }
      }

      // Step 4: Sync transcripts to Convex
      console.log(PREFIX, "Step 4/4: Syncing transcripts to Convex...");
      const convexResult = await syncTranscriptsToConvex(convex);
      console.log(
        PREFIX,
        `Convex sync complete: ${convexResult.synced} synced, ${convexResult.skipped} skipped`
      );
      if (convexResult.error) {
        console.warn(PREFIX, "Convex sync error:", convexResult.error);
      }

      console.log(PREFIX, "Pipeline complete.");
    } catch (error) {
      console.error(PREFIX, "Pipeline error:", error);
    } finally {
      isRunningRef.current = false;
    }
  }, [convex, groqApiKey]);

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

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [runPipeline, groqApiKey]);
}
