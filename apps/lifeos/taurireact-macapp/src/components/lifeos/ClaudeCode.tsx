import { AppShell } from "./AppShell";
import { ClaudeCodeProvider } from "@/lib/contexts/ClaudeCodeContext";
import { ClaudeCodeTab } from "@/components/claudecode/ClaudeCodeTab";

export function LifeOSClaudeCode() {
  return (
    <AppShell>
      <ClaudeCodeProvider>
        <ClaudeCodeTab />
      </ClaudeCodeProvider>
    </AppShell>
  );
}
