import { useParams } from "react-router-dom";
import { AppShell } from "./AppShell";
import { InitiativesTab, InitiativeDetailView } from "@/components/initiatives";
import { InitiativesProvider } from "@/lib/contexts/InitiativesContext";
import type { Id } from "@holaai/convex";

export function LifeOSInitiatives() {
  const { id } = useParams<{ id?: string }>();
  const initiativeId = id as Id<"lifeos_yearlyInitiatives"> | undefined;

  return (
    <AppShell>
      <InitiativesProvider>
        {initiativeId ? (
          <InitiativeDetailView initiativeId={initiativeId} />
        ) : (
          <InitiativesTab />
        )}
      </InitiativesProvider>
    </AppShell>
  );
}
