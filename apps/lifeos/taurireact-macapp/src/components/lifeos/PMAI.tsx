import { AppShell } from "./AppShell";
import { PMProvider } from "@/lib/contexts/PMContext";
import { PMAITab } from "@/components/pm/ai";

export function LifeOSPMAI() {
  return (
    <AppShell>
      <PMProvider>
        <PMAITab />
      </PMProvider>
    </AppShell>
  );
}
