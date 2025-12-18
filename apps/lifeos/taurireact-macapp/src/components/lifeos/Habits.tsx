import { AppShell } from "./AppShell";
import { HabitsProvider } from "@/lib/contexts/HabitsContext";
import { HabitsTab } from "@/components/habits/HabitsTab";

export function LifeOSHabits() {
  return (
    <AppShell>
      <HabitsProvider>
        <HabitsTab />
      </HabitsProvider>
    </AppShell>
  );
}
