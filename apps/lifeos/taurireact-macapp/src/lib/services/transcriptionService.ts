/**
 * GROQ Whisper transcription service
 * Transcribes audio blobs using the GROQ API
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-large-v3-turbo";

export interface TranscriptionResult {
  text: string;
  language?: string;
}

export interface TranscriptionError {
  message: string;
  code?: string;
}

/**
 * Transcribe an audio blob using GROQ's Whisper API
 */
export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  filename: string = "audio.webm"
): Promise<TranscriptionResult> {
  if (!apiKey) {
    throw new Error("GROQ API key is required. Please configure it in Settings.");
  }

  // Create form data
  const formData = new FormData();
  formData.append("model", WHISPER_MODEL);
  formData.append("response_format", "verbose_json");
  formData.append("file", audioBlob, filename);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `GROQ API error: ${response.status}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();

    return {
      text: result.text || "",
      language: result.language,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to transcribe audio");
  }
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "webm",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/ogg;codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/flac": "flac",
  };

  return mimeToExt[mimeType] || "webm";
}
