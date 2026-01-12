import { SidebarProvider, useSidebar } from "@/lib/contexts/SidebarContext";
import { CommandMenu } from "./CommandMenu";
import { Sidebar } from "./Sidebar";
import { FloatingVoiceWidget } from "../voiceagent/FloatingVoiceWidget";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

function AppShellContent({ children }: AppShellProps) {
  const { isMobileOpen, toggleMobileSidebar, closeMobileSidebar } = useSidebar();

  return (
    <>
      <CommandMenu />
      <FloatingVoiceWidget />
      <div className="flex h-screen overflow-hidden bg-sidebar/30">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden md:block p-2">
          <Sidebar />
        </div>

        {/* Mobile Sidebar Overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={closeMobileSidebar}
          />
        )}

        {/* Mobile Sidebar */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:hidden",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-full px-2 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
            <Sidebar isMobile />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile Header with hamburger */}
          <div className="flex items-center gap-3 border-b bg-background px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMobileSidebar}
              className="h-9 w-9"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="font-bold text-lg">LifeOS</h1>
          </div>

          <main className="flex-1 overflow-auto rounded-tl-lg bg-background md:rounded-tl-lg">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppShellContent>{children}</AppShellContent>
    </SidebarProvider>
  );
}
