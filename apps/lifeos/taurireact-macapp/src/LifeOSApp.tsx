import { useEffect } from "react";
import { toast } from "sonner";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SignIn } from "./components/auth/SignIn";
import { AuthGate } from "./components/auth/AuthGate";
import { ThemeProvider } from "./lib/contexts/ThemeContext";
import { PomodoroProvider } from "./lib/contexts/PomodoroContext";
import { VoiceAgentProvider } from "./lib/contexts/VoiceAgentContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import { LifeOSDashboard } from "./components/lifeos/Dashboard";
import { LifeOSSettings } from "./components/lifeos/Settings";
import { LifeOSChatNexus } from "./components/lifeos/ChatNexus";
import { LifeOSLLMCouncil } from "./components/lifeos/LLMCouncil";
import { LifeOSProxyLLMCouncil } from "./components/lifeos/ProxyLLMCouncil";
import { LifeOSLLMCouncilAPI } from "./components/lifeos/LLMCouncilAPIPage";
import { LifeOSPM } from "./components/lifeos/PM";
import { LifeOSPMAI } from "./components/lifeos/PMAI";
import { LifeOSHabits } from "./components/lifeos/Habits";
import { LifeOSAvatar } from "./components/lifeos/Avatar";
import { LifeOSVoiceAgent } from "./components/lifeos/VoiceAgent";
import { LifeOSVoiceNotes } from "./components/lifeos/VoiceNotes";
import { LifeOSAIAgent } from "./components/lifeos/AIAgent";
import { LifeOSAgenda } from "./components/lifeos/Agenda";
import { LifeOSAtlas } from "./components/lifeos/Atlas";
import { LifeOSInitiatives } from "./components/lifeos/Initiatives";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

export default function LifeOSApp() {
  useEffect(() => {
    if (!isTauri) return;

    const setupTauri = async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();

      // Hide window on close (menu bar app behavior)
      const unlisten = await appWindow.onCloseRequested(async (event) => {
        event.preventDefault();
        await appWindow.hide();
      });

      // Check Full Disk Access permission for Voice Memos
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const hasPermission = await invoke<boolean>(
          "check_voicememos_permission",
        );

        if (!hasPermission) {
          toast.warning("Full Disk Access Required", {
            description:
              "Grant Full Disk Access to sync Voice Memos from macOS.",
            duration: Infinity,
            action: {
              label: "Open Settings",
              onClick: async () => {
                await invoke("open_full_disk_access_settings");
              },
            },
          });
        }
      } catch (error) {
        console.error("Failed to check voice memos permission:", error);
      }

      return unlisten;
    };

    const cleanup = setupTauri();
    return () => {
      cleanup.then((unlisten) => unlisten?.());
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider delayDuration={300}>
        <SignedOut>
          <SignIn />
        </SignedOut>
        <SignedIn>
          <AuthGate>
            <VoiceAgentProvider>
              <PomodoroProvider>
                <Routes>
                  <Route index element={<LifeOSDashboard />} />
                  <Route path="atlas" element={<LifeOSAtlas />} />
                  <Route path="agenda" element={<LifeOSAgenda />} />
                  <Route path="agenda/:view" element={<LifeOSAgenda />} />
                  <Route path="initiatives" element={<LifeOSInitiatives />} />
                  <Route
                    path="initiatives/:id"
                    element={<LifeOSInitiatives />}
                  />
                  <Route path="chatnexus" element={<LifeOSChatNexus />} />
                  <Route path="llmcouncil" element={<LifeOSLLMCouncil />} />
                  <Route
                    path="proxy-council"
                    element={<LifeOSProxyLLMCouncil />}
                  />
                  <Route path="council-api" element={<LifeOSLLMCouncilAPI />} />
                  <Route path="pm" element={<LifeOSPM />} />
                  <Route path="pm/:view" element={<LifeOSPM />} />
                  <Route path="pm/:view/:id" element={<LifeOSPM />} />
                  <Route path="pm-ai" element={<LifeOSPMAI />} />
                  <Route path="habits" element={<LifeOSHabits />} />
                  <Route path="avatar" element={<LifeOSAvatar />} />
                  <Route path="voiceagent" element={<LifeOSVoiceAgent />} />
                  <Route path="voicenotes" element={<LifeOSVoiceNotes />} />
                  <Route path="aiagent" element={<LifeOSAIAgent />} />
                  <Route path="settings" element={<LifeOSSettings />} />
                  <Route path="*" element={<Navigate to="/lifeos" replace />} />
                </Routes>
              </PomodoroProvider>
            </VoiceAgentProvider>
          </AuthGate>
        </SignedIn>
      </TooltipProvider>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
