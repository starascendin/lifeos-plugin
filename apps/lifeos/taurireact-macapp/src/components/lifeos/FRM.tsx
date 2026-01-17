import { AppShell } from "./AppShell";
import { FRMProvider } from "@/lib/contexts/FRMContext";
import { FRMTab } from "@/components/frm/FRMTab";

export function LifeOSFRM() {
  return (
    <AppShell>
      <FRMProvider>
        <FRMTab />
      </FRMProvider>
    </AppShell>
  );
}
