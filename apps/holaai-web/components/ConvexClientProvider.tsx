"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ReactNode, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@holaai/convex/convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  verbose: true,
});

function EnsureUser({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (isSignedIn) {
      ensureUser().catch(console.error);
    }
  }, [isSignedIn, ensureUser]);

  return <>{children}</>;
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <EnsureUser>{children}</EnsureUser>
    </ConvexProviderWithClerk>
  );
}
