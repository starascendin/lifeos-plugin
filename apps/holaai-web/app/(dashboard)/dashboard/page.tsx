"use client";

import { useQuery } from "convex/react";
import { api } from "@holaai/convex/convex/_generated/api";
import Link from "next/link";
import { BookOpen, Mic, Trophy, TrendingUp } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";

export default function Dashboard() {
  const user = useQuery(api.users.currentUser);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  const quickActions = [
    {
      name: "Start Lesson",
      description: "Continue your learning journey",
      href: "/dashboard/lessons",
      icon: BookOpen,
      color: "text-blue-600",
    },
    {
      name: "Practice Speaking",
      description: "Voice practice with AI",
      href: "/dashboard/practice",
      icon: Mic,
      color: "text-green-600",
    },
    {
      name: "View Progress",
      description: "Track your achievements",
      href: "/dashboard/progress",
      icon: Trophy,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink>Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">
              Hola{user?.name ? `, ${user.name}` : ""}!
            </h1>
            <p className="text-muted-foreground mt-2">
              Ready to continue learning Spanish?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickActions.map((action) => (
              <Link key={action.name} href={action.href}>
                <div className="bg-muted/50 p-6 rounded-lg border border-border hover:bg-muted transition-all cursor-pointer h-full">
                  <action.icon className={`h-8 w-8 ${action.color} mb-4`} />
                  <h3 className="font-semibold text-lg mb-2">{action.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div className="border-t border-border pt-6">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Your Progress
            </h2>
            <p className="text-muted-foreground">
              Your! learning statistics will appear here as you complete lessons
              and practice sessions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
