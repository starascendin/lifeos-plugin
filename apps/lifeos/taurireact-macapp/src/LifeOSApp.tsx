import { useEffect } from "react";
import { toast } from "sonner";
import { SignedIn, SignedOut } from "@/lib/auth/platformClerk";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { SignInEntry } from "./components/auth/SignInEntry";
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
import { LifeOSFocus } from "./components/lifeos/Focus";
import { LifeOSAvatar } from "./components/lifeos/Avatar";
import { LifeOSVoiceAgent } from "./components/lifeos/VoiceAgent";
import { LifeOSVoiceNotes } from "./components/lifeos/VoiceNotes";
import { LifeOSAIAgent } from "./components/lifeos/AIAgent";
import { LifeOSAgenda } from "./components/lifeos/Agenda";
import { LifeOSAtlas } from "./components/lifeos/Atlas";
import { LifeOSInitiatives } from "./components/lifeos/Initiatives";
import { LifeOSFRM } from "./components/lifeos/FRM";
import { LifeOSClientProjects } from "./components/lifeos/ClientProjects";
import { LifeOSBeeper } from "./components/lifeos/Beeper";
import { LifeOSClaudeCode } from "./components/lifeos/ClaudeCode";
import { LifeOSGranolaAI } from "./components/lifeos/GranolaAI";
import { LifeOSFathomAI } from "./components/lifeos/FathomAI";
import { LifeOSCatGirl } from "./components/lifeos/CatGirl";
import { LifeOSCoaching } from "./components/lifeos/Coaching";
import { LifeOSCustomAgents } from "./components/lifeos/CustomAgents";
import { LifeOSFinance } from "./components/lifeos/Finance";
import { LifeOSPersonalHealth } from "./components/lifeos/PersonalHealth";
import { CommandPalette } from "./components/lifeos/CommandPalette";
import { useVoiceMemoAutoSync } from "./lib/hooks/useVoiceMemoAutoSync";
import { VoiceMemoAutoSyncProvider } from "./lib/contexts/VoiceMemoAutoSyncContext";
import { useAction } from "convex/react";
import { useConvex } from "convex/react";
import { api } from "@holaai/convex";
import { useNavigate } from "react-router-dom";
import { syncEmpowerToConvex } from "./lib/services/empower";
import type { ConvexClient } from "convex/browser";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/** Runs the voice memo auto-sync pipeline in the background (no UI). */
function VoiceMemoAutoSyncRunner() {
  useVoiceMemoAutoSync();
  return null;
}

/** Auto-detect Oura OAuth token/code from redirect and save it. */
function OuraOAuthCodeHandler() {
  const saveImplicitToken = useAction(api.lifeos.oura_actions.saveImplicitToken);
  const exchangeToken = useAction(api.lifeos.oura_actions.exchangeToken);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 1. Check for implicit flow token stashed in sessionStorage by main.tsx
    const stashed = sessionStorage.getItem("oura_implicit_token");
    if (stashed) {
      sessionStorage.removeItem("oura_implicit_token");
      const { accessToken, expiresIn, scope } = JSON.parse(stashed);
      saveImplicitToken({ accessToken, expiresIn, scope })
        .then(() => {
          toast.success("Oura Ring connected!");
          navigate("/lifeos/health");
        })
        .catch((err: any) => toast.error(`Oura OAuth failed: ${err.message}`));
      return;
    }

    // 2. Fallback: server-side code flow
    const params = new URLSearchParams(location.search || window.location.search);
    const code = params.get("code");
    if (!code) return;

    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split("?")[0]);

    exchangeToken({ code })
      .then(() => {
        toast.success("Oura Ring connected!");
        navigate("/lifeos/health");
      })
      .catch((err: any) => toast.error(`Oura OAuth failed: ${err.message}`));
  }, [saveImplicitToken, exchangeToken, navigate, location.search]);

  return null;
}

/** Listens for Rust cron-triggered scrape events and syncs data to Convex. */
function EmpowerCronSyncListener() {
  const convex = useConvex();

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen("empower-cron-triggered", async () => {
        console.log("[Empower Cron] Background scrape completed, syncing to Convex...");
        toast.info("Empower scrape completed", {
          description: "Syncing data to Convex...",
        });
        try {
          const result = await syncEmpowerToConvex(
            convex as unknown as ConvexClient,
          );
          if (result.success) {
            toast.success("Empower cron sync complete", {
              description: result.message,
            });
          } else {
            toast.error("Empower cron sync failed", {
              description: result.message,
            });
          }
        } catch (e) {
          toast.error("Empower cron sync error", {
            description: String(e),
          });
        }
      });
    };

    setup();
    return () => {
      unlisten?.();
    };
  }, [convex]);

  return null;
}

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
          <SignInEntry />
        </SignedOut>
        <SignedIn>
          <AuthGate>
            <VoiceMemoAutoSyncProvider>
            <VoiceMemoAutoSyncRunner />
            <EmpowerCronSyncListener />
            <VoiceAgentProvider>
              <PomodoroProvider>
                <CommandPalette />
                <OuraOAuthCodeHandler />
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
                  <Route path="pm/clients" element={<LifeOSClientProjects />} />
                  <Route
                    path="pm/clients/:view"
                    element={<LifeOSClientProjects />}
                  />
                  <Route path="habits" element={<LifeOSHabits />} />
                  <Route path="focus" element={<LifeOSFocus />} />
                  <Route path="frm" element={<LifeOSFRM />} />
                  <Route path="frm/:tab" element={<LifeOSFRM />} />
                  <Route path="frm/:tab/:id" element={<LifeOSFRM />} />
                  <Route path="beeper" element={<LifeOSBeeper />} />
                  <Route path="granola" element={<LifeOSGranolaAI />} />
                  <Route path="fathom" element={<LifeOSFathomAI />} />
                  <Route path="claudecode" element={<LifeOSClaudeCode />} />
                  <Route path="avatar" element={<LifeOSAvatar />} />
                  <Route path="voiceagent" element={<LifeOSVoiceAgent />} />
                  <Route path="voicenotes" element={<LifeOSVoiceNotes />} />
                  <Route path="aiagent" element={<LifeOSAIAgent />} />
                  <Route path="coaching" element={<LifeOSCoaching />} />
                  <Route
                    path="custom-agents"
                    element={<LifeOSCustomAgents />}
                  />
                  <Route path="finance" element={<LifeOSFinance />} />
                  <Route path="health" element={<LifeOSPersonalHealth />} />
                  <Route path="catgirl" element={<LifeOSCatGirl />} />
                  <Route path="settings" element={<LifeOSSettings />} />
                  <Route path="*" element={<Navigate to="/lifeos" replace />} />
                </Routes>
              </PomodoroProvider>
            </VoiceAgentProvider>
            </VoiceMemoAutoSyncProvider>
          </AuthGate>
        </SignedIn>
      </TooltipProvider>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
