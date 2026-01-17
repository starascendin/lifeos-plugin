import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { useFRM } from "@/lib/contexts/FRMContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  User,
  Edit,
  Mic,
  Upload,
  FileText,
  Image,
  File,
  X,
  Clock,
  MessageSquare,
  Target,
  Brain,
  Lightbulb,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Zap,
  Heart,
  Users,
  Briefcase,
  Star,
  ChevronRight,
  ChevronDown,
  Play,
  Square,
  Loader2,
  Sparkles,
  History,
} from "lucide-react";
import type { Id } from "@holaai/convex";
import { formatDistanceToNow, format } from "date-fns";
import { EditPersonDialog } from "./EditPersonDialog";
import { MemoDetailDialog } from "./MemoDetailDialog";

interface PersonDetailProps {
  personId: Id<"lifeos_frmPeople">;
  onBack: () => void;
}

const relationshipConfig: Record<
  string,
  { label: string; icon: typeof Heart; color: string }
> = {
  family: { label: "FAMILY", icon: Heart, color: "text-rose-500" },
  friend: { label: "FRIEND", icon: Users, color: "text-blue-500" },
  colleague: { label: "COLLEAGUE", icon: Briefcase, color: "text-amber-500" },
  acquaintance: { label: "ACQUAINTANCE", icon: User, color: "text-slate-500" },
  mentor: { label: "MENTOR", icon: Star, color: "text-purple-500" },
  other: { label: "OTHER", icon: User, color: "text-slate-500" },
};

interface UploadingFile {
  id: string;
  name: string;
  type: string;
  size: number;
  status: "uploading" | "done" | "error";
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
  if (type.includes("pdf") || type.includes("document"))
    return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Detect if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Get supported MIME type for recording
function getSupportedMimeType(): { mimeType: string; extension: string } {
  const types: Array<{ mime: string; ext: string }> = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
  ];
  for (const { mime, ext } of types) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return { mimeType: mime, extension: ext };
    }
  }
  return { mimeType: "", extension: "webm" };
}

// Calculate profile completeness
function calculateProfileCompleteness(
  person: { memoCount: number; notes?: string },
  profile: { confidence?: string } | null
): number {
  let score = 0;
  if (person.memoCount >= 1) score += 20;
  if (person.memoCount >= 3) score += 20;
  if (person.memoCount >= 6) score += 20;
  if (person.notes) score += 10;
  if (profile?.confidence === "low") score += 10;
  if (profile?.confidence === "medium") score += 20;
  if (profile?.confidence === "high") score += 30;
  return Math.min(100, score);
}

// Get status based on last interaction
function getContactStatus(lastInteractionAt?: number): {
  label: string;
  color: string;
  icon: typeof CheckCircle2;
} {
  if (!lastInteractionAt) {
    return { label: "NEW", color: "text-blue-500", icon: Zap };
  }
  const daysSince = Math.floor(
    (Date.now() - lastInteractionAt) / (1000 * 60 * 60 * 24)
  );
  if (daysSince <= 7) {
    return { label: "ACTIVE", color: "text-green-500", icon: CheckCircle2 };
  }
  if (daysSince <= 30) {
    return { label: "RECENT", color: "text-amber-500", icon: Activity };
  }
  return { label: "DORMANT", color: "text-red-500", icon: AlertTriangle };
}

// Section Header component
function SectionHeader({
  icon: Icon,
  title,
  classification,
}: {
  icon: typeof Brain;
  title: string;
  classification?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h3 className="text-sm font-semibold tracking-wide uppercase">{title}</h3>
      {classification && (
        <Badge variant="outline" className="ml-auto text-xs font-mono">
          {classification}
        </Badge>
      )}
    </div>
  );
}

