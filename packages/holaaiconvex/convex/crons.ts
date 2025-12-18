import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ==================== LIFEOS PM CRONS ====================

// Run daily at 1 AM UTC to auto-generate cycles for users
crons.daily(
  "lifeos-pm-auto-generate-cycles",
  { hourUTC: 1, minuteUTC: 0 },
  internal.lifeos.pm_crons.autoGenerateCyclesJob
);

export default crons;
