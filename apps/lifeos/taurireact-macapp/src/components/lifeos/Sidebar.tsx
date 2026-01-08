import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { useVoiceAgent } from "@/lib/contexts/VoiceAgentContext";
import { cn } from "@/lib/utils";
import { useClerk, useUser } from "@clerk/clerk-react";
import { Link, useLocation } from "react-router-dom";
import {
  Bot,
  Box,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Cpu,
  FileAudio,
  Globe,
  Headphones,
  Kanban,
  Mic,
  Network,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MessageSquare,
  FolderKanban,
  RefreshCw,
  Settings,
  Sparkles,
  Target,
  User,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useMemo, useState } from "react";

interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { name: string; href: string; icon?: React.ComponentType<{ className?: string }> }[];
  onClick?: () => void | Promise<void>;
}

interface SidebarProps {
  isMobile?: boolean;
}

export function Sidebar({ isMobile = false }: SidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isCollapsed, toggleSidebar, closeMobileSidebar } = useSidebar();
  const { connectionState, connect, disconnect, isConfigured } = useVoiceAgent();
  const [expandedSections, setExpandedSections] = useState<string[]>(["Projects"]);

  const signOutToLifeOS = async () => {
    // Keep user in the LifeOS route after logout so re-login doesn't land on the background app.
    await (signOut as any)({ redirectUrl: "/#/lifeos" });
  };

  // For mobile, always show expanded sidebar
  const effectiveCollapsed = isMobile ? false : isCollapsed;

  // Track previous pathname to detect actual route changes
  const prevPathnameRef = useRef(pathname);

  // Close mobile sidebar on route change (not on initial mount)
  useEffect(() => {
    if (isMobile && prevPathnameRef.current !== pathname) {
      closeMobileSidebar();
    }
    prevPathnameRef.current = pathname;
  }, [pathname, isMobile, closeMobileSidebar]);

  const toggleSection = (name: string) => {
    setExpandedSections((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const navigation: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { name: "Dashboard", href: "/lifeos", icon: LayoutDashboard },
      { name: "Agenda", href: "/lifeos/agenda", icon: Calendar },
      {
        name: "Projects",
        href: "/lifeos/pm",
        icon: Kanban,
        children: [
          { name: "All Issues", href: "/lifeos/pm", icon: ListTodo },
          { name: "Projects", href: "/lifeos/pm/projects", icon: FolderKanban },
          { name: "Cycles", href: "/lifeos/pm/cycles", icon: RefreshCw },
        ],
      },
      { name: "PM AI", href: "/lifeos/pm-ai", icon: Bot },
      { name: "Habits", href: "/lifeos/habits", icon: Target },
      {
        name: "3D Views",
        href: "/lifeos/atlas",
        icon: Box,
        children: [
          { name: "Atlas", href: "/lifeos/atlas", icon: Globe },
          { name: "Avatar", href: "/lifeos/avatar", icon: UserCircle },
        ],
      },
      {
        name: "LLM Councils",
        href: "/lifeos/proxy-council",
        icon: Users,
        children: [
          { name: "Proxy Council", href: "/lifeos/proxy-council", icon: Network },
          { name: "Council API", href: "/lifeos/council-api", icon: Cpu },
          { name: "Chat Nexus", href: "/lifeos/chatnexus", icon: MessageSquare },
          { name: "LLM Council", href: "/lifeos/llmcouncil", icon: Users },
        ],
      },
      {
        name: "Voice AI",
        href: "/lifeos/voiceagent",
        icon: Headphones,
        children: [
          { name: "Voice Agent", href: "/lifeos/voiceagent", icon: Headphones },
          { name: "AI Agent", href: "/lifeos/aiagent", icon: Cpu },
        ],
      },
      {
        name: "Voice Notes",
        href: "/lifeos/voicenotes",
        icon: Mic,
        children: [
          { name: "Voice Notes", href: "/lifeos/voicenotes", icon: FileAudio },
        ],
      },
      { name: "Settings", href: "/lifeos/settings", icon: Settings },
      {
        name: "Logout",
        icon: LogOut,
        onClick: async () => {
          if (isMobile) closeMobileSidebar();
          await signOutToLifeOS();
        },
      },
    ];
    return items;
  }, [closeMobileSidebar, isMobile, signOutToLifeOS]);

  return (
    <aside
      className={cn(
        "h-full rounded-lg border border-sidebar-border bg-sidebar text-sidebar-foreground shadow transition-all duration-300",
        effectiveCollapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Header with branding */}
        <div
          className={cn(
            "flex items-center border-sidebar-border border-b",
            effectiveCollapsed ? "justify-center p-4" : "justify-between p-6",
          )}
        >
          {!effectiveCollapsed && <h1 className="font-bold text-xl">LifeOS</h1>}
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={closeMobileSidebar}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className={cn("h-8 w-8", effectiveCollapsed && "mx-auto")}
                >
                  {effectiveCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Butler AI Button */}
        <div
          className={cn(
            "border-b border-sidebar-border",
            effectiveCollapsed ? "px-2 py-2" : "px-4 py-3",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={connectionState === "connected" ? "default" : "outline"}
                className={cn(
                  "w-full transition-all",
                  effectiveCollapsed ? "justify-center p-3" : "justify-start gap-3",
                  connectionState === "connected" && "bg-primary hover:bg-primary/90",
                )}
                onClick={() => {
                  if (connectionState === "connected") {
                    disconnect();
                  } else if (connectionState === "disconnected") {
                    connect();
                  }
                }}
                disabled={!isConfigured || connectionState === "connecting"}
              >
                <div className="relative">
                  <Sparkles className={cn(
                    "h-5 w-5",
                    connectionState === "connecting" && "animate-pulse"
                  )} />
                  {connectionState === "connected" && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                  )}
                </div>
                {!effectiveCollapsed && (
                  <span className="font-medium">
                    {connectionState === "connecting"
                      ? "Connecting..."
                      : connectionState === "connected"
                        ? "Butler AI Active"
                        : "Butler AI"}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            {effectiveCollapsed && (
              <TooltipContent side="right">
                {connectionState === "connected"
                  ? "Disconnect Butler AI"
                  : connectionState === "connecting"
                    ? "Connecting..."
                    : "Connect Butler AI"}
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            "flex-1 min-h-0 overflow-y-auto space-y-1",
            effectiveCollapsed ? "px-2 py-4" : "px-4 py-4",
          )}
        >
          {navigation.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            // Check if any child route is active
            const isChildActive = hasChildren
              ? item.children!.some(
                  (child) =>
                    pathname === child.href ||
                    (child.href !== "/lifeos" && pathname?.startsWith(`${child.href}/`))
                )
              : false;
            const isActive =
              item.href
                ? pathname === item.href ||
                  (item.href !== "/lifeos" && pathname?.startsWith(`${item.href}/`)) ||
                  isChildActive
                : isChildActive;
            const isExpanded = expandedSections.includes(item.name);

            // For items with children, render expandable section
            if (hasChildren && !effectiveCollapsed) {
              return (
                <div key={item.name} className="space-y-1">
                  <button
                    onClick={() => toggleSection(item.name)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md font-medium text-sm transition-colors",
                      "gap-3 px-3 py-2",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.name}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <div className="ml-4 space-y-1 border-l border-sidebar-border pl-2">
                      {item.children!.map((child) => {
                        const isChildActive = pathname === child.href;
                        const ChildIcon = child.icon || Circle;
                        return (
                          <Link
                            key={child.name}
                            to={child.href}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors",
                              isChildActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                          >
                            <ChildIcon className="h-4 w-4 flex-shrink-0" />
                            <span>{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular nav item or collapsed mode
            const commonClassName = cn(
              "flex items-center rounded-md font-medium text-sm transition-colors",
              effectiveCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            );

            const itemContent = item.onClick ? (
              <button
                key={item.name}
                type="button"
                onClick={item.onClick}
                className={commonClassName}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!effectiveCollapsed && <span>{item.name}</span>}
              </button>
            ) : (
              <Link
                key={item.name}
                to={item.href!}
                className={commonClassName}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!effectiveCollapsed && <span>{item.name}</span>}
              </Link>
            );

            return effectiveCollapsed ? (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.name}>{itemContent}</div>
            );
          })}
        </nav>

        {/* User Profile */}
        {user && (
          <div
            className={cn(
              "border-sidebar-border border-t",
              effectiveCollapsed ? "p-2" : "p-4",
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full",
                    effectiveCollapsed ? "px-2" : "justify-start",
                  )}
                >
                  {effectiveCollapsed ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <div className="flex w-full items-center gap-3">
                      <User className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate font-medium text-sm">
                        {user.emailAddresses[0]?.emailAddress ||
                          user.firstName ||
                          "User"}
                      </span>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="font-medium text-sm">
                    {user.emailAddresses[0]?.emailAddress || user.firstName}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOutToLifeOS()}
                  className="cursor-pointer text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </aside>
  );
}
