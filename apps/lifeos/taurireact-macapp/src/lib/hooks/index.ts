// Platform detection
export { usePlatform, isTauri, type UsePlatformReturn } from "./usePlatform";

// Audio playback
export {
  useAudioPlayer,
  type UseAudioPlayerOptions,
  type UseAudioPlayerReturn,
} from "./useAudioPlayer";

// Voice memo transcription
export {
  useVoiceMemoTranscription,
  type UseVoiceMemoTranscriptionOptions,
  type UseVoiceMemoTranscriptionReturn,
} from "./useVoiceMemoTranscription";

// Convex cloud sync
export { useConvexSync, type UseConvexSyncReturn } from "./useConvexSync";

// API keys (existing)
export { useApiKeys } from "./useApiKeys";

// Audio visualizer (existing)
export { useTrackVolume, useMultibandVolume, useStreamVolume } from "./useAudioVisualizer";

// Screen time sync (existing)
export { useScreenTimeSync } from "./useScreenTimeSync";

// Sync progress (existing)
export { useSyncProgress } from "./useSyncProgress";

// Ensure user (existing)
export { useEnsureUser } from "./useEnsureUser";

// Chat nexus settings (existing)
export { useChatNexusSettings } from "./useChatNexusSettings";

// Voice memo auto-sync (background pipeline)
export { useVoiceMemoAutoSync } from "./useVoiceMemoAutoSync";
