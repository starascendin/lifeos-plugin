import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Cron job action to auto-generate cycles for all users
 * Runs daily at 1 AM UTC
 */
export const autoGenerateCyclesJob = internalAction({
  args: {},
  handler: async (ctx): Promise<{ usersProcessed: number; totalGenerated: number }> => {
    // Get all users with cycle settings
    const userIds: Id<"users">[] = await ctx.runMutation(
      internal.lifeos.pm_cycles._getUsersWithCycleSettings,
      {}
    );

    console.log(`[Cycle Cron] Processing ${userIds.length} users with cycle settings`);

    let totalGenerated = 0;
    for (const userId of userIds) {
      try {
        const result: { generated: number; reason: string } = await ctx.runMutation(
          internal.lifeos.pm_cycles._autoGenerateCyclesForUser,
          { userId, minUpcoming: 2 }
        );
        if (result.generated > 0) {
          console.log(`[Cycle Cron] Generated ${result.generated} cycles for user ${userId}`);
          totalGenerated += result.generated;
        }
      } catch (error) {
        console.error(`[Cycle Cron] Error processing user ${userId}:`, error);
      }
    }

    console.log(`[Cycle Cron] Completed. Total cycles generated: ${totalGenerated}`);
    return { usersProcessed: userIds.length, totalGenerated };
  },
});

/**
 * Cron job action to record daily snapshots for all active cycles
 * Runs daily at 0:30 AM UTC
 */
export const recordCycleSnapshotsJob = internalAction({
  args: {},
  handler: async (ctx): Promise<{ cyclesProcessed: number }> => {
    // Get all active cycles
    const activeCycles: { cycleId: Id<"lifeos_pmCycles">; userId: Id<"users"> }[] =
      await ctx.runMutation(
        internal.lifeos.pm_cycle_snapshots._getActiveCyclesForSnapshot,
        {}
      );

    console.log(
      `[Snapshot Cron] Processing ${activeCycles.length} active cycles`
    );

    for (const { cycleId, userId } of activeCycles) {
      try {
        await ctx.runMutation(
          internal.lifeos.pm_cycle_snapshots._recordSnapshotInternal,
          { cycleId, userId }
        );
      } catch (error) {
        console.error(
          `[Snapshot Cron] Error recording snapshot for cycle ${cycleId}:`,
          error
        );
      }
    }

    console.log(`[Snapshot Cron] Completed. Cycles processed: ${activeCycles.length}`);
    return { cyclesProcessed: activeCycles.length };
  },
});
