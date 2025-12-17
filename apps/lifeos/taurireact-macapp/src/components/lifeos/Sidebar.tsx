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
import { useTheme } from "@/lib/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useClerk, useUser } from "@clerk/clerk-react";
import { Link, useLocation } from "react-router-dom";
import {
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Kanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MessageSquare,
  Moon,
  FolderKanban,
  RefreshCw,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { name: string; href: string; icon?: React.ComponentType<{ className?: string }> }[];
}

export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["Projects"]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleSection = (name: string) => {
    setExpandedSections((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const navigation: NavItem[] = [
    { name: "Dashboard", href: "/lifeos", icon: LayoutDashboard },
    { name: "Chat Nexus", href: "/lifeos/chatnexus", icon: MessageSquare },
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
    { name: "Settings", href: "/lifeos/settings", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "h-full rounded-lg border border-sidebar-border bg-sidebar text-sidebar-foreground shadow transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header with branding */}
        <div
          className={cn(
            "flex items-center border-sidebar-border border-b",
            isCollapsed ? "justify-center p-4" : "justify-between p-6",
          )}
        >
          {!isCollapsed && <h1 className="font-bold text-xl">LifeOS</h1>}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className={cn("h-8 w-8", isCollapsed && "mx-auto")}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            "flex-1 space-y-1",
            isCollapsed ? "px-2 py-4" : "px-4 py-4",
          )}
        >
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/lifeos" && pathname?.startsWith(`${item.href}/`));
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedSections.includes(item.name);

            // For items with children, render expandable section
            if (hasChildren && !isCollapsed) {
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
            const linkContent = (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center rounded-md font-medium text-sm transition-colors",
                  isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );

            return isCollapsed ? (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.name}>{linkContent}</div>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <div
          className={cn(
            "border-sidebar-border border-t",
            isCollapsed ? "p-2" : "px-4 py-3",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={isCollapsed ? "icon" : "default"}
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
                className={cn("w-full", !isCollapsed && "justify-start")}
              >
                {mounted ? (
                  resolvedTheme === "dark" ? (
                    <>
                      <Sun className="h-5 w-5" />
                      {!isCollapsed && <span className="ml-3">Light Mode</span>}
                    </>
                  ) : (
                    <>
                      <Moon className="h-5 w-5" />
                      {!isCollapsed && <span className="ml-3">Dark Mode</span>}
                    </>
                  )
                ) : (
                  <>
                    <Sun className="h-5 w-5" />
                    {!isCollapsed && <span className="ml-3">Toggle Theme</span>}
                  </>
                )}
              </Button>
            </TooltipTrigger>
            {isCollapsed && mounted && (
              <TooltipContent side="right">
                {resolvedTheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"}
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* User Profile */}
        {user && (
          <div
            className={cn(
              "border-sidebar-border border-t",
              isCollapsed ? "p-2" : "p-4",
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full",
                    isCollapsed ? "px-2" : "justify-start",
                  )}
                >
                  {isCollapsed ? (
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
                  onClick={() => signOut()}
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
