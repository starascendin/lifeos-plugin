import { useAuth } from "@clerk/clerk-react";
import { useEnsureUser } from "../../lib/hooks/useEnsureUser";

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const userSynced = useEnsureUser();

  if (!isLoaded || !isSignedIn || !userSynced) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner" />
      </div>
    );
  }

  return <>{children}</>;
}
