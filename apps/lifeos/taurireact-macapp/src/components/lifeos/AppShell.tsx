import { SidebarProvider } from "@/lib/contexts/SidebarContext";
import { CommandMenu } from "./CommandMenu";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <CommandMenu />
      <div className="flex h-screen overflow-hidden bg-sidebar/30">
        <div className="p-2">
          <Sidebar />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-auto rounded-tl-lg bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
