import { AppShell } from "./AppShell";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  LLMCouncilAPIProvider,
  useLLMCouncilAPI,
} from "@/lib/contexts/LLMCouncilAPIContext";
import {
  LLMCouncilAPIToolbar,
  CouncilView,
  MultiChatView,
  LLMCouncilAPIInput,
} from "./llmcouncilapi";

function LLMCouncilAPIContent() {
  const { viewMode } = useLLMCouncilAPI();

  return (
    <div className="flex h-full flex-col">
      {/* Top Toolbar */}
      <LLMCouncilAPIToolbar />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "council" ? <CouncilView /> : <MultiChatView />}
      </div>

      {/* Bottom Input */}
      <LLMCouncilAPIInput />
    </div>
  );
}

function LLMCouncilAPIWrapper() {
  return (
    <LLMCouncilAPIProvider>
      <LLMCouncilAPIContent />
    </LLMCouncilAPIProvider>
  );
}

export function LifeOSLLMCouncilAPI() {
  return (
    <AppShell>
      <LLMCouncilAPIWrapper />
    </AppShell>
  );
}
