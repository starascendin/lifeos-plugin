import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Volume2 } from "lucide-react";

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

export function VoiceMemoRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start recording using Web API
  const startWebRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setError(null);
      setTranscription(null);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError("Failed to access microphone. Please check permissions.");
      console.error("Recording error:", err);
    }
  };

  // Stop recording
  const stopWebRecording = async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise<Blob>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());

        resolve(audioBlob);
      };

      mediaRecorder.stop();
      setIsRecording(false);

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
  };

  // Transcribe using Groq Whisper (via Tauri backend)
  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);

    try {
      if (isTauri) {
        // For Tauri, we'd call the backend
        // For now, show a placeholder message
        setTranscription(
          "Transcription requires Tauri backend. Recording saved locally."
        );
      } else {
        // For web, show a message that transcription isn't available
        setTranscription(
          "Voice memo recorded. Transcription available in Tauri desktop app."
        );
      }
    } catch (err) {
      setError("Failed to transcribe audio.");
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Handle record button click
  const handleRecordClick = async () => {
    if (isRecording) {
      const audioBlob = await stopWebRecording();
      if (audioBlob) {
        await transcribeAudio(audioBlob);
      }
    } else {
      setRecordingDuration(0);
      await startWebRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic className="h-5 w-5" />
          Quick Voice Note
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4">
          <Button
            variant={isRecording ? "destructive" : "default"}
            size="lg"
            onClick={handleRecordClick}
            disabled={isTranscribing}
            className="gap-2"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Transcribing...
              </>
            ) : isRecording ? (
              <>
                <Square className="h-4 w-4" />
                Stop ({formatDuration(recordingDuration)})
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Record
              </>
            )}
          </Button>

          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">Recording...</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        {transcription && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Transcription</span>
            </div>
            <p className="text-sm">{transcription}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          Record quick voice notes. Transcription is powered by Groq Whisper.
        </p>
      </CardContent>
    </Card>
  );
}
