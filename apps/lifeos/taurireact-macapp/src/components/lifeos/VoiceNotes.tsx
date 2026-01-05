import { AppShell } from "./AppShell";
import { VoiceMemosTab } from "../voicememos/VoiceMemosTab";

export function LifeOSVoiceNotes() {
  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="font-bold text-3xl">Voice Notes</h1>
          <p className="text-muted-foreground">
            Transcriptions from your macOS Voice Memos
          </p>
        </div>
        <VoiceMemosTab />
      </div>
    </AppShell>
  );
}
