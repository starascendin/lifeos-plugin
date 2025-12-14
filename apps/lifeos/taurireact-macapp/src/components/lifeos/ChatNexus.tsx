import { AppShell } from "./AppShell";
import { ChatNexusTab } from "../chatnexus";

export function LifeOSChatNexus() {
  return (
    <AppShell>
      <div className="h-full">
        <ChatNexusTab />
      </div>
    </AppShell>
  );
}
