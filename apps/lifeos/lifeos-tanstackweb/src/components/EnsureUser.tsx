import { useAuth } from "@clerk/tanstack-react-start";
import { api } from "@holaai/convex/convex/_generated/api";
import { useMutation } from "convex/react";
import { type ReactNode, useEffect } from "react";

export function EnsureUser({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (isSignedIn) {
      ensureUser().catch(console.error);
    }
  }, [isSignedIn, ensureUser]);

  return <>{children}</>;
}
