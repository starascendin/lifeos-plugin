import { useQuery } from "convex/react";
import { api } from "@holaai/convex/_generated/api";

export type UserRole = "user" | "developer";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  developer: 10,
};

/**
 * Hook to access current user's role and role-checking helpers
 */
export function useUserRole() {
  const currentUser = useQuery(api.common.users.currentUser);

  const role = (currentUser?.role ?? "user") as UserRole;
  const isLoading = currentUser === undefined;
  const isAuthenticated = currentUser !== null && currentUser !== undefined;

  return {
    role,
    isLoading,
    isAuthenticated,

    // Convenience methods
    isDeveloper: role === "developer",
    isUser: role === "user",

    // Generic role check
    hasRole: (requiredRole: UserRole) => role === requiredRole,

    // Hierarchical check (developer > user)
    hasMinimumRole: (requiredRole: UserRole) => {
      return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
    },
  };
}
