import { useEffect } from "react";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SignIn } from "./components/auth/SignIn";
import { AuthGate } from "./components/auth/AuthGate";
import { ThemeProvider } from "./lib/contexts/ThemeContext";
import { PomodoroProvider } from "./lib/contexts/PomodoroContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { LifeOSDashboard } from "./components/lifeos/Dashboard";
import { LifeOSSettings } from "./components/lifeos/Settings";
import { LifeOSChatNexus } from "./components/lifeos/ChatNexus";
import { LifeOSLLMCouncil } from "./components/lifeos/LLMCouncil";
import { LifeOSPM } from "./components/lifeos/PM";
import { LifeOSPMAI } from "./components/lifeos/PMAI";
import { LifeOSHabits } from "./components/lifeos/Habits";
import { LifeOSVoiceAgent } from "./components/lifeos/VoiceAgent";
import { LifeOSAIAgent } from "./components/lifeos/AIAgent";
import { LifeOSAgenda } from "./components/lifeos/Agenda";

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
            <PomodoroProvider>
              <Routes>
                <Route index element={<LifeOSDashboard />} />
                <Route path="agenda" element={<LifeOSAgenda />} />
                <Route path="agenda/:view" element={<LifeOSAgenda />} />
                <Route path="chatnexus" element={<LifeOSChatNexus />} />
                <Route path="llmcouncil" element={<LifeOSLLMCouncil />} />
                <Route path="pm" element={<LifeOSPM />} />
                <Route path="pm/:view" element={<LifeOSPM />} />
                <Route path="pm/:view/:id" element={<LifeOSPM />} />
                <Route path="pm-ai" element={<LifeOSPMAI />} />
                <Route path="habits" element={<LifeOSHabits />} />
                <Route path="voiceagent" element={<LifeOSVoiceAgent />} />
                <Route path="aiagent" element={<LifeOSAIAgent />} />
                <Route path="settings" element={<LifeOSSettings />} />
                <Route path="*" element={<Navigate to="/lifeos" replace />} />
              </Routes>
            </PomodoroProvider>
          </AuthGate>
        </SignedIn>
      </TooltipProvider>
    </ThemeProvider>
  );
}
