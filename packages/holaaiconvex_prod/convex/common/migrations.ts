import { internalMutation } from "../_generated/server";
import { getDefaultRole } from "../_lib/roles";

/**
 * Backfill user roles for existing users
 * Run with: npx convex run common/migrations:backfillUserRoles
 */
export const backfillUserRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updated = 0;

    for (const user of users) {
      if (user.role === undefined) {
        const role = getDefaultRole(user.email);
        await ctx.db.patch(user._id, { role });
        updated++;
        console.log(`Set role "${role}" for user: ${user.email}`);
      }
    }

    console.log(`Migration complete: ${updated}/${users.length} users updated`);
    return { updated, total: users.length };
  },
});
