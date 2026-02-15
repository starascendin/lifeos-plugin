import { SidebarProvider, useSidebar } from "@/lib/contexts/SidebarContext";
import { CommandMenu } from "./CommandMenu";
import { Sidebar } from "./Sidebar";
import { FloatingVoiceWidget } from "../voiceagent/FloatingVoiceWidget";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

const ROUTE_TITLES: Record<string, string> = {
  "/lifeos": "Dashboard",
  "/lifeos/agenda": "Agenda",
  "/lifeos/initiatives": "Initiatives",
  "/lifeos/habits": "Habits",
  "/lifeos/focus": "Focus",
  "/lifeos/voicenotes": "Voice Notes",
  "/lifeos/voiceagent": "Voice AI",
  "/lifeos/aiagent": "AI Agent",
  "/lifeos/pm": "Issues",
  "/lifeos/pm/projects": "Projects",
  "/lifeos/pm/cycles": "Cycles",
  "/lifeos/pm/clients": "Clients",
  "/lifeos/pm/contacts": "Contacts",
  "/lifeos/pm-ai": "PM AI",
  "/lifeos/beeper": "Beeper",
  "/lifeos/granola": "Granola",
  "/lifeos/fathom": "Fathom",
  "/lifeos/frm/people": "People",
  "/lifeos/frm/timeline": "Timeline",
  "/lifeos/atlas": "Atlas",
  "/lifeos/avatar": "Avatar",
  "/lifeos/proxy-council": "Proxy Council",
  "/lifeos/council-api": "Council API",
  "/lifeos/chatnexus": "Chat Nexus",
  "/lifeos/llmcouncil": "LLM Council",
  "/lifeos/claudecode": "ClaudeCode",
  "/lifeos/custom-agents": "Custom Agents",
  "/lifeos/finance": "Personal Finance",
  "/lifeos/health": "Health",
  "/lifeos/coaching": "AI Coach",
  "/lifeos/catgirl": "CatGirl",
  "/lifeos/settings": "Settings",
};

function usePageTitle(): string {
  const { pathname } = useLocation();
  // Try exact match first, then progressively shorter prefixes
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  // Handle sub-routes (e.g. /lifeos/pm/projects/123 -> "Projects")
  const segments = pathname.split("/");
  while (segments.length > 2) {
    const prefix = segments.join("/");
    if (ROUTE_TITLES[prefix]) return ROUTE_TITLES[prefix];
    segments.pop();
  }
  return "LifeOS";
}

interface AppShellProps {
  children: React.ReactNode;
}

function AppShellContent({ children }: AppShellProps) {
  const { isMobileOpen, toggleMobileSidebar, closeMobileSidebar } =
    useSidebar();
  const pageTitle = usePageTitle();

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
            "fixed inset-y-0 left-0 z-50 w-64 overflow-hidden transform transition-transform duration-300 ease-in-out md:hidden",
            isMobileOpen ? "translate-x-0" : "-translate-x-full",
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
            <h1 className="font-bold text-lg">{pageTitle}</h1>
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
