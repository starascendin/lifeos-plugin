import { useState } from "react";
import { AppShell } from "./AppShell";
import { VoiceMemosTab } from "../voicememos/VoiceMemosTab";
import { EnhancedMemosTab } from "../voicememos/EnhancedMemosTab";
import { SystemPromptDialog } from "../voicememos/extraction/SystemPromptSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Sparkles } from "lucide-react";

export function LifeOSVoiceNotes() {
  const [activeTab, setActiveTab] = useState<"source" | "enhanced">("source");

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-3xl">Voice Notes</h1>
            <p className="text-muted-foreground">
              {activeTab === "source"
                ? "Transcriptions from your macOS Voice Memos"
                : "AI-enhanced voice memos with insights"}
            </p>
          </div>
          {activeTab === "enhanced" && <SystemPromptDialog />}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "source" | "enhanced")}>
          <TabsList className="mb-4">
            <TabsTrigger value="source" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Source Memos
            </TabsTrigger>
            <TabsTrigger value="enhanced" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Enhanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="source" className="mt-0">
            <VoiceMemosTab />
          </TabsContent>

          <TabsContent value="enhanced" className="mt-0">
            <EnhancedMemosTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
