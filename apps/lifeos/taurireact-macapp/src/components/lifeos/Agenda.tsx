import { AppShell } from "./AppShell";
import { AgendaProvider } from "@/lib/contexts/AgendaContext";
import { PMProvider } from "@/lib/contexts/PMContext";
import { AgendaTab } from "@/components/agenda/AgendaTab";

export function LifeOSAgenda() {
  return (
    <AppShell>
      <PMProvider>
        <AgendaProvider>
          <AgendaTab />
        </AgendaProvider>
      </PMProvider>
    </AppShell>
  );
}
