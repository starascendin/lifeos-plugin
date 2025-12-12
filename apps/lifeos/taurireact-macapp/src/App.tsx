import { useEffect } from "react";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { AuthGate } from "./components/auth/AuthGate";
import { SignIn } from "./components/auth/SignIn";
import { MainContent } from "./components/MainContent";
import { SyncProvider } from "./lib/contexts/SyncContext";
import "./App.css";

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

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
    <>
      <SignedOut>
        <SignIn />
      </SignedOut>
      <SignedIn>
        <AuthGate>
          <SyncProvider>
            <MainContent />
          </SyncProvider>
        </AuthGate>
      </SignedIn>
    </>
  );
}

export default App;
