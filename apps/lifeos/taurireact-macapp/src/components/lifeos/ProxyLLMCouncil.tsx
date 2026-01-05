import { AppShell } from "./AppShell";

export function LifeOSProxyLLMCouncil() {
  return (
    <AppShell>
      <div className="h-full w-full">
        <iframe
          src="http://100.78.128.121:3456"
          className="h-full w-full border-0"
          title="Proxy LLM Council"
        />
      </div>
    </AppShell>
  );
}
