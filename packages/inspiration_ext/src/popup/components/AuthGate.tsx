import { useAuth } from "@clerk/chrome-extension";
import { useMutation } from "convex/react";
import { api } from "@holaai/convex/_generated/api";
import { useEffect, useState } from "react";

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const ensureUser = useMutation(api.common.users.ensureUser);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn && !synced) {
      ensureUser()
        .then(() => setSynced(true))
        .catch((err) => {
          console.error("Failed to sync user:", err);
          setError("Failed to sync user. Please try again.");
        });
    }
  }, [isSignedIn, synced, ensureUser]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] p-4">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setSynced(false);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isSignedIn || !synced) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
