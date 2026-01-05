import { AppShell } from "./AppShell";

export function LifeOSProxyLLMCouncil() {
  return (
    <AppShell>
      <div className="h-full w-full">
        <iframe
          src="http://100.88.254.63:3456"
          className="h-full w-full border-0"
          title="Proxy LLM Council"
        />
      </div>
    </AppShell>
  );
}
