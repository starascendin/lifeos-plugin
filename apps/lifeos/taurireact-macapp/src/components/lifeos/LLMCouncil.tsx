import { AppShell } from "./AppShell";
import { LLMCouncilProvider } from "@/lib/contexts/LLMCouncilContext";
import { LLMCouncilTab } from "@/components/llmcouncil/LLMCouncilTab";

export function LifeOSLLMCouncil() {
  return (
    <AppShell>
      <LLMCouncilProvider>
        <LLMCouncilTab />
      </LLMCouncilProvider>
    </AppShell>
  );
}
