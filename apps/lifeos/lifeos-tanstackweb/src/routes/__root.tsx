import { EnsureUser } from "@/components/EnsureUser";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-context";
import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ConvexProviderWithClerk } from "convex/react-clerk";
/// <reference types="vite/client" />
import type * as React from "react";
// Import CSS both ways: regular import for types, ?url for SSR link injection
import "@/globals.css";
import globalsCss from "@/globals.css?url";

interface RouterContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  const { queryClient, convexQueryClient } = Route.useRouteContext();

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk
        client={convexQueryClient.convexClient}
        useAuth={useAuth}
      >
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="dark">
            <TooltipProvider delayDuration={300} skipDelayDuration={100}>
              <EnsureUser>
                <RootDocument>
                  <Outlet />
                </RootDocument>
              </EnsureUser>
            </TooltipProvider>
          </ThemeProvider>
          <ReactQueryDevtools buttonPosition="bottom-left" />
        </QueryClientProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

// Inline script to prevent FOUC - runs before React hydration
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme') || 'dark';
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch (e) {}
})();
`;

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to font servers */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Critical: Load stylesheet FIRST to prevent FOUC */}
        <link rel="stylesheet" href={globalsCss} />
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        {children}
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
