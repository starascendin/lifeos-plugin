import { AppShell } from "./AppShell";
import { PMProvider } from "@/lib/contexts/PMContext";
import { PMTab } from "@/components/pm/PMTab";

export function LifeOSPM() {
  return (
    <AppShell>
      <PMProvider>
        <PMTab />
      </PMProvider>
    </AppShell>
  );
}
