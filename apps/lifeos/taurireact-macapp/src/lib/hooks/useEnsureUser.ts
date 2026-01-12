import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/platformClerk";
import { useMutation } from "convex/react";
import { api } from "@holaai/convex";

export function useEnsureUser() {
  const { isSignedIn } = useAuth();
  const ensureUser = useMutation(api.common.users.ensureUser);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (isSignedIn && !synced) {
      ensureUser()
        .then(() => setSynced(true))
        .catch((err) => console.error("Failed to sync user:", err));
    }
  }, [isSignedIn, synced, ensureUser]);

  return synced;
}
