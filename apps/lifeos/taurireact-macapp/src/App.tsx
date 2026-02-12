import { useEffect } from "react";
import { SignedIn, SignedOut } from "@/lib/auth/platformClerk";
import { AuthGate } from "./components/auth/AuthGate";
import { SignInEntry } from "./components/auth/SignInEntry";
import { MainContent } from "./components/MainContent";
import { SyncProvider } from "./lib/contexts/SyncContext";
import { PomodoroProvider } from "./lib/contexts/PomodoroContext";
import { ThemeProvider } from "./lib/contexts/ThemeContext";
import { useVoiceMemoAutoSync } from "./lib/hooks/useVoiceMemoAutoSync";
import "./App.css";

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

function VoiceMemoAutoSyncRunner() {
  useVoiceMemoAutoSync();
  return null;
}

function App() {
  useEffect(() => {
    if (!isTauri) return;

    // Dynamically import Tauri APIs only when running in Tauri
    const setupTauri = async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");

      // Hide window on close instead of quit (menu bar behavior)
      const appWindow = getCurrentWindow();
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
    <ThemeProvider defaultTheme="system">
      <SignedOut>
        <SignInEntry />
      </SignedOut>
      <SignedIn>
        <AuthGate>
          <VoiceMemoAutoSyncRunner />
          <PomodoroProvider>
            <SyncProvider>
              <MainContent />
            </SyncProvider>
          </PomodoroProvider>
        </AuthGate>
      </SignedIn>
    </ThemeProvider>
  );
}

export default App;
