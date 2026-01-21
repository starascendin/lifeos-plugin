import { AppShell } from "./AppShell";
import { BeeperProvider } from "@/lib/contexts/BeeperContext";
import { BeeperTab } from "@/components/beeper/BeeperTab";

export function LifeOSBeeper() {
  return (
    <AppShell>
      <BeeperProvider>
        <BeeperTab />
      </BeeperProvider>
    </AppShell>
  );
}
