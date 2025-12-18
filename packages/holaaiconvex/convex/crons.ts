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

// Run daily at 0:30 AM UTC to record cycle snapshots for burnup charts
crons.daily(
  "lifeos-pm-record-cycle-snapshots",
  { hourUTC: 0, minuteUTC: 30 },
  internal.lifeos.pm_crons.recordCycleSnapshotsJob
);

export default crons;