export function PersonDetail({ personId, onBack }: PersonDetailProps) {
  const { selectedPerson, isLoadingPerson } = useFRM();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingFormatRef = useRef<{ mimeType: string; extension: string }>({
    mimeType: "",
    extension: "webm",
  });

  // Profile generation state
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Convex mutations
  const generateUploadUrl = useMutation(api.lifeos.voicememo.generateUploadUrl);
  const createConvexMemo = useMutation(api.lifeos.voicememo.createMemo);
  const transcribeMemoAction = useAction(api.lifeos.voicememo.transcribeMemo);
  const linkMemoToPerson = useMutation(api.lifeos.frm_memos.linkMemoToPerson);
  const unlinkMemoFromPerson = useMutation(api.lifeos.frm_memos.unlinkMemoFromPerson);
  const generateProfileAction = useAction(api.lifeos.frm_profiles.generateProfile);

  // File upload mutations
  const generateFileUploadUrl = useMutation(api.lifeos.frm_files.generateUploadUrl);
  const createFile = useMutation(api.lifeos.frm_files.createFile);
  const deleteFile = useMutation(api.lifeos.frm_files.deleteFile);

  // Query linked memos
  const linkedMemos = useQuery(api.lifeos.frm_memos.getMemosForPerson, {
    personId,
    limit: 10,
  });

  // Query files for this person
  const personFiles = useQuery(api.lifeos.frm_files.getFilesForPerson, {
    personId,
  });

  // Query profile history
  const profileHistory = useQuery(api.lifeos.frm_profiles.getProfileHistory, {
    personId,
  });

  // State for viewing historical versions
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // State for memo detail dialog
  const [selectedMemo, setSelectedMemo] = useState<NonNullable<NonNullable<typeof linkedMemos>[number]> | null>(null);

  // Get the profile to display (selected version or latest)
  const latestProfile = selectedPerson?.profile;
  const selectedProfile = selectedVersionId
    ? profileHistory?.find((p) => p._id === selectedVersionId)
    : latestProfile;
  const isViewingHistory = selectedVersionId !== null && selectedProfile !== latestProfile;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Start recording immediately
  const startRecording = async () => {
    try {
      setRecordingError(null);

      // Check macOS microphone permission in Tauri
      if (isTauri) {
        try {
          const { checkMicrophonePermission, requestMicrophonePermission } =
            await import("tauri-plugin-macos-permissions-api");
          const hasPermission = await checkMicrophonePermission();
          if (!hasPermission) {
            const granted = await requestMicrophonePermission();
            if (!granted) {
              setRecordingError("Microphone access denied. Please allow in System Preferences.");
              return;
            }
          }
        } catch (pluginError) {
          console.warn("Could not check macOS permissions:", pluginError);
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const format = getSupportedMimeType();
      recordingFormatRef.current = format;

      const options: MediaRecorderOptions = {
        ...(format.mimeType ? { mimeType: format.mimeType } : {}),
        audioBitsPerSecond: 48000,
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setRecordingError("Failed to access microphone. Please check permissions.");
      console.error("Recording error:", err);
    }
  };

  // Stop recording and auto-save
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !selectedPerson) return;

    const currentMimeType =
      mediaRecorderRef.current.mimeType || recordingFormatRef.current.mimeType;
    const duration = recordingDuration;

    // Stop the timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setIsSaving(true);
    setRecordingError(null);

    // Create blob from chunks
    const blob = new Blob(audioChunksRef.current, {
      type: currentMimeType || "audio/webm",
    });

    // Stop all tracks
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());

    try {
      // Upload to Convex storage
      const uploadUrl = await generateUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": currentMimeType || "audio/webm" },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();
      const storageId = uploadResult.storageId;

      if (!storageId) {
        throw new Error("No storageId returned from upload");
      }

      // Create memo
      const localId = `frm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const time = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const convexMemoId = await createConvexMemo({
        localId,
        name: `Note about ${selectedPerson.name} - ${time}`,
        storageId,
        duration: duration * 1000,
        clientCreatedAt: Date.now(),
        clientUpdatedAt: Date.now(),
      });

      // Link to person
      await linkMemoToPerson({
        personId,
        voiceMemoId: convexMemoId,
      });

      // Trigger transcription (fire and forget)
      transcribeMemoAction({ memoId: convexMemoId }).catch(console.error);

      // Reset
      setRecordingDuration(0);
    } catch (err) {
      console.error("Save error:", err);
      setRecordingError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    recordingDuration,
    selectedPerson,
    personId,
    generateUploadUrl,
    createConvexMemo,
    linkMemoToPerson,
    transcribeMemoAction,
  ]);

  // Upload a single file
  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Add to uploading state
      setUploadingFiles((prev) => [
        ...prev,
        {
          id: fileId,
          name: file.name,
          type: file.type,
          size: file.size,
          status: "uploading",
        },
      ]);

      try {
        // Get upload URL
        const uploadUrl = await generateFileUploadUrl();

        // Upload file
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }

        const { storageId } = await response.json();

        // Create file record
        await createFile({
          personId,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          storageId,
        });

        // Remove from uploading state
        setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId));
      } catch (err) {
        console.error("File upload error:", err);
        // Mark as error
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "error" as const } : f))
        );
      }
    },
    [generateFileUploadUrl, createFile, personId]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => uploadFile(file));
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      files.forEach((file) => uploadFile(file));
      e.target.value = "";
    },
    [uploadFile]
  );

  const handleRemoveFile = useCallback(
    async (fileId: string) => {
      try {
        await deleteFile({ fileId: fileId as Id<"lifeos_frmFiles"> });
      } catch (err) {
        console.error("Failed to delete file:", err);
      }
    },
    [deleteFile]
  );

  const handleRemoveUploadingFile = useCallback((id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Generate AI profile
  const handleGenerateProfile = useCallback(async () => {
    if (!selectedPerson) return;

    setIsGeneratingProfile(true);
    setProfileError(null);

    try {
      const result = await generateProfileAction({ personId });
      if (!result.success) {
        setProfileError(result.error || "Failed to generate profile");
      }
    } catch (err) {
      console.error("Profile generation error:", err);
      setProfileError(err instanceof Error ? err.message : "Failed to generate profile");
    } finally {
      setIsGeneratingProfile(false);
    }
  }, [selectedPerson, personId, generateProfileAction]);

  // Only show processing state when we're actively generating (not from stale backend records)
  const isProfileProcessing = isGeneratingProfile;

  if (isLoadingPerson) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading dossier...</div>
      </div>
    );
  }

  if (!selectedPerson) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Subject not found</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to registry
        </Button>
      </div>
    );
  }

  const person = selectedPerson;
  const profile = selectedPerson.profile;
  const completeness = calculateProfileCompleteness(person, profile);
  const contactStatus = getContactStatus(person.lastInteractionAt);
  const RelIcon = relationshipConfig[person.relationshipType || "other"]?.icon || User;
  const relConfig = relationshipConfig[person.relationshipType || "other"] || relationshipConfig.other;
  const StatusIcon = contactStatus.icon;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {isRecording ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              className="gap-2 animate-pulse"
            >
              <Square className="h-4 w-4" />
              Stop ({formatRecordingTime(recordingDuration)})
            </Button>
          ) : isSaving ? (
            <Button variant="secondary" size="sm" disabled className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={startRecording}
              className="gap-2"
            >
              <Mic className="h-4 w-4" />
              Record Intel
            </Button>
          )}
          {person.memoCount > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant={profile ? "outline" : "default"}
                size="sm"
                onClick={handleGenerateProfile}
                disabled={isProfileProcessing}
                className="gap-2"
              >
                {isProfileProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {profile ? "Re-analyze" : "Analyze"}
                  </>
                )}
              </Button>
              {profileHistory && profileHistory.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`gap-1 text-xs h-7 px-2 ${isViewingHistory ? "text-amber-600" : "text-muted-foreground"}`}
                    >
                      <History className="h-3 w-3" />
                      v{selectedProfile?.version || profile?.version}
                      {isViewingHistory && " (old)"}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Profile History
                    </div>
                    <DropdownMenuSeparator />
                    {profileHistory.map((p, i) => (
                      <DropdownMenuItem
                        key={p._id}
                        onClick={() => setSelectedVersionId(i === 0 ? null : p._id)}
                        className={`text-xs ${
                          (i === 0 && !selectedVersionId) || p._id === selectedVersionId
                            ? "bg-accent"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>
                            v{p.version}
                            {i === 0 && " (latest)"}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                    {isViewingHistory && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setSelectedVersionId(null)}
                          className="text-xs text-primary"
                        >
                          ← Back to latest
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditDialog(true)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">
          {/* Masthead */}
          <div className="mb-8 flex items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-2xl text-4xl shadow-lg ring-4 ring-background"
                style={{
                  backgroundColor: person.color
                    ? `${person.color}20`
                    : "hsl(var(--muted))",
                  color: person.color || "hsl(var(--muted-foreground))",
                }}
              >
                {person.avatarEmoji || <User className="h-12 w-12" />}
              </div>
              {/* Status indicator */}
              <div
                className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background shadow ${contactStatus.color}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Subject Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {person.name}
                </h1>
                <Badge
                  variant="outline"
                  className={`gap-1 ${relConfig.color} border-current/20`}
                >
                  <RelIcon className="h-3 w-3" />
                  {relConfig.label}
                </Badge>
              </div>

              {person.nickname && (
                <p className="mt-1 text-lg text-muted-foreground">
                  a.k.a. "{person.nickname}"
                </p>
              )}

              {/* Quick Stats Strip */}
              <div className="mt-4 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last Contact:</span>
                  <span className="font-medium">
                    {person.lastInteractionAt
                      ? formatDistanceToNow(new Date(person.lastInteractionAt), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{person.memoCount}</span>
                  <span className="text-muted-foreground">intel entries</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`font-medium ${contactStatus.color}`}>
                    {contactStatus.label}
                  </span>
                </div>
              </div>

              {/* Profile Completeness */}
              <div className="mt-4 max-w-md">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">
                    Profile Completeness
                  </span>
                  <span className="font-mono">{completeness}%</span>
                </div>
                <Progress value={completeness} className="h-2" />
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Subject Overview */}
              {/* Viewing History Banner */}
              {isViewingHistory && selectedProfile && (
                <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2">
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <History className="h-4 w-4" />
                    <span>
                      Viewing v{selectedProfile.version} from{" "}
                      {format(new Date(selectedProfile.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({selectedProfile.memosAnalyzed} memos analyzed)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedVersionId(null)}
                    className="text-xs h-7"
                  >
                    Back to latest
                  </Button>
                </div>
              )}

              {selectedProfile?.summary && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <SectionHeader
                    icon={Target}
                    title="Subject Overview"
                    classification="INTEL-001"
                  />
                  <p className="text-sm leading-relaxed">{selectedProfile.summary}</p>
                </div>
              )}

              {/* Behavioral Analysis */}
              {selectedProfile?.communicationStyle && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <SectionHeader
                    icon={Brain}
                    title="Behavioral Analysis"
                    classification="PSYCH-002"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selectedProfile.communicationStyle.preferredChannels &&
                      selectedProfile.communicationStyle.preferredChannels.length >
                        0 && (
                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            PREFERRED CHANNELS
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedProfile.communicationStyle.preferredChannels.map(
                              (channel, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {channel}
                                </Badge>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    {selectedProfile.communicationStyle.responsePatterns && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          RESPONSE PATTERN
                        </div>
                        <p className="text-sm">
                          {selectedProfile.communicationStyle.responsePatterns}
                        </p>
                      </div>
                    )}
                    {selectedProfile.communicationStyle.conflictApproach && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          CONFLICT APPROACH
                        </div>
                        <p className="text-sm">
                          {selectedProfile.communicationStyle.conflictApproach}
                        </p>
                      </div>
                    )}
                    {selectedProfile.communicationStyle.expressionStyle && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          EXPRESSION STYLE
                        </div>
                        <p className="text-sm">
                          {selectedProfile.communicationStyle.expressionStyle}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Analyzing State - Compact inline */}
              {isProfileProcessing && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
                  <span className="text-sm text-primary font-medium">
                    Analyzing {person.memoCount} memo{person.memoCount !== 1 ? "s" : ""}...
                  </span>
                </div>
              )}

              {/* Error State - Compact inline */}
              {profileError && !isProfileProcessing && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <span className="text-sm text-destructive flex-1">{profileError}</span>
                  <Button variant="ghost" size="sm" onClick={handleGenerateProfile}>
                    Retry
                  </Button>
                </div>
              )}

              {/* No Memos State - Only show when zero memos */}
              {person.memoCount === 0 && !profile && (
                <div className="flex items-center gap-3 rounded-lg border border-muted bg-muted/30 px-4 py-3">
                  <Mic className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    Record voice memos to build AI profile
                  </span>
                </div>
              )}

              {/* Activity Log (Voice Memos) */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader
                    icon={Activity}
                    title="Activity Log"
                    classification={`${person.memoCount} ENTRIES`}
                  />
                </div>

                {/* Inline Recording/Saving UI */}
                {(isRecording || isSaving) && (
                  <div className="mb-4 rounded-lg border-2 border-primary/50 bg-primary/5 p-4">
                    {isRecording ? (
                      // Recording in progress
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 animate-pulse">
                          <Mic className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">Recording...</p>
                          <p className="text-2xl font-mono tabular-nums">
                            {formatRecordingTime(recordingDuration)}
                          </p>
                        </div>
                        <Button variant="destructive" onClick={stopRecording}>
                          <Square className="mr-2 h-4 w-4" />
                          Stop & Save
                        </Button>
                      </div>
                    ) : isSaving ? (
                      // Saving in progress
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                          <Loader2 className="h-6 w-6 text-primary animate-spin" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">Saving & transcribing...</p>
                          <p className="text-sm text-muted-foreground">
                            This will just take a moment
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Error message */}
                {recordingError && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    {recordingError}
                  </div>
                )}

                {linkedMemos && linkedMemos.length > 0 ? (
                  <div className="space-y-2">
                    {linkedMemos.filter(Boolean).map((memo) => (
                      <div
                        key={memo!._id}
                        className="flex items-center gap-4 rounded-lg bg-muted/50 p-3 hover:bg-muted/80 transition-colors group cursor-pointer"
                        onClick={() => setSelectedMemo(memo!)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Play className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {memo!.name || "Untitled Memo"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {memo!.transcript?.slice(0, 80)}
                            {(memo!.transcript?.length || 0) > 80 ? "..." : ""}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-mono text-muted-foreground">
                            {memo!.duration ? formatDuration(memo!.duration) : "--:--"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(memo!.clientCreatedAt || memo!.createdAt),
                              "MMM d"
                            )}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Remove this memo from this person?")) {
                              unlinkMemoFromPerson({
                                personId,
                                voiceMemoId: memo!._id,
                              });
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : !isRecording && !isSaving ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No intel recorded yet</p>
                  </div>
                ) : null}

                {!isRecording && !isSaving && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={startRecording}
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Add New Entry
                  </Button>
                )}
              </div>
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-6">
              {/* Personality Profile */}
              {selectedProfile?.personality && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <SectionHeader
                    icon={Shield}
                    title="Personality"
                    classification="PSYCH-003"
                  />
                  <div className="space-y-4">
                    {selectedProfile.personality.coreValues &&
                      selectedProfile.personality.coreValues.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            CORE VALUES
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedProfile.personality.coreValues.map((value, i) => (
                              <Badge
                                key={i}
                                className="bg-primary/10 text-primary border-primary/20"
                              >
                                {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    {selectedProfile.personality.interests &&
                      selectedProfile.personality.interests.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            INTERESTS
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedProfile.personality.interests.map((interest, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    {selectedProfile.personality.strengths &&
                      selectedProfile.personality.strengths.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            STRENGTHS
                          </div>
                          <ul className="text-sm space-y-1">
                            {selectedProfile.personality.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs">
                                <span className="text-green-500 mt-0.5">+</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {selectedProfile.personality.frictionPoints &&
                      selectedProfile.personality.frictionPoints.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-amber-600 mb-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            FRICTION POINTS
                          </div>
                          <ul className="text-sm space-y-1">
                            {selectedProfile.personality.frictionPoints.map((f, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs">
                                <span className="text-amber-500 mt-0.5">!</span>
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* Operational Intel (Tips) */}
              {selectedProfile?.tips && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <SectionHeader
                    icon={Lightbulb}
                    title="Intel"
                    classification="OPS-004"
                  />
                  <div className="space-y-4">
                    {selectedProfile.tips.doList && selectedProfile.tips.doList.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-green-600 mb-2">
                          DO
                        </div>
                        <ul className="text-xs space-y-1.5">
                          {selectedProfile.tips.doList.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedProfile.tips.avoidList &&
                      selectedProfile.tips.avoidList.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-red-600 mb-2">
                            AVOID
                          </div>
                          <ul className="text-xs space-y-1.5">
                            {selectedProfile.tips.avoidList.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <X className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {selectedProfile.tips.conversationStarters &&
                      selectedProfile.tips.conversationStarters.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            CONVERSATION STARTERS
                          </div>
                          <ul className="text-xs space-y-1.5">
                            {selectedProfile.tips.conversationStarters.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <ChevronRight className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* Field Notes */}
              {person.notes && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <SectionHeader icon={FileText} title="Field Notes" />
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {person.notes}
                  </p>
                </div>
              )}

              {/* Contact Info */}
              {(person.email || person.phone) && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-4">Contact Intel</h3>
                  <div className="space-y-3 text-sm">
                    {person.email && (
                      <div>
                        <div className="text-xs text-muted-foreground">EMAIL</div>
                        <p className="font-mono">{person.email}</p>
                      </div>
                    )}
                    {person.phone && (
                      <div>
                        <div className="text-xs text-muted-foreground">PHONE</div>
                        <p className="font-mono">{person.phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Intel Archive (File Upload) */}
              <div className="rounded-xl border border-border bg-card p-5">
                <SectionHeader icon={File} title="Intel Archive" />
                <div
                  className={`relative rounded-lg border-2 border-dashed p-4 transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDrop={handleFileDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept="image/*,.pdf,.doc,.docx,.txt,.md"
                  />
                  <div className="flex flex-col items-center gap-2 text-center pointer-events-none">
                    <Upload
                      className={`h-6 w-6 ${isDragging ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Drop files or click to upload
                    </p>
                  </div>
                </div>

                {/* Uploading files */}
                {uploadingFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadingFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-xs"
                      >
                        {file.status === "uploading" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : file.status === "error" ? (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        ) : (
                          getFileIcon(file.type)
                        )}
                        <span className="flex-1 truncate">{file.name}</span>
                        <span className="text-muted-foreground">
                          {file.status === "uploading"
                            ? "Uploading..."
                            : file.status === "error"
                              ? "Failed"
                              : formatFileSize(file.size)}
                        </span>
                        {file.status === "error" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoveUploadingFile(file.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Uploaded files from database */}
                {personFiles && personFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {personFiles.map((file) => (
                      <div
                        key={file._id}
                        className="flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-xs group"
                      >
                        {getFileIcon(file.mimeType)}
                        {file.url ? (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 truncate hover:text-primary hover:underline"
                          >
                            {file.name}
                          </a>
                        ) : (
                          <span className="flex-1 truncate">{file.name}</span>
                        )}
                        <span className="text-muted-foreground">
                          {formatFileSize(file.size)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveFile(file._id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-4">Record Metadata</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-mono">
                      {format(new Date(person.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-mono">
                      {format(new Date(person.updatedAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profile</span>
                    <span className="font-mono capitalize">
                      {selectedProfile?.confidence || "Pending"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <EditPersonDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        person={person}
      />
      <MemoDetailDialog
        memo={selectedMemo}
        open={selectedMemo !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMemo(null);
        }}
      />
    </div>
  );
}
