import { AppShell } from "./AppShell";
import { AgendaProvider } from "@/lib/contexts/AgendaContext";
import { AgendaTab } from "@/components/agenda/AgendaTab";

export function LifeOSAgenda() {
  return (
    <AppShell>
      <AgendaProvider>
        <AgendaTab />
      </AgendaProvider>
    </AppShell>
  );
}
