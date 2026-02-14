import { AppShell } from "./AppShell";
import { CoachingTab } from "../coaching/CoachingTab";

export function LifeOSCoaching() {
  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto p-6">
          <CoachingTab />
        </div>
      </div>
    </AppShell>
  );
}
