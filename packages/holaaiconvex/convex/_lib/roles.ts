/**
 * User role definitions and type-safe helpers
 *
 * To add a new role:
 * 1. Add it to the UserRole type
 * 2. Add it to VALID_ROLES array
 * 3. Update schema.ts userRoles union
 * 4. Add to ROLE_HIERARCHY if needed
 */

// Type-safe role definitions
export type UserRole = "user" | "developer";

// All valid roles for runtime validation
export const VALID_ROLES: UserRole[] = ["user", "developer"];

// Default role for new users
export const DEFAULT_ROLE: UserRole = "user";

// Email-to-role mapping for special users
const SPECIAL_USER_ROLES: Record<string, UserRole> = {
  "bsliu17@gmail.com": "developer",
};

/**
 * Get the role to assign to a new user based on their email
 */
export function getDefaultRole(email: string): UserRole {
  return SPECIAL_USER_ROLES[email.toLowerCase()] ?? DEFAULT_ROLE;
}

/**
 * Role hierarchy for permission checks (higher = more privileges)
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  developer: 10,
};

/**
 * Check if a role has at least the specified permission level
 */
export function hasMinimumRole(
  userRole: UserRole | undefined | null,
  requiredRole: UserRole
): boolean {
  const actualRole = userRole ?? DEFAULT_ROLE;
  return ROLE_HIERARCHY[actualRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user has a specific role (exact match)
 */
export function hasRole(
  userRole: UserRole | undefined | null,
  role: UserRole
): boolean {
  return (userRole ?? DEFAULT_ROLE) === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(
  userRole: UserRole | undefined | null,
  roles: UserRole[]
): boolean {
  const actualRole = userRole ?? DEFAULT_ROLE;
  return roles.includes(actualRole);
}
