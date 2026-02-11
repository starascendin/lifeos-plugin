import { AppShell } from "./AppShell";
import { CustomAgentsTab } from "../customagents/CustomAgentsTab";

export function LifeOSCustomAgents() {
  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto p-6">
          <CustomAgentsTab />
        </div>
      </div>
    </AppShell>
  );
}
