import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { cycleSettingsValidator } from "./pm_schema";

// ==================== QUERIES ====================

/**
 * Get user settings for the authenticated user
 */
export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const settings = await ctx.db
      .query("lifeos_pmUserSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return settings;
  },
});

// ==================== MUTATIONS ====================

/**
 * Update or create user settings
 * On first setup with cycle settings, auto-generates initial cycles
 */
export const updateUserSettings = mutation({
  args: {
    cycleSettings: v.optional(cycleSettingsValidator),
    autoGenerateCycles: v.optional(v.boolean()), // Whether to auto-generate cycles on first setup
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if settings exist
    const existingSettings = await ctx.db
      .query("lifeos_pmUserSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const isFirstSetup = !existingSettings && args.cycleSettings;
    const hadNoCycleSettings = existingSettings && !existingSettings.cycleSettings && args.cycleSettings;

    let settingsId;
    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        cycleSettings: args.cycleSettings,
        updatedAt: now,
      });
      settingsId = existingSettings._id;
    } else {
      // Create new settings
      settingsId = await ctx.db.insert("lifeos_pmUserSettings", {
        userId: user._id,
        cycleSettings: args.cycleSettings,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Auto-generate cycles on first setup if requested and user has no cycles
    if ((isFirstSetup || hadNoCycleSettings) && args.autoGenerateCycles !== false && args.cycleSettings) {
      const existingCycles = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      // Only auto-generate if user has no cycles
      if (!existingCycles) {
        const duration = args.cycleSettings.duration;
        const startDay = args.cycleSettings.startDay;
        const count = args.cycleSettings.defaultCyclesToCreate;

        // Calculate duration in milliseconds
        const durationMs =
          duration === "1_week"
            ? 7 * 24 * 60 * 60 * 1000
            : 14 * 24 * 60 * 60 * 1000;

        // Find next start date based on startDay
        let startDate = now;
        const targetDayNum = startDay === "sunday" ? 0 : 1;
        const currentDate = new Date(startDate);
        const currentDay = currentDate.getDay();
        const daysUntilTarget = (targetDayNum - currentDay + 7) % 7;

        if (daysUntilTarget === 0) {
          // Today is the target day, start today
        } else {
          startDate += daysUntilTarget * 24 * 60 * 60 * 1000;
        }

        // Normalize to start of day (midnight)
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        startDate = startDateObj.getTime();

        // Generate cycles
        for (let i = 0; i < count; i++) {
          const cycleStartDate = startDate + i * durationMs;
          const cycleEndDate = cycleStartDate + durationMs - 1;

          // Determine status based on current date
          let status: "upcoming" | "active" | "completed" = "upcoming";
          if (now >= cycleStartDate && now <= cycleEndDate) {
            status = "active";
          } else if (now > cycleEndDate) {
            status = "completed";
          }

          await ctx.db.insert("lifeos_pmCycles", {
            userId: user._id,
            number: i + 1,
            startDate: cycleStartDate,
            endDate: cycleEndDate,
            status,
            issueCount: 0,
            completedIssueCount: 0,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return settingsId;
  },
});
