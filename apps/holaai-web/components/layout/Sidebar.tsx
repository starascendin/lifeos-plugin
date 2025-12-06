"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useClerk, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/lib/sidebar-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  BookOpen,
  Mic,
  Trophy,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  User,
  LogOut,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Lessons", href: "/dashboard/lessons", icon: BookOpen },
    { name: "Practice", href: "/dashboard/practice", icon: Mic },
    { name: "Progress", href: "/dashboard/progress", icon: Trophy },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "rounded-lg bg-sidebar text-sidebar-foreground transition-all duration-300 shadow h-full border border-sidebar-border",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header with HolaAI branding */}
        <div
          className={cn(
            "flex items-center border-b border-sidebar-border",
            isCollapsed ? "justify-center p-4" : "justify-between p-6"
          )}
        >
          {!isCollapsed && <h1 className="text-xl font-bold">HolaAI</h1>}
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
            isCollapsed ? "px-2 py-4" : "px-4 py-4"
          )}
        >
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            const linkContent = (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center rounded-md text-sm font-medium transition-colors",
                  isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
            "border-t border-sidebar-border",
            isCollapsed ? "p-2" : "px-4 py-3"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={isCollapsed ? "icon" : "default"}
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className={cn("w-full", !isCollapsed && "justify-start")}
              >
                {/* Only render after mount to avoid hydration mismatch */}
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
                {resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* User Profile */}
        {user && (
          <div
            className={cn(
              "border-t border-sidebar-border",
              isCollapsed ? "p-2" : "p-4"
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full",
                    isCollapsed ? "px-2" : "justify-start"
                  )}
                >
                  {isCollapsed ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <div className="flex items-center gap-3 w-full">
                      <User className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">
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
                  <p className="text-sm font-medium">
                    {user.emailAddresses[0]?.emailAddress || user.firstName}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ redirectUrl: "/signin" })}
                  className="cursor-pointer text-red-600"
                >
                  <LogOut className="h-4 w-4 mr-2" />
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
