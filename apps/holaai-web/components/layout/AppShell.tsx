"use client";

import { Sidebar } from "./Sidebar";
import { SidebarProvider } from "@/lib/sidebar-context";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="h-screen flex overflow-hidden bg-sidebar/30">
        <div className="p-2">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-auto bg-background rounded-tl-lg">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
